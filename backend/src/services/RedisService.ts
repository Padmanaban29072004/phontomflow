import { createClient, RedisClientType } from 'redis';
import { logger } from '@/utils/logger';

export class RedisService {
  private client: RedisClientType;
  private _isConnected: boolean = false;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const maxRetries = isDevelopment ? 3 : 10; // Fewer retries in development
    
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > maxRetries) {
            if (!isDevelopment) {
              logger.error(`Redis connection failed after ${maxRetries} retries`);
            }
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 200, 2000); // Less aggressive backoff
        },
        connectTimeout: isDevelopment ? 2000 : 5000, // Shorter timeout in development
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this._isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('error', (err) => {
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        logger.error('Redis client error:', err);
      }
      this._isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this._isConnected = false;
    });

    this.client.on('reconnecting', () => {
      if (process.env.NODE_ENV !== 'development') {
        logger.info('Redis client reconnecting...');
      }
    });
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connection established');
    } catch (error) {
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        logger.error('Failed to connect to Redis:', error);
      }
      throw error;
    }
  }

  /**
   * Check if Redis is available
   */
  public isRedisAvailable(): boolean {
    return this._isConnected && this.client.isOpen;
  }

  /**
   * Safe operation wrapper for Redis operations
   */
  private async safeOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    if (!this.isRedisAvailable()) {
      logger.debug('Redis not available, using fallback value');
      return fallback;
    }
    
    try {
      return await operation();
    } catch (error) {
      logger.warn('Redis operation failed, using fallback:', error);
      return fallback;
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Set a key-value pair with optional expiration
   */
  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.safeOperation(async () => {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    }, undefined);
  }

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    return await this.safeOperation(async () => {
      return await this.client.get(key);
    }, null);
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.del(key);
    }, 0);
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    return await this.safeOperation(async () => {
      const result = await this.client.exists(key);
      return result === 1;
    }, false);
  }

  /**
   * Set expiration time for a key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    return await this.safeOperation(async () => {
      return await this.client.expire(key, seconds);
    }, false);
  }

  /**
   * Get time to live for a key
   */
  public async ttl(key: string): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.ttl(key);
    }, -1);
  }

  /**
   * Increment a counter
   */
  public async incr(key: string): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.incr(key);
    }, 0);
  }

  /**
   * Increment a counter by a specific amount
   */
  public async incrBy(key: string, increment: number): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.incrBy(key, increment);
    }, 0);
  }

  /**
   * Add to a set
   */
  public async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.sAdd(key, members);
    }, 0);
  }

  /**
   * Get members of a set
   */
  public async smembers(key: string): Promise<string[]> {
    return await this.safeOperation(async () => {
      return await this.client.sMembers(key);
    }, []);
  }

  /**
   * Check if member exists in set
   */
  public async sismember(key: string, member: string): Promise<boolean> {
    return await this.safeOperation(async () => {
      return await this.client.sIsMember(key, member);
    }, false);
  }

  /**
   * Add to a sorted set
   */
  public async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.zAdd(key, { score, value: member });
    }, 0);
  }

  /**
   * Get range from sorted set
   */
  public async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.safeOperation(async () => {
      return await this.client.zRange(key, start, stop);
    }, []);
  }

  /**
   * Get range from sorted set with scores
   */
  public async zrangeWithScores(key: string, start: number, stop: number): Promise<Array<{ score: number; value: string }>> {
    return await this.safeOperation(async () => {
      return await this.client.zRangeWithScores(key, start, stop);
    }, []);
  }

  /**
   * Push to a list
   */
  public async lpush(key: string, ...values: string[]): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.lPush(key, values);
    }, 0);
  }

  /**
   * Pop from a list
   */
  public async lpop(key: string): Promise<string | null> {
    return await this.safeOperation(async () => {
      return await this.client.lPop(key);
    }, null);
  }

  /**
   * Get list range
   */
  public async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.safeOperation(async () => {
      return await this.client.lRange(key, start, stop);
    }, []);
  }

  /**
   * Trim list to specified range
   */
  public async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.safeOperation(async () => {
      await this.client.lTrim(key, start, stop);
    }, undefined);
  }

  /**
   * Get list length
   */
  public async llen(key: string): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.lLen(key);
    }, 0);
  }

  /**
   * Set hash field
   */
  public async hset(key: string, field: string, value: string): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.hSet(key, field, value);
    }, 0);
  }

  /**
   * Get hash field
   */
  public async hget(key: string, field: string): Promise<string | null> {
    return await this.safeOperation(async () => {
      const result = await this.client.hGet(key, field);
      return result || null;
    }, null);
  }

  /**
   * Get all hash fields
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    return await this.safeOperation(async () => {
      return await this.client.hGetAll(key);
    }, {});
  }

  /**
   * Delete hash field
   */
  public async hdel(key: string, ...fields: string[]): Promise<number> {
    return await this.safeOperation(async () => {
      return await this.client.hDel(key, fields);
    }, 0);
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Get Redis client instance
   */
  public getClient(): RedisClientType {
    return this.client;
  }

  /**
   * Flush all data (use with caution)
   */
  public async flushall(): Promise<void> {
    await this.safeOperation(async () => {
      await this.client.flushAll();
      logger.warn('Redis database flushed');
    }, undefined);
  }

  /**
   * Get database info
   */
  public async info(): Promise<string> {
    return await this.safeOperation(async () => {
      return await this.client.info();
    }, '');
  }

  /**
   * Get memory usage
   */
  public async memoryUsage(): Promise<number> {
    return await this.safeOperation(async () => {
      const info = await this.client.info('memory');
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      return usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
    }, 0);
  }
}
