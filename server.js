const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const { client: redisClient } = require('./config/redis');
const logger = require('./utils/logger');

const server = app.listen(config.port, async () => {
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
