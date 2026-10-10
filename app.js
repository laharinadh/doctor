const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const { NotFoundError } = require('./utils/errors');

const app = express();

// Disable X-Powered-By
app.disable('x-powered-by');

// Trust reverse proxy if configured (ALB, Nginx, Cloudflare)
if (config.security && config.security.trustProxy) {
  app.set('trust proxy', 1);
}

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: config.security && config.security.hsts
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Credentials cannot be safely combined with a wildcard origin. Only
      // explicitly configured origins may receive browser CORS headers.
      if (config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'x-verify'],
    credentials: true,
  })
);

// Global rate limiting
app.use(globalLimiter);

// JSON body parser with rawBody capture for webhook signature verification
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Mount API v1 routes
app.use('/api/v1', apiRoutes);

// Catch-all 404 handler
app.use((req, res, next) => {
  next(new NotFoundError(`Resource not found: ${req.method} ${req.originalUrl}`));
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
