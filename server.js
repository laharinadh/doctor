const app = require('./app');
const http = require('http');
const WebSocket = require('ws');
const config = require('./config');
const db = require('./config/database');
const { client: redisClient } = require('./config/redis');
const logger = require('./utils/logger');
const { validateSecrets } = require('./config/secretsValidator');
const instantConsultation = require('./services/instant-consultation.service');

const secretStatus = validateSecrets();
for (const warning of secretStatus.warnings) logger.warn(`[Secrets] ${warning}`);

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const rooms = new Map();

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/api/v1/instant-consultations/ws') return socket.destroy();
    const identity = instantConsultation.verifyRoomToken(url.searchParams.get('token'));
    const consultation = await instantConsultation.get(identity.id, identity.userId, identity.role);
    if (consultation.status !== 'ACTIVE' || new Date(consultation.expires_at) <= new Date()) throw new Error('Consultation room is no longer active');
    const peers = rooms.get(identity.id) || new Set();
    if (peers.size >= 2 || [...peers].some(peer => peer.role === identity.role)) {
      socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, ws => {
      ws.roomId = identity.id; ws.userId = identity.userId; ws.role = identity.role;
      peers.add(ws); rooms.set(identity.id, peers);
      ws.send(JSON.stringify({ type: 'room', consultationId: identity.id, peerCount: peers.size }));
      ws.on('message', async raw => {
        try {
          const message = JSON.parse(raw.toString());
          if (!['ready', 'OFFER', 'ANSWER', 'ICE', 'HANGUP'].includes(message.type)) return;
          if (message.type === 'ready') {
            for (const peer of peers) if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ type: 'peer-ready' }));
            return;
          }
          if (message.type !== 'HANGUP') await instantConsultation.signal(identity.id, identity.userId, identity.role, message.type, message.payload);
          for (const peer of peers) if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ type: message.type, payload: message.payload }));
          if (message.type === 'HANGUP') await instantConsultation.end(identity.id, identity.userId, identity.role).catch(() => {});
        } catch (e) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: e.message })); }
      });
      ws.on('close', () => { peers.delete(ws); if (!peers.size) rooms.delete(identity.id); });
    });
  } catch (e) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }
});

server.listen(config.port, async () => {
  logger.info(`🚀 Server running in [${config.env}] mode on port ${config.port}`);
  logger.info(`🔗 Base API endpoint: http://localhost:${config.port}/api/v1`);

  // Verify Database connectivity
  try {
    const connection = await db.getConnection();
    logger.info('✅ MySQL database connection pool established successfully');
    connection.release();
  } catch (err) {
    logger.error('❌ Failed to connect to MySQL database:', err.message);
    logger.warn('ℹ️ Please ensure MySQL is running and database schema is imported using: mysql -u root -p < database/schema.sql');
  }

  // Check Redis status
  if (config.redis.enabled && redisClient) {
    try {
      await redisClient.ping();
      logger.info('✅ Redis cache connected successfully');
    } catch (err) {
      logger.warn('⚠️ Redis connection failed. Using in-memory fallback cache.');
    }
  } else {
    logger.info('ℹ️ Redis disabled/using built-in in-memory fallback cache');
  }
});

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await db.end();
      logger.info('MySQL connection pool closed.');
    } catch (err) {
      logger.error('Error closing MySQL pool:', err);
    }

    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.quit();
        logger.info('Redis connection closed.');
      } catch (err) {
        logger.error('Error closing Redis:', err);
      }
    }

    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
