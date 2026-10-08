const paymentService = require('../services/payment.service');
const { success, created } = require('../utils/response');
const { UnauthorizedError } = require('../utils/errors');

class PaymentController {
  async createOrder(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const appointmentId = req.body.appointmentId || req.body.appointment_id;

      const order = await paymentService.createOrder({
        appointmentId,
        patientId: req.user.patientId,
        userId: req.user.id,
        ip,
        userAgent,
      });

      return created(res, order, 'Payment order created successfully');
    } catch (err) {
      next(err);
    }
  }

  async verifyPayment(req, res, next) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const raw = req.body || {};
      const appointmentId = raw.appointmentId || raw.appointment_id;
      const razorpayOrderId = raw.razorpayOrderId || raw.razorpay_order_id;
      const razorpayPaymentId = raw.razorpayPaymentId || raw.razorpay_payment_id;
      const razorpaySignature = raw.razorpaySignature || raw.razorpay_signature;

      const result = await paymentService.verifyClientPayment({
        appointmentId,
        patientId: req.user.patientId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        userId: req.user.id,
        ip,
        userAgent,
      });

      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const eventId = req.headers['x-razorpay-event-id'];
      // Raw body stored by express json verify or string
      if (!req.rawBody) {
        throw new UnauthorizedError('Signed raw webhook body is required');
      }
      const rawBody = req.rawBody;

      const result = await paymentService.handleWebhook(rawBody, signature, eventId);
      return res.status(200).json({ status: 'ok', ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PaymentController();
