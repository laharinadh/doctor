const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { timingSafeCompare } = require('../../utils/helpers');

function computeRazorpaySignature(orderId, paymentId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

function verifyPaymentSignature(orderId, paymentId, signature, secret) {
  const expected = computeRazorpaySignature(orderId, paymentId, secret);
  return timingSafeCompare(expected, signature);
}

test.describe('White Box Tests: Cryptographic Payment Signatures & HMAC Verification', () => {
  const testSecret = 'sampleWebhookSecretKey_123';
  const orderId = 'order_9A33X0192';
  const paymentId = 'pay_888ZZ1010';

  test('Computes repeatable, deterministic 64-character hex HMAC-SHA256', () => {
    const sig1 = computeRazorpaySignature(orderId, paymentId, testSecret);
    const sig2 = computeRazorpaySignature(orderId, paymentId, testSecret);

    assert.equal(sig1, sig2);
    assert.equal(sig1.length, 64);
    assert.match(sig1, /^[a-f0-9]{64}$/);
  });

  test('Valid HMAC matches cleanly using timingSafeCompare', () => {
    const validSignature = computeRazorpaySignature(orderId, paymentId, testSecret);
    const isVerified = verifyPaymentSignature(orderId, paymentId, validSignature, testSecret);

    assert.equal(isVerified, true);
  });

  test('Tampered signature character fails verification', () => {
    const validSignature = computeRazorpaySignature(orderId, paymentId, testSecret);
    // Tamper the first character
    const tampered = (validSignature[0] === 'a' ? 'b' : 'a') + validSignature.slice(1);
    const isVerified = verifyPaymentSignature(orderId, paymentId, tampered, testSecret);

    assert.equal(isVerified, false);
  });

  test('Tampered order ID payload fails verification', () => {
    const validSignature = computeRazorpaySignature(orderId, paymentId, testSecret);
    const isVerified = verifyPaymentSignature('order_TAMPERED', paymentId, validSignature, testSecret);

    assert.equal(isVerified, false);
  });

  test('Tampered secret key fails verification', () => {
    const validSignature = computeRazorpaySignature(orderId, paymentId, testSecret);
    const isVerified = verifyPaymentSignature(orderId, paymentId, validSignature, 'wrong_secret');

    assert.equal(isVerified, false);
  });

  test('Mismatched signature length handles gracefully without throw', () => {
    const isVerified = verifyPaymentSignature(orderId, paymentId, 'too-short', testSecret);
    assert.equal(isVerified, false);
  });
});
