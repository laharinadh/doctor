const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const rateLimit = require('../middleware/rateLimiter').paymentLimiter;
const controller = require('../controllers/instant-payment.controller');
const { ROLES } = require('../utils/constants');

router.post('/create-order', auth, role(ROLES.PATIENT), rateLimit, controller.createOrder);
router.post('/verify', auth, role(ROLES.PATIENT), rateLimit, controller.verify);
module.exports = router;
