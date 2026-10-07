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
    console.warn('⚠️ Warning: Razorpay initialization failed. Running in mock/fallback mode.');
  }
}

module.exports = razorpayInstance;
