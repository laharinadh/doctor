const logger = require('../utils/logger');
const config = require('../config');

class SmsService {
  /**
   * Dispatch real-time SMS OTP to recipient phone number
   * Supports: Fast2SMS, Twilio, 2Factor.in, and Real-Time Gateway Logging
   */
  async sendSms({ phone, message, otp }) {
    // 1. Fast2SMS Integration (Instant Indian SMS Gateway)
    if (process.env.FAST2SMS_API_KEY) {
      try {
        const clean10 = phone.replace(/^\+91/, '').replace(/\D/g, '');
        const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMS_API_KEY}&route=otp&variables_values=${otp}&numbers=${clean10}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.return !== true) throw new Error('Fast2SMS rejected the request');
        logger.info('[Fast2SMS] SMS dispatched to masked recipient');
        return { sent: true, provider: 'Fast2SMS' };
      } catch (err) {
        logger.error(`[Fast2SMS Error] Failed to send SMS: ${err.message}`);
      }
    }

    // 2. Twilio SMS Integration
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_PHONE) {
      try {
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const body = new URLSearchParams({
          To: phone,
          From: process.env.TWILIO_FROM_PHONE,
          Body: message || `Your OTP verification code is ${otp}. Valid for 5 minutes. Do not share this code.`,
        });
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.status === 'failed' || data.error_code) throw new Error('Twilio rejected the request');
        logger.info('[Twilio] SMS dispatched');
        return { sent: true, provider: 'Twilio' };
      } catch (err) {
        logger.error(`[Twilio Error] Failed to send SMS: ${err.message}`);
      }
    }

    // 3. 2Factor.in SMS Gateway
    if (process.env.TWO_FACTOR_API_KEY) {
      try {
        const cleanPhone = phone.startsWith('+') ? phone : '+91' + phone;
        const url = `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${cleanPhone}/${otp}/OTP1`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || (data.Status && data.Status !== 'Success')) throw new Error('2Factor rejected the request');
        logger.info('[2Factor] SMS dispatched');
        return { sent: true, provider: '2Factor' };
      } catch (err) {
        logger.error(`[2Factor Error] Failed to send SMS: ${err.message}`);
      }
    }

    if (config.env !== 'production' && config.auth.mode === 'test') {
      return { sent: true, provider: 'TestGateway' };
    }

    throw new Error('No SMS provider is configured');
  }
}

module.exports = new SmsService();
