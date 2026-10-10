const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const validate = require('../middleware/validate');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { ROLES } = require('../utils/constants');
const { createPaymentOrderSchema, verifyPaymentSchema } = require('../validators/appointment.validator');

// Razorpay server webhook (no auth header, signature verified by HMAC)
router.post('/razorpay/webhook', paymentController.handleWebhook);
router.post('/phonepe/callback', paymentController.handlePhonePeCallback);

// Protected payment endpoints
router.post(
  '/create-order',
  authenticate,
  authorize(ROLES.PATIENT),
  paymentLimiter,
  validate(createPaymentOrderSchema),
  paymentController.createOrder
);

router.post(
  '/verify',
  authenticate,
  authorize(ROLES.PATIENT),
  paymentLimiter,
  validate(verifyPaymentSchema),
  paymentController.verifyPayment
);

router.post(
  '/phonepe/status',
  authenticate,
  authorize(ROLES.PATIENT),
  paymentLimiter,
  validate(verifyPaymentSchema),
  paymentController.verifyPhonePeStatus
);

module.exports = router;
