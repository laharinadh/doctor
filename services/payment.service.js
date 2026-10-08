const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const razorpay = require('../config/razorpay');
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

class PaymentService {
  async createOrder({ appointmentId, patientId, userId = null, ip = null, userAgent = null }) {
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
    let gatewayOrderId = null;

    if (razorpay) {
      try {
        const order = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: appointment.appointment_number,
          notes: {
            appointmentId: String(appointment.id),
            patientId: String(patientId),
          },
        });
        gatewayOrderId = order.id;
      } catch (err) {
        throw new BadRequestError(`Razorpay order creation failed: ${err.message}`);
      }
    } else {
      throw new BadRequestError('Razorpay payment gateway is not configured');
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
           SET gateway_order_id = ?, amount = ?, status = 'PENDING'
           WHERE id = ?`,
          [gatewayOrderId, appointment.platform_fee, paymentId]
        );
      } else {
        const [res] = await conn.query(
          `INSERT INTO payments 
            (appointment_id, patient_id, amount, currency, gateway, gateway_order_id, status)
           VALUES (?, ?, ?, 'INR', 'RAZORPAY', ?, 'PENDING')`,
          [appointmentId, patientId, appointment.platform_fee, gatewayOrderId]
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
        metadata: { gatewayOrderId, amount: appointment.platform_fee },
        ip,
        userAgent,
      });

      return {
        orderId: gatewayOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: config.razorpay.keyId || 'mock_razorpay_key',
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointment_number,
      };
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
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !config.razorpay.keySecret) {
      throw new BadRequestError('A valid Razorpay payment and server secret are required');
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (!timingSafeCompare(expectedSignature, razorpaySignature)) {
      throw new UnauthorizedError('Invalid Razorpay payment signature');
    }

    let gatewayAmount;
    if (razorpay && razorpay.payments?.fetch) {
      const gatewayPayment = await razorpay.payments.fetch(razorpayPaymentId);
      if (gatewayPayment.order_id !== razorpayOrderId || gatewayPayment.status !== 'captured') {
        throw new UnauthorizedError('Razorpay payment is not captured for this order');
      }
      gatewayAmount = gatewayPayment.amount;
    } else {
      throw new BadRequestError('Razorpay payment gateway is not configured');
    }

    return await this.confirmPaymentAndAppointment({
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId || `pay_mock_${Date.now()}`,
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

    await this.ensureWebhookTable();

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const webhookId = eventId || payload.id || `whk_${event}_${payload.payload?.payment?.entity?.id || payload.payload?.order?.entity?.id || payloadHash.substring(0, 16)}`;

    try {
      await db.query(
        'INSERT INTO processed_webhooks (webhook_id, event_type, payload_hash) VALUES (?, ?, ?)',
        [webhookId, event || 'unknown', payloadHash]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { received: true, deduplicated: true, webhookId, message: 'Webhook event already processed (replay ignored)' };
      }
      throw err;
    }

    if (!event) {
      return {
        received: true,
        webhookId,
        message: 'Webhook event received',
      };
    }

    let confirmationResult = { received: true, event };

    if (event === 'order.paid' || event === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const confirmResult = await this.confirmPaymentAndAppointment({
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          gatewaySignature: signatureHeader,
          gatewayAmount: paymentEntity.amount,
      });

      confirmationResult = { received: true, ...confirmResult };
    }

    return confirmationResult;
  }

  async confirmPaymentAndAppointment({ gatewayOrderId, gatewayPaymentId, gatewaySignature, expectedAppointmentId = null, expectedPatientId = null, gatewayAmount = null, userId = null, ip = null, userAgent = null }) {
    return await db.withTransaction(async (conn) => {
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

      if (!appointment || ![APPOINTMENT_STATUS.HELD, APPOINTMENT_STATUS.PAYMENT_PENDING].includes(appointment.status)) {
        throw new ConflictError('Appointment is no longer payable');
      }
      if (appointment.hold_expires_at && new Date(appointment.hold_expires_at) < new Date()) {
        throw new ConflictError('Appointment hold has expired');
      }

      // 1. Update payment status to SUCCESS
      await conn.query(
        `UPDATE payments 
         SET status = 'SUCCESS', gateway_payment_id = ?, gateway_signature = ?
         WHERE id = ?`,
        [gatewayPaymentId, gatewaySignature, payment.id]
      );

      // 2. Update appointment status to CONFIRMED and clear hold timer
      await conn.query(
        `UPDATE appointments 
         SET status = 'CONFIRMED', payment_id = ?, hold_expires_at = NULL
         WHERE id = ?`,
        [payment.id, appointment.id]
      );

      // 3. Log appointment event
      await conn.query(
        `INSERT INTO appointment_events (appointment_id, from_status, to_status, changed_by, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [appointment.id, appointment.status, APPOINTMENT_STATUS.CONFIRMED, userId, 'Platform fee payment confirmed']
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
          type: 'APPOINTMENT_CONFIRMED',
          title: 'Appointment Confirmed',
          body: `Your appointment ${appointment.appointment_number} on ${appointment.appointment_date} at ${appointment.start_time} has been confirmed.`,
        });
      }

      // Doctor notification
      const [doctorUsers] = await conn.query('SELECT user_id FROM doctors WHERE id = ?', [appointment.doctor_id]);
      if (doctorUsers.length) {
        await notificationService.create({
          userId: doctorUsers[0].user_id,
          type: 'NEW_APPOINTMENT',
          title: 'New Consultation Booked',
          body: `New appointment ${appointment.appointment_number} scheduled for ${appointment.appointment_date} at ${appointment.start_time}.`,
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
      });

      return {
        success: true,
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointment_number,
        status: APPOINTMENT_STATUS.CONFIRMED,
        message: 'Payment verified and appointment confirmed successfully',
      };
    });
  }
}

module.exports = new PaymentService();
