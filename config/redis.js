const Redis = require('ioredis');
const config = require('./index');

let redisClient = null;

// In-memory fallback if Redis is disabled or offline
const memoryCache = new Map();

if (config.redis.enabled) {
  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('⚠️ Redis connection attempts exceeded. Falling back to in-memory cache.');
          return null; // stop reconnecting
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis error:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ Redis client init failed, using in-memory cache.');
    redisClient = null;
  }
}

const cacheService = {
  async get(key) {
    if (redisClient && redisClient.status === 'ready') {
      return redisClient.get(key);
    }
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key, value, expirySeconds = 0) {
    if (redisClient && redisClient.status === 'ready') {
      if (expirySeconds > 0) {
        return redisClient.set(key, value, 'EX', expirySeconds);
      }
      return redisClient.set(key, value);
    }
    memoryCache.set(key, {
      value,
      expiresAt: expirySeconds > 0 ? Date.now() + expirySeconds * 1000 : null,
    });
    return 'OK';
  },

  async del(key) {
    if (redisClient && redisClient.status === 'ready') {
      return redisClient.del(key);
    }
    return memoryCache.delete(key) ? 1 : 0;
  },
};

module.exports = {
  client: redisClient,
  cache: cacheService,
};
