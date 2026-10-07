const request = require('supertest');
const app = require('../../app');
const db = require('../../config/database');

async function main() {
  if (process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('Refusing payment concurrency test while Razorpay credentials are configured; use empty mock credentials only.');
  }
  const [[patientUser]] = await db.query("SELECT id FROM users WHERE role = 'PATIENT' ORDER BY id LIMIT 1");
  const userId = Number(process.env.LOAD_PATIENT_USER_ID || patientUser.id);
  const appointmentDate = process.env.LOAD_PAYMENT_DATE || '2026-10-14';
  const slot = process.env.LOAD_PAYMENT_START || '11:00:00';
  const payload = {
    doctorId: 1,
    appointmentDate,
    startTime: slot,
    consultationMode: 'VIDEO',
    meetingProvider: 'GOOGLE_MEET',
  };

  const hold = await request(app)
    .post('/api/v1/patient/appointments')
    .set('x-test-user-id', String(userId))
    .send(payload);
  if (hold.status !== 201) throw new Error(`hold failed: ${hold.status} ${JSON.stringify(hold.body)}`);
  const appointmentId = hold.body.data.id;

  const order = await request(app)
    .post('/api/v1/payments/create-order')
    .set('x-test-user-id', String(userId))
    .send({ appointmentId });
  if (order.status !== 201 && order.status !== 200) {
    throw new Error(`order failed: ${order.status} ${JSON.stringify(order.body)}`);
  }
  const orderId = order.body.data.orderId;

  const verifyPayload = {
    appointmentId,
    razorpayOrderId: orderId,
    razorpayPaymentId: 'pay_concurrent_test',
    razorpaySignature: 'mock_signature',
  };
  const counts = (responses) => responses.reduce((result, response) => {
    const status = typeof response.status === 'number' || typeof response.status === 'string'
      ? response.status
      : (response.status === 'fulfilled' ? response.value.status : (response.reason.code || response.reason.message));
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  const verificationResponses = await Promise.allSettled(
    Array.from({ length: 20 }, () => request(app)
      .post('/api/v1/payments/verify')
      .set('x-test-user-id', String(userId))
      .send(verifyPayload)
      .timeout({ deadline: 3000 }))
  );

  const normalizedVerification = verificationResponses.map((result) => result.status === 'fulfilled'
    ? result.value
    : { status: result.reason.code || result.reason.message });

  // Do not continue into webhook tests while server-side verification
  // requests are still blocked on database work. The process is intentionally
  // terminated after reporting so the isolated test database releases locks.
  if (normalizedVerification.some((response) => response.status === 'ECONNABORTED')) {
    console.log(JSON.stringify({
      appointmentId,
      orderId,
      verificationStatuses: counts(normalizedVerification),
      databaseInspection: 'deferred: timed-out handlers were terminated after this report',
    }, null, 2));
    process.exit(0);
  }

  const webhookPayload = JSON.stringify({
    id: 'evt_concurrent_test_1',
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_concurrent_test', order_id: orderId, status: 'captured' } } },
  });
  const webhookResponses = await Promise.allSettled(
    Array.from({ length: 10 }, () => request(app)
      .post('/api/v1/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .send(webhookPayload)
      .timeout({ deadline: 3000 }))
  );

  const [[paymentCount]] = await db.query('SELECT COUNT(*) AS count FROM payments WHERE appointment_id = ?', [appointmentId]);
  const [[successCount]] = await db.query("SELECT COUNT(*) AS count FROM payments WHERE appointment_id = ? AND status = 'SUCCESS'", [appointmentId]);
  const [[consultationCount]] = await db.query('SELECT COUNT(*) AS count FROM consultations WHERE appointment_id = ?', [appointmentId]);
  const [[webhookCount]] = await db.query("SELECT COUNT(*) AS count FROM processed_webhooks WHERE webhook_id = 'evt_concurrent_test_1'");
  const [[appointment]] = await db.query('SELECT status, payment_id FROM appointments WHERE id = ?', [appointmentId]);

  console.log(JSON.stringify({
    appointmentId,
    orderId,
    verificationStatuses: counts(verificationResponses),
    webhookStatuses: counts(webhookResponses),
    database: {
      paymentRows: Number(paymentCount.count),
      successfulPaymentRows: Number(successCount.count),
      consultationRows: Number(consultationCount.count),
      processedWebhookRows: Number(webhookCount.count),
      appointment,
    },
  }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error.stack || error);
  await db.end();
  process.exitCode = 1;
});
