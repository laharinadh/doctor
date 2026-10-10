const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim()),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'doctor_consultation',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enabled: process.env.REDIS_ENABLED === 'true',
  },

  auth: {
    mode: process.env.AUTH_MODE || 'firebase', // 'test' | 'firebase'
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'config/firebase-service-account.json',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  phonepe: {
    merchantId: process.env.PHONEPE_MERCHANT_ID || '',
    saltKey: process.env.PHONEPE_SALT_KEY || '',
    saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
    baseUrl: process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    redirectUrl: process.env.PHONEPE_REDIRECT_URL || '',
    callbackUrl: process.env.PHONEPE_CALLBACK_URL || '',
  },

  platform: {
    defaultFee: parseFloat(process.env.DEFAULT_PLATFORM_FEE || '99.00'),
    appointmentHoldMinutes: parseInt(process.env.APPOINTMENT_HOLD_MINUTES || '10', 10),
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local', // 'local' | 'gcs' | 's3'
    baseDir: path.resolve(__dirname, '..', process.env.LOCAL_STORAGE_DIR || 'storage'),
    maxRecordSizeBytes: parseInt(process.env.MAX_RECORD_SIZE_BYTES || '102400', 10), // 100 KB
    maxPhotoSizeBytes: parseInt(process.env.MAX_PHOTO_SIZE_BYTES || '5242880', 10),   // 5 MB
    maxVideoSizeBytes: parseInt(process.env.MAX_VIDEO_SIZE_BYTES || '52428800', 10), // 50 MB
  },

  security: {
    hsts: process.env.ENABLE_HSTS === 'true' || process.env.NODE_ENV === 'production',
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production',
    instantRoomSecret: process.env.INSTANT_ROOM_SECRET || process.env.JWT_SECRET || 'local-instant-room-secret-change-me',
  },
};

module.exports = config;
