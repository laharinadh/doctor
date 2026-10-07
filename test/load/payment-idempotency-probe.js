const request = require('supertest');
const app = require('../../app');
const db = require('../../config/database');

async function main() {
  if (process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('Mock-only probe refused while Razorpay credentials are configured.');
  }
  const [[payment]] = await db.query(
    `SELECT p.gateway_order_id, p.appointment_id, pt.user_id
     FROM payments p JOIN appointments a ON a.id = p.appointment_id
     JOIN patients pt ON pt.id = a.patient_id WHERE p.status = 'SUCCESS' LIMIT 1`
  );
  if (!payment) throw new Error('No successful mock payment available for idempotency probe');

  const verifyResponses = await Promise.all(
    Array.from({ length: 20 }, () => request(app)
      .post('/api/v1/payments/verify')
      .set('x-test-user-id', String(payment.user_id))
      .send({
        appointmentId: payment.appointment_id,
        razorpayOrderId: payment.gateway_order_id,
        razorpayPaymentId: 'pay_duplicate_test',
        razorpaySignature: 'mock_signature',
      })
      .timeout({ deadline: 3000 }))
  );

  const webhookBody = JSON.stringify({
    id: 'evt_duplicate_probe',
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_duplicate_test', order_id: payment.gateway_order_id, status: 'captured' } } },
  });
  const webhookResponses = await Promise.all(
    Array.from({ length: 10 }, () => request(app)
      .post('/api/v1/payments/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', 'evt_duplicate_probe')
      .send(webhookBody)
      .timeout({ deadline: 3000 }))
  );

  const counts = (responses) => responses.reduce((result, response) => {
    result[response.status] = (result[response.status] || 0) + 1;
    return result;
  }, {});
  const [[paymentCount]] = await db.query('SELECT COUNT(*) AS count FROM payments WHERE appointment_id = ? AND status = \'SUCCESS\'', [payment.appointment_id]);
  const [[consultationCount]] = await db.query('SELECT COUNT(*) AS count FROM consultations WHERE appointment_id = ?', [payment.appointment_id]);
  const [[webhookCount]] = await db.query("SELECT COUNT(*) AS count FROM processed_webhooks WHERE webhook_id = 'evt_duplicate_probe'");
  console.log(JSON.stringify({
    verificationStatuses: counts(verifyResponses),
    webhookStatuses: counts(webhookResponses),
    successfulPaymentRows: Number(paymentCount.count),
    consultationRows: Number(consultationCount.count),
    processedWebhookRows: Number(webhookCount.count),
  }, null, 2));
  await db.end();
}

main().catch(async (error) => {
  console.error(error.stack || error);
  await db.end();
  process.exitCode = 1;
});
