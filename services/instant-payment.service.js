const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const razorpay = require('../config/razorpay');
const phonepe = require('../config/phonepe');
const { BadRequestError, NotFoundError, UnauthorizedError, ConflictError } = require('../utils/errors');
const { timingSafeCompare } = require('../utils/helpers');

class InstantPaymentService {
  async createOrder({ patientId, doctorId, gateway = 'RAZORPAY' }) {
    const [doctors] = await db.query(`SELECT id FROM doctors WHERE id=? AND status='ACTIVE' AND verification_status='APPROVED'`, [doctorId]);
    if (!doctors.length) throw new NotFoundError('Doctor is not available for instant consultation');
    const selectedGateway = String(gateway || 'RAZORPAY').toUpperCase();
    const amount = Number(config.platform.defaultFee || 99);
    let orderId;
    let checkout = {};
    if (selectedGateway === 'PHONEPE') {
      if (!config.phonepe.merchantId || !config.phonepe.saltKey || !config.phonepe.redirectUrl || !config.phonepe.callbackUrl) throw new BadRequestError('PhonePe payment gateway is not configured');
      orderId = `CFI_${patientId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      try {
        const response = await phonepe.createPayment({
          merchantId: config.phonepe.merchantId,
          merchantTransactionId: orderId,
          merchantUserId: `PATIENT_${patientId}`,
          amount: Math.round(amount * 100),
          redirectUrl: `${config.phonepe.redirectUrl}?instantPaymentId=PHONEPE&doctorId=${doctorId}&merchantTransactionId=${encodeURIComponent(orderId)}`,
          redirectMode: 'REDIRECT',
          callbackUrl: config.phonepe.callbackUrl,
          paymentInstrument: { type: 'PAY_PAGE' },
        });
        if (!response.success || !response.data?.instrumentResponse?.redirectInfo?.url) throw new Error(response.message || 'PhonePe did not return a checkout URL');
        checkout = { gateway: 'PHONEPE', redirectUrl: response.data.instrumentResponse.redirectInfo.url, merchantTransactionId: orderId };
      } catch (e) { throw new BadRequestError(`PhonePe order creation failed: ${e.message}`); }
    } else {
      if (!razorpay || !config.razorpay.keyId) throw new BadRequestError('Razorpay payment gateway is not configured');
      const receipt = `instant_${patientId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      try {
        const order = await razorpay.orders.create({ amount: Math.round(amount * 100), currency: 'INR', receipt, notes: { patientId: String(patientId), doctorId: String(doctorId), type: 'INSTANT_CONSULTATION' } });
        orderId = order.id;
      } catch (e) { throw new BadRequestError(`Razorpay order creation failed: ${e.message}`); }
    }
    const [result] = await db.query(`INSERT INTO instant_consultation_payments (patient_id, doctor_id, amount, gateway, gateway_order_id, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`, [patientId, doctorId, amount, selectedGateway, orderId]);
    return { instantPaymentId: result.insertId, orderId, amount: Math.round(amount * 100), currency: 'INR', keyId: selectedGateway === 'RAZORPAY' ? config.razorpay.keyId : undefined, doctorId, ...checkout };
  }

  async verify({ paymentId, patientId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!paymentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !config.razorpay.keySecret || !razorpay?.payments?.fetch) throw new BadRequestError('A valid Razorpay payment and server secret are required');
    const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    if (!timingSafeCompare(expected, razorpaySignature)) throw new UnauthorizedError('Invalid Razorpay payment signature');
    const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId);
    if (gatewayPayment.order_id !== razorpayOrderId || gatewayPayment.status !== 'captured') throw new UnauthorizedError('Razorpay payment is not captured for this order');
    return db.withTransaction(async conn => {
      const [rows] = await conn.query(`SELECT * FROM instant_consultation_payments WHERE id=? AND patient_id=? AND gateway_order_id=? FOR UPDATE`, [paymentId, patientId, razorpayOrderId]);
      if (!rows.length) throw new NotFoundError('Instant payment order not found');
      const payment = rows[0];
      if (Number(gatewayPayment.amount) !== Math.round(Number(payment.amount) * 100)) throw new UnauthorizedError('Payment amount does not match the instant consultation fee');
      if (payment.status === 'SUCCESS') return { success: true, instantPaymentId: payment.id, doctorId: payment.doctor_id, message: 'Payment already verified' };
      await conn.query(`UPDATE instant_consultation_payments SET status='SUCCESS', gateway_payment_id=?, gateway_signature=? WHERE id=?`, [razorpayPaymentId, razorpaySignature, payment.id]);
      return { success: true, instantPaymentId: payment.id, doctorId: payment.doctor_id, message: 'Payment verified' };
    });
  }

  async verifyPhonePe({ paymentId = null, patientId = null, merchantTransactionId }) {
    if (!merchantTransactionId || !config.phonepe.merchantId || !config.phonepe.saltKey) throw new BadRequestError('A valid PhonePe instant payment is required');
    const status = await phonepe.getPaymentStatus(merchantTransactionId);
    const data = status.data?.transactionId === merchantTransactionId ? status.data : null;
    if (!status.success || !data || data.state !== 'COMPLETED') throw new UnauthorizedError(`PhonePe payment is not completed${status.message ? `: ${status.message}` : ''}`);
    return db.withTransaction(async conn => {
      const conditions = ["gateway='PHONEPE'", 'gateway_order_id=?'];
      const params = [merchantTransactionId];
      if (paymentId) { conditions.unshift('id=?'); params.unshift(paymentId); }
      if (patientId) { conditions.unshift('patient_id=?'); params.unshift(patientId); }
      const [rows] = await conn.query(`SELECT * FROM instant_consultation_payments WHERE ${conditions.join(' AND ')} FOR UPDATE`, params);
      if (!rows.length) throw new NotFoundError('Instant payment order not found');
      const payment = rows[0];
      if (Number(data.amount) !== Math.round(Number(payment.amount) * 100)) throw new UnauthorizedError('Payment amount does not match the instant consultation fee');
      if (payment.status === 'SUCCESS') return { success: true, instantPaymentId: payment.id, doctorId: payment.doctor_id, message: 'Payment already verified' };
      await conn.query(`UPDATE instant_consultation_payments SET status='SUCCESS', gateway_payment_id=?, gateway_signature=? WHERE id=?`, [data.providerReferenceId || data.transactionId, status.code || 'PHONEPE_STATUS_VERIFIED', payment.id]);
      return { success: true, instantPaymentId: payment.id, doctorId: payment.doctor_id, message: 'Payment verified' };
    });
  }
}

module.exports = new InstantPaymentService();
