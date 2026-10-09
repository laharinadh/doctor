const fs = require('fs');
const path = require('path');
const config = require('./index');

function validateSecrets(env = config.env) {
  const isProd = env === 'production';
  const errors = [];
  const warnings = [];

  if (config.auth.mode === 'test' && process.env.NODE_ENV !== 'test') {
    const msg = 'AUTH_MODE=test requires NODE_ENV=test';
    errors.push(msg);
  }

  // 1. Database Credentials Check
  if (!config.db.password || ['1234', 'password', 'root', 'admin'].includes(config.db.password)) {
    const msg = 'Database password is using an insecure default or empty value';
    if (isProd) errors.push(msg);
    else warnings.push(msg);
  }

  // 2. Razorpay Secrets Check
  if (!config.razorpay.keySecret || config.razorpay.keySecret === 'GkYCLpUIb8LKN5TmcNPg7ebF') {
    const msg = 'Razorpay Key Secret is using a placeholder/sample test key';
    if (isProd) errors.push(msg);
    else warnings.push(msg);
  }

  if (!config.razorpay.webhookSecret || config.razorpay.webhookSecret === 'sampleWebhookSecretKey') {
    const msg = 'Razorpay Webhook Secret is using an unhardened sample secret';
    if (isProd) errors.push(msg);
    else warnings.push(msg);
  }

  // 3. Firebase Service Account Check
  const serviceAccountPath = path.resolve(__dirname, '..', config.auth.firebaseServiceAccountPath);
  if (!fs.existsSync(serviceAccountPath)) {
    const msg = `Firebase service account file not found at ${serviceAccountPath}`;
    if (isProd && config.auth.mode === 'firebase') errors.push(msg);
    else warnings.push(msg);
  }

  if (errors.length > 0 && (isProd || config.auth.mode === 'test')) {
    const err = new Error(`[CRITICAL] Production Secrets Validation Failed:\n - ${errors.join('\n - ')}`);
    err.details = errors;
    throw err;
  }

  return {
    valid: errors.length === 0,
    isProduction: isProd,
    warnings,
    errors,
  };
}

function maskSecret(val) {
  if (!val || typeof val !== 'string') return '***';
  if (val.length <= 4) return '****';
  return `${val.substring(0, 2)}****${val.substring(val.length - 2)}`;
}

function getSanitizedConfig(cfg = config) {
  return {
    env: cfg.env,
    port: cfg.port,
    allowedOrigins: cfg.allowedOrigins,
    db: {
      host: cfg.db.host,
      port: cfg.db.port,
      user: cfg.db.user,
      database: cfg.db.database,
      password: maskSecret(cfg.db.password),
      ssl: cfg.db.ssl ? 'ENABLED' : 'DISABLED',
    },
    razorpay: {
      keyId: cfg.razorpay.keyId ? maskSecret(cfg.razorpay.keyId) : 'NOT_SET',
      keySecret: cfg.razorpay.keySecret ? maskSecret(cfg.razorpay.keySecret) : 'NOT_SET',
      webhookSecret: cfg.razorpay.webhookSecret ? maskSecret(cfg.razorpay.webhookSecret) : 'NOT_SET',
    },
    storage: {
      provider: cfg.storage.provider,
      baseDir: cfg.storage.baseDir,
    },
  };
}

module.exports = {
  validateSecrets,
  maskSecret,
  getSanitizedConfig,
};
