const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const razorpay = require('../config/razorpay');
const { BadRequestError, NotFoundError, UnauthorizedError, ConflictError } = require('../utils/errors');
const { timingSafeCompare } = require('../utils/helpers');

class InstantPaymentService {
  async createOrder({ patientId, doctorId }) {
    const [doctors] = await db.query(`SELECT id FROM doctors WHERE id=? AND status='ACTIVE' AND verification_status='APPROVED'`, [doctorId]);
    if (!doctors.length) throw new NotFoundError('Doctor is not available for instant consultation');
    if (!razorpay || !config.razorpay.keyId) throw new BadRequestError('Razorpay payment gateway is not configured');
    const amount = Number(config.platform.defaultFee || 99);
    const receipt = `instant_${patientId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    let order;
    try {
      order = await razorpay.orders.create({ amount: Math.round(amount * 100), currency: 'INR', receipt, notes: { patientId: String(patientId), doctorId: String(doctorId), type: 'INSTANT_CONSULTATION' } });
    } catch (e) { throw new BadRequestError(`Razorpay order creation failed: ${e.message}`); }
    const [result] = await db.query(`INSERT INTO instant_consultation_payments (patient_id, doctor_id, amount, gateway_order_id, status) VALUES (?, ?, ?, ?, 'PENDING')`, [patientId, doctorId, amount, order.id]);
    return { instantPaymentId: result.insertId, orderId: order.id, amount: Math.round(amount * 100), currency: 'INR', keyId: config.razorpay.keyId, doctorId };
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
}

module.exports = new InstantPaymentService();
