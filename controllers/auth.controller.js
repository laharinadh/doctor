const authService = require('../services/auth.service');
const { success, created } = require('../utils/response');

class AuthController {
  async sendOtp(req, res, next) {
    try {
      let phone = req.body.phone || req.body.phoneNumber || req.body.phone_number;
      if (phone) {
        phone = phone.trim().replace(/[\s-]/g, '');
        if (!phone.startsWith('+')) {
          phone = phone.length === 10 ? '+91' + phone : '+' + phone;
        }
      }
      const result = await authService.sendOtp(phone);
      return success(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : req.body.idToken || req.body.otp;

      let phone = req.body.phone || req.body.phoneNumber || req.body.phone_number;
      if (phone) {
        phone = phone.trim().replace(/[\s-]/g, '');
        if (!phone.startsWith('+')) {
          phone = phone.length === 10 ? '+91' + phone : '+' + phone;
        }
      }
      const { role, name, email } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.verifyOtpAndAuthenticate({
        token,
        testPhone: phone,
        role,
        name,
        email,
        ip,
        userAgent,
      });

      const message = result.isNewUser ? 'User registered successfully' : 'Login successful';
      const statusCode = result.isNewUser ? 201 : 200;

      return res.status(statusCode).json({
        success: true,
        message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const result = await authService.getCurrentUser(req.user.id, req.user.role);
      return success(res, result, 'Current user profile fetched successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
