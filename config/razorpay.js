const Razorpay = require('razorpay');
const config = require('./index');

let razorpayInstance = null;

if (config.razorpay.keyId && config.razorpay.keySecret) {
  try {
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  } catch (err) {
    console.warn('⚠️ Warning: Razorpay initialization failed. Payments are disabled until valid credentials are configured.');
  }
}

module.exports = razorpayInstance;
