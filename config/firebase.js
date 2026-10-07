const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const config = require('./index');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  if (config.auth.mode === 'test') {
    // Test mode does not require Firebase service account
    return admin;
  }

  const serviceAccountPath = path.resolve(__dirname, '..', config.auth.firebaseServiceAccountPath);
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      initialized = true;
    } catch (err) {
      console.warn('⚠️ Warning: Failed to parse Firebase service account JSON. Running in fallback mode.');
    }
  } else {
    console.warn(`⚠️ Warning: Firebase service account file not found at ${serviceAccountPath}. Real OTP verification will fail unless AUTH_MODE=test is set.`);
  }

  return admin;
}

initFirebase();

module.exports = admin;
