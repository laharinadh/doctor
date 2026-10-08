const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const doctorRoutes = require('./doctor.routes');
const patientRoutes = require('./patient.routes');
const paymentRoutes = require('./payment.routes');
const notificationRoutes = require('./notification.routes');

const db = require('../config/database');

// Health check endpoint (Liveness Probe)
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'Doctor Consultation API service is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Deep health check endpoint (Readiness Probe & Production Monitoring)
router.get('/health/deep', async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'down';
  let dbLatencyMs = null;

  try {
    const [result] = await db.query('SELECT 1 AS alive');
    if (result && result.length && result[0].alive === 1) {
      dbStatus = 'healthy';
      dbLatencyMs = Date.now() - startTime;
    }
  } catch (err) {
    dbError = 'unavailable';
  }

  const isHealthy = dbStatus === 'healthy';

  const payload = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    components: {
      api: { status: 'healthy', responseTimeMs: Date.now() - startTime },
      database: { status: dbStatus, latencyMs: dbLatencyMs },
    },
  };

  res.status(isHealthy ? 200 : 503).json(payload);
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/doctor', doctorRoutes);
router.use('/patient', patientRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
