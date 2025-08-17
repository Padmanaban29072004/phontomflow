import { createClient, RedisClientType } from 'redis';
import { logger } from '@/utils/logger';

export class RedisService {
  private client: RedisClientType;
  private _isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
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
      logger.error('Redis client error:', err);
      this._isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this._isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
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
      logger.error('Failed to connect to Redis:', error);
      throw error;
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
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Error setting Redis key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Error getting Redis key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Error deleting Redis key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking Redis key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(`Error setting expiration for Redis key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get time to live for a key
   */
  public async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Error getting TTL for Redis key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Increment a counter
   */
  public async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Error incrementing Redis key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment a counter by a specific amount
   */
  public async incrBy(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrBy(key, increment);
    } catch (error) {
      logger.error(`Error incrementing Redis key ${key} by ${increment}:`, error);
      throw error;
    }
  }

  /**
   * Add to a set
   */
  public async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sAdd(key, members);
    } catch (error) {
      logger.error(`Error adding to Redis set ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get members of a set
   */
  public async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error(`Error getting Redis set members for ${key}:`, error);
      return [];
    }
  }

  /**
   * Check if member exists in set
   */
  public async sismember(key: string, member: string): Promise<boolean> {
    try {
      return await this.client.sIsMember(key, member);
    } catch (error) {
      logger.error(`Error checking Redis set membership for ${key}:`, error);
      return false;
    }
  }

  /**
   * Add to a sorted set
   */
  public async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zAdd(key, { score, value: member });
    } catch (error) {
      logger.error(`Error adding to Redis sorted set ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get range from sorted set
   */
  public async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zRange(key, start, stop);
    } catch (error) {
      logger.error(`Error getting Redis sorted set range for ${key}:`, error);
      return [];
    }
  }

  /**
   * Get range from sorted set with scores
   */
  public async zrangeWithScores(key: string, start: number, stop: number): Promise<Array<{ score: number; value: string }>> {
    try {
      return await this.client.zRangeWithScores(key, start, stop);
    } catch (error) {
      logger.error(`Error getting Redis sorted set range with scores for ${key}:`, error);
      return [];
    }
  }

  /**
   * Push to a list
   */
  public async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lPush(key, values);
    } catch (error) {
      logger.error(`Error pushing to Redis list ${key}:`, error);
      throw error;
    }
  }

  /**
   * Pop from a list
   */
  public async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lPop(key);
    } catch (error) {
      logger.error(`Error popping from Redis list ${key}:`, error);
      return null;
    }
  }

  /**
   * Get list range
   */
  public async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      logger.error(`Error getting Redis list range for ${key}:`, error);
      return [];
    }
  }

  /**
   * Trim list to specified range
   */
  public async ltrim(key: string, start: number, stop: number): Promise<void> {
    try {
      await this.client.lTrim(key, start, stop);
    } catch (error) {
      logger.error(`Error trimming Redis list ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get list length
   */
  public async llen(key: string): Promise<number> {
    try {
      return await this.client.lLen(key);
    } catch (error) {
      logger.error(`Error getting Redis list length for ${key}:`, error);
      return 0;
    }
  }

  /**
   * Set hash field
   */
  public async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error(`Error setting Redis hash field ${key}:${field}:`, error);
      throw error;
    }
  }

  /**
   * Get hash field
   */
  public async hget(key: string, field: string): Promise<string | null> {
    try {
      const result = await this.client.hGet(key, field);
      return result || null;
    } catch (error) {
      logger.error(`Error getting Redis hash field ${key}:${field}:`, error);
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error(`Error getting Redis hash fields for ${key}:`, error);
      return {};
    }
  }

  /**
   * Delete hash field
   */
  public async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await this.client.hDel(key, fields);
    } catch (error) {
      logger.error(`Error deleting Redis hash fields for ${key}:`, error);
      return 0;
    }
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
    try {
      await this.client.flushAll();
      logger.warn('Redis database flushed');
    } catch (error) {
      logger.error('Error flushing Redis database:', error);
      throw error;
    }
  }

  /**
   * Get database info
   */
  public async info(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      logger.error('Error getting Redis info:', error);
      return '';
    }
  }

  /**
   * Get memory usage
   */
  public async memoryUsage(): Promise<number> {
    try {
      const info = await this.client.info('memory');
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      return usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
    } catch (error) {
      logger.error('Error getting Redis memory usage:', error);
      return 0;
    }
  }
}
