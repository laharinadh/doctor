const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const razorpay = require('../config/razorpay');
const phonepe = require('../config/phonepe');
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
} = require('../utils/errors');
const {
  PAYMENT_STATUS,
  APPOINTMENT_STATUS,
  AUDIT_ACTIONS,
} = require('../utils/constants');
const { timingSafeCompare } = require('../utils/helpers');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const logger = require('../utils/logger');
const instantPaymentService = require('./instant-payment.service');

class PaymentService {
  async createOrder({ appointmentId, patientId, gateway = 'RAZORPAY', userId = null, ip = null, userAgent = null }) {
    // 1. Fetch appointment and verify hold
    const [appointments] = await db.query(
      `SELECT * FROM appointments 
       WHERE id = ? AND patient_id = ?`,
      [appointmentId, patientId]
    );

    if (!appointments.length) {
      throw new NotFoundError('Appointment not found');
    }

    const appointment = appointments[0];

    if (!['HELD', 'PAYMENT_PENDING'].includes(appointment.status)) {
      throw new ConflictError(`Cannot pay for appointment with status: ${appointment.status}`);
    }

    // Verify hold expiration
    if (appointment.hold_expires_at && new Date(appointment.hold_expires_at) < new Date()) {
      throw new BadRequestError('Appointment hold has expired. Please select a slot again.');
    }

    const amountInPaise = Math.round(Number(appointment.platform_fee) * 100);
    const selectedGateway = String(gateway || 'RAZORPAY').toUpperCase();
    let gatewayOrderId = null;
    let checkout = {};
    if (selectedGateway === 'PHONEPE') {
      if (!config.phonepe.merchantId || !config.phonepe.saltKey || !config.phonepe.redirectUrl || !config.phonepe.callbackUrl) {
        throw new BadRequestError('PhonePe payment gateway is not configured');
      }
      gatewayOrderId = `CF_${appointment.id}_${Date.now()}`;
      try {
        const response = await phonepe.createPayment({
          merchantId: config.phonepe.merchantId,
          merchantTransactionId: gatewayOrderId,
          merchantUserId: `PATIENT_${patientId}`,
          amount: amountInPaise,
          redirectUrl: `${config.phonepe.redirectUrl}?appointmentId=${appointment.id}&merchantTransactionId=${encodeURIComponent(gatewayOrderId)}`,
          redirectMode: 'REDIRECT',
          callbackUrl: config.phonepe.callbackUrl,
          paymentInstrument: { type: 'PAY_PAGE' },
        });
        if (!response.success || !response.data?.instrumentResponse?.redirectInfo?.url) {
          throw new Error(response.message || 'PhonePe did not return a checkout URL');
        }
        checkout = { gateway: 'PHONEPE', redirectUrl: response.data.instrumentResponse.redirectInfo.url, merchantTransactionId: gatewayOrderId };
      } catch (err) {
        throw new BadRequestError(`PhonePe order creation failed: ${err.message}`);
      }
    } else {
      if (!razorpay || !config.razorpay.keyId) {
        throw new BadRequestError('Razorpay payment gateway is not configured');
      }
      try {
        const order = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: appointment.appointment_number,
          notes: { appointmentId: String(appointment.id), patientId: String(patientId) },
        });
        gatewayOrderId = order.id;
      } catch (err) {
        throw new BadRequestError(`Razorpay order creation failed: ${err.message}`);
      }
    }

    return await db.withTransaction(async (conn) => {
      // Check if existing payment row exists for this appointment
      const [existingPayments] = await conn.query(
        'SELECT id FROM payments WHERE appointment_id = ?',
        [appointmentId]
      );

      let paymentId;
      if (existingPayments.length) {
        paymentId = existingPayments[0].id;
        await conn.query(
          `UPDATE payments 
           SET gateway = ?, gateway_order_id = ?, amount = ?, status = 'PENDING', gateway_payment_id = NULL, gateway_signature = NULL
           WHERE id = ?`,
          [selectedGateway, gatewayOrderId, appointment.platform_fee, paymentId]
        );
      } else {
        const [res] = await conn.query(
          `INSERT INTO payments 
            (appointment_id, patient_id, amount, currency, gateway, gateway_order_id, status)
           VALUES (?, ?, ?, 'INR', ?, ?, 'PENDING')`,
          [appointmentId, patientId, appointment.platform_fee, selectedGateway, gatewayOrderId]
        );
        paymentId = res.insertId;
      }

      await conn.query(
        'UPDATE appointments SET status = ?, payment_id = ? WHERE id = ?',
        [APPOINTMENT_STATUS.PAYMENT_PENDING, paymentId, appointmentId]
      );

      await auditService.log({
        userId,
        role: 'PATIENT',
        action: AUDIT_ACTIONS.PAYMENT_ORDER_CREATED,
        resourceType: 'payments',
        resourceId: paymentId,
        metadata: { gateway: selectedGateway, gatewayOrderId, amount: appointment.platform_fee },
        ip,
        userAgent,
        conn,
      });

      return {
        orderId: gatewayOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: selectedGateway === 'RAZORPAY' ? config.razorpay.keyId : undefined,
        ...checkout,
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointment_number,
      };
    });
  }

  async verifyPhonePePayment({ appointmentId, patientId, merchantTransactionId, userId = null, ip = null, userAgent = null }) {
    if (!config.phonepe.merchantId || !config.phonepe.saltKey || !merchantTransactionId) {
      throw new BadRequestError('A valid PhonePe transaction and server credentials are required');
    }
    const [rows] = await db.query('SELECT * FROM payments WHERE gateway_order_id = ? AND gateway = \'PHONEPE\'', [merchantTransactionId]);
    if (!rows.length) throw new NotFoundError('PhonePe payment order not found');
    const status = await phonepe.getPaymentStatus(merchantTransactionId);
    const payment = status.data?.transactionId === merchantTransactionId ? status.data : null;
    if (!status.success || !payment || payment.state !== 'COMPLETED') {
      throw new UnauthorizedError(`PhonePe payment is not completed${status.message ? `: ${status.message}` : ''}`);
    }
    return this.confirmPaymentAndAppointment({
      gatewayOrderId: merchantTransactionId,
      gatewayPaymentId: payment.providerReferenceId || payment.transactionId,
      gatewaySignature: status.code || 'PHONEPE_STATUS_VERIFIED',
      expectedAppointmentId: appointmentId,
      expectedPatientId: patientId,
      gatewayAmount: payment.amount,
      userId, ip, userAgent,
    });
  }

  async verifyClientPayment({
    appointmentId,
    patientId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    userId = null,
    ip = null,
    userAgent = null,
  }) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !config.razorpay.keySecret || !razorpay?.payments?.fetch) {
      throw new BadRequestError('A valid Razorpay payment and server secret are required');
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (!timingSafeCompare(expectedSignature, razorpaySignature)) {
      throw new UnauthorizedError('Invalid Razorpay payment signature');
    }

    const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId);
    if (gatewayPayment.order_id !== razorpayOrderId || gatewayPayment.status !== 'captured') {
      throw new UnauthorizedError('Razorpay payment is not captured for this order');
    }
    const gatewayAmount = gatewayPayment.amount;

    return await this.confirmPaymentAndAppointment({
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      gatewaySignature: razorpaySignature,
      expectedAppointmentId: appointmentId,
      expectedPatientId: patientId,
      gatewayAmount,
      userId,
      ip,
      userAgent,
    });
  }

  async ensureWebhookTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        webhook_id VARCHAR(150) NOT NULL UNIQUE,
        event_type VARCHAR(100) NOT NULL,
        payload_hash VARCHAR(64) NOT NULL,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_webhook_id (webhook_id),
        INDEX idx_processed_at (processed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  async handleWebhook(rawBody, signatureHeader, eventId = null) {
    if (!config.razorpay.webhookSecret) {
      throw new UnauthorizedError('Webhook secret is not configured');
    }

    if (typeof rawBody !== 'string' || !rawBody || typeof signatureHeader !== 'string') {
      throw new UnauthorizedError('Signed raw webhook body is required');
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!timingSafeCompare(expectedSignature, signatureHeader)) {
      throw new UnauthorizedError('Invalid Razorpay webhook signature');
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const webhookId = eventId || payload.id || `whk_${event}_${payload.payload?.payment?.entity?.id || payload.payload?.order?.entity?.id || payloadHash.substring(0, 16)}`;

    const result = await db.withTransaction(async (conn) => {
      try {
        await conn.query(
          'INSERT INTO processed_webhooks (webhook_id, event_type, payload_hash) VALUES (?, ?, ?)',
          [webhookId, event || 'unknown', payloadHash]
        );
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return { received: true, deduplicated: true, webhookId, message: 'Webhook event already processed (replay ignored)' };
        }
        throw err;
      }

      if (!event) return { received: true, webhookId, message: 'Webhook event received' };

      let confirmationResult = { received: true, event };
      if (event === 'order.paid' || event === 'payment.captured') {
        const paymentEntity = payload.payload.payment.entity;
        const confirmResult = await this.confirmPaymentAndAppointment({
          conn,
          gatewayOrderId: paymentEntity.order_id,
          gatewayPaymentId: paymentEntity.id,
          gatewaySignature: signatureHeader,
          gatewayAmount: paymentEntity.amount,
        });
        confirmationResult = { received: true, ...confirmResult };
      }
      return confirmationResult;
    });
    if (result.refundId) await this.issueRefund(result);
    return result;
  }

  async handlePhonePeCallback(rawBody, signatureHeader) {
    if (!config.phonepe.saltKey || !phonepe.verifyCallback(rawBody, signatureHeader)) {
      throw new UnauthorizedError('Invalid PhonePe callback signature');
    }
    const payload = JSON.parse(Buffer.from(rawBody, 'base64').toString('utf8'));
    const data = payload.data || {};
    if (payload.code === 'PAYMENT_SUCCESS' && data.merchantTransactionId) {
      if (String(data.merchantTransactionId).startsWith('CFI_')) {
        return instantPaymentService.verifyPhonePe({ merchantTransactionId: data.merchantTransactionId });
      }
      return this.verifyPhonePePayment({ merchantTransactionId: data.merchantTransactionId });
    }
    return { received: true, status: payload.code || 'UNKNOWN' };
  }

  async confirmPaymentAndAppointment({ conn: transactionConn = null, gatewayOrderId, gatewayPaymentId, gatewaySignature, expectedAppointmentId = null, expectedPatientId = null, gatewayAmount = null, userId = null, ip = null, userAgent = null }) {
    const execute = async (conn) => {
      // Row lock for strict idempotency under high concurrency
      const [payments] = await conn.query(
        'SELECT * FROM payments WHERE gateway_order_id = ? FOR UPDATE',
        [gatewayOrderId]
      );

      if (!payments.length) {
        throw new NotFoundError('Payment order not found in database');
      }

      const payment = payments[0];

      if (expectedAppointmentId && Number(payment.appointment_id) !== Number(expectedAppointmentId)) {
        throw new UnauthorizedError('Payment does not belong to this appointment');
      }
      if (expectedPatientId && Number(payment.patient_id) !== Number(expectedPatientId)) {
        throw new UnauthorizedError('Payment does not belong to this patient');
      }
      if (gatewayAmount !== null && Number(gatewayAmount) !== Math.round(Number(payment.amount) * 100)) {
        throw new UnauthorizedError('Payment amount does not match the appointment fee');
      }

      // Idempotency check: Already confirmed
      if (payment.status === PAYMENT_STATUS.SUCCESS) {
        return { success: true, message: 'Payment already verified and appointment confirmed' };
      }

      const [appointments] = await conn.query(
        'SELECT * FROM appointments WHERE id = ? FOR UPDATE',
        [payment.appointment_id]
      );
      const appointment = appointments[0];

      const holdExpired = appointment?.hold_expires_at && new Date(appointment.hold_expires_at) < new Date();
      const appointmentUnavailable = !appointment || ![APPOINTMENT_STATUS.HELD, APPOINTMENT_STATUS.PAYMENT_PENDING].includes(appointment.status);
      if (appointmentUnavailable || holdExpired) {
        if (!appointment) throw new NotFoundError('Appointment not found for payment');

        await conn.query(
          `UPDATE payments
           SET status = 'SUCCESS', gateway_payment_id = ?, gateway_signature = ?
           WHERE id = ?`,
          [gatewayPaymentId, gatewaySignature, payment.id]
        );
        await conn.query(
          `UPDATE appointments SET status = 'CANCELLED', payment_id = ?, cancellation_reason = ? WHERE id = ?`,
          [payment.id, holdExpired ? 'Payment received after hold expired; refund pending' : 'Payment received for unavailable appointment; refund pending', appointment.id]
        );
        await conn.query(
          `INSERT INTO appointment_events (appointment_id, from_status, to_status, changed_by, reason)
           VALUES (?, ?, ?, ?, ?)`,
          [appointment.id, appointment.status, APPOINTMENT_STATUS.CANCELLED, userId, 'Payment captured after appointment became unavailable']
        );
        const [refund] = await conn.query(
          `INSERT INTO refunds (payment_id, amount, reason, status) VALUES (?, ?, ?, 'PENDING')`,
          [payment.id, payment.amount, holdExpired ? 'Appointment hold expired before payment confirmation' : 'Appointment unavailable before payment confirmation']
        );
        return {
          success: false,
          refunded: false,
          refundPending: true,
          refundId: refund.insertId,
          gatewayPaymentId,
          amount: payment.amount,
          appointmentId: appointment.id,
          status: APPOINTMENT_STATUS.CANCELLED,
          message: 'Payment received, but the appointment was unavailable. Refund initiated.',
        };
      }

      // 1. Update payment status to SUCCESS
      await conn.query(
        `UPDATE payments 
         SET status = 'SUCCESS', gateway_payment_id = ?, gateway_signature = ?
         WHERE id = ?`,
        [gatewayPaymentId, gatewaySignature, payment.id]
      );

      // 2. Update appointment status to WAITING (waiting for doctor confirmation) and clear hold timer
      await conn.query(
        `UPDATE appointments 
         SET status = 'WAITING', payment_id = ?, hold_expires_at = NULL
         WHERE id = ?`,
        [payment.id, appointment.id]
      );

      // 3. Log appointment event
      await conn.query(
        `INSERT INTO appointment_events (appointment_id, from_status, to_status, changed_by, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [appointment.id, appointment.status, APPOINTMENT_STATUS.WAITING, userId, 'Platform fee payment confirmed. Awaiting doctor confirmation.']
      );

      // 4. Create consultation entry ready for appointment
      await conn.query(
        `INSERT INTO consultations (appointment_id, patient_id, doctor_id, status)
         VALUES (?, ?, ?, 'SCHEDULED')
         ON DUPLICATE KEY UPDATE status = 'SCHEDULED'`,
        [appointment.id, appointment.patient_id, appointment.doctor_id]
      );

      // 5. Send notifications
      // Patient notification
      const [patientUsers] = await conn.query('SELECT user_id FROM patients WHERE id = ?', [appointment.patient_id]);
      if (patientUsers.length) {
        await notificationService.create({
          userId: patientUsers[0].user_id,
          type: 'PAYMENT_RECEIVED',
          title: 'Booking Fee Received',
          body: `Your booking fee of ₹${payment.amount} for appointment ${appointment.appointment_number} has been received. Your appointment is now awaiting doctor confirmation.`,
          conn,
        });
      }

      // Doctor notification
      const [doctorUsers] = await conn.query('SELECT user_id FROM doctors WHERE id = ?', [appointment.doctor_id]);
      if (doctorUsers.length) {
        await notificationService.create({
          userId: doctorUsers[0].user_id,
          type: 'NEW_APPOINTMENT',
          title: 'New Booking Awaiting Confirmation',
          body: `New appointment ${appointment.appointment_number} on ${appointment.appointment_date} at ${appointment.start_time} requires your confirmation.`,
          conn,
        });
      }

      await auditService.log({
        userId,
        action: AUDIT_ACTIONS.PAYMENT_VERIFIED,
        resourceType: 'payments',
        resourceId: payment.id,
        metadata: { appointmentId: appointment.id, gatewayPaymentId },
        ip,
        userAgent,
        conn,
      });

      return {
        success: true,
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointment_number,
        status: APPOINTMENT_STATUS.WAITING,
        message: 'Payment verified! Appointment is now awaiting doctor confirmation.',
      };
    };

    const result = transactionConn ? await execute(transactionConn) : await db.withTransaction(execute);
    if (!transactionConn && result.refundId) await this.issueRefund(result);
    return result;
  }

  async issueRefund({ refundId, gatewayPaymentId, amount }) {
    if (!razorpay?.payments?.refund) return;
    try {
      const refund = await razorpay.payments.refund(gatewayPaymentId, { amount: Math.round(Number(amount) * 100) });
      await db.query('UPDATE refunds SET status = ?, gateway_refund_id = ? WHERE id = ?', ['PROCESSED', refund.id, refundId]);
    } catch (err) {
      await db.query('UPDATE refunds SET status = ? WHERE id = ?', ['FAILED', refundId]);
      logger?.error?.(`[Razorpay] Refund failed for refund ${refundId}: ${err.message}`);
    }
  }
}

module.exports = new PaymentService();
