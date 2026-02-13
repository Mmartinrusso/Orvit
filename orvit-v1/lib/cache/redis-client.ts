/**
 * Redis Client Singleton
 * Provides a single Redis connection for caching across the application
 */

import Redis from 'ioredis';

// Redis configuration from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Singleton instance
let redisClient: Redis | null = null;

// Cached connection state - updated via event listeners instead of ping() per request
let redisConnected = false;

/**
 * Get Redis client instance
 * Creates a new connection if one doesn't exist
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          // Stop retrying after 3 attempts
          return null;
        }
        // Exponential backoff: 200ms, 400ms, 800ms
        return Math.min(times * 200, 800);
      },
      // Connection settings
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Reconnection settings
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    // Track connection state via event listeners
    redisClient.on('error', (err) => {
      redisConnected = false;
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      redisConnected = true;
    });

    redisClient.on('ready', () => {
      redisConnected = true;
    });

    redisClient.on('close', () => {
      redisConnected = false;
    });

    redisClient.on('end', () => {
      redisConnected = false;
    });
  }

  return redisClient;
}

/**
 * Check if Redis is available
 * Uses cached connection state from event listeners instead of ping() per request
 */
export function isRedisAvailable(): boolean {
  if (!redisClient) return false;
  return redisConnected;
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// Export the Redis type for use in other files
export type { Redis };
