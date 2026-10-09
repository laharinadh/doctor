const service = require('../services/instant-payment.service');
const { success, created } = require('../utils/response');

exports.createOrder = async (req, res, next) => {
  try { return created(res, await service.createOrder({ patientId: req.user.patientId, doctorId: req.body.doctorId }), 'Instant consultation payment order created'); } catch (e) { next(e); }
};

exports.verify = async (req, res, next) => {
  try {
    const b = req.body || {};
    return success(res, await service.verify({ paymentId: b.instantPaymentId, patientId: req.user.patientId, razorpayOrderId: b.razorpayOrderId || b.razorpay_order_id, razorpayPaymentId: b.razorpayPaymentId || b.razorpay_payment_id, razorpaySignature: b.razorpaySignature || b.razorpay_signature }), 'Instant consultation payment verified');
  } catch (e) { next(e); }
};
