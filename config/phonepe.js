const crypto = require('crypto');
const https = require('https');
const config = require('./index');

const PAY_PATH = '/pg/v1/pay';

function checksum(value) {
  return `${crypto.createHash('sha256').update(value + config.phonepe.saltKey).digest('hex')}###${config.phonepe.saltIndex}`;
}

function request(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.phonepe.baseUrl);
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = https.request(url, {
      method: payload ? 'POST' : 'GET',
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = { raw: data }; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(parsed.message || `PhonePe API returned HTTP ${res.statusCode}`));
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function createPayment(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return request(PAY_PATH, { request: encoded }, { 'X-VERIFY': checksum(encoded) });
}

function getPaymentStatus(merchantTransactionId) {
  const path = `/pg/v1/status/${encodeURIComponent(config.phonepe.merchantId)}/${encodeURIComponent(merchantTransactionId)}`;
  return request(path, undefined, { 'X-VERIFY': checksum(path) });
}

function verifyCallback(encoded, signature) {
  return typeof encoded === 'string' && typeof signature === 'string' && signature === checksum(encoded);
}

module.exports = { createPayment, getPaymentStatus, verifyCallback };
