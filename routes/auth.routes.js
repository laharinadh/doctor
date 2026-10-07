const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { sendOtpSchema, verifyOtpSchema } = require('../validators/auth.validator');

// POST /api/v1/auth/send-otp
router.post('/send-otp', authLimiter, validate(sendOtpSchema), authController.sendOtp);

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);

// GET /api/v1/auth/me
router.get('/me', authenticate, authController.me);

module.exports = router;
