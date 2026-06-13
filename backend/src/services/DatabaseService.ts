import mongoose from 'mongoose';
import { logger } from '@/utils/logger';

export interface DatabaseConfig {
  uri: string;
  options: mongoose.ConnectOptions;
}

export class DatabaseService {
  private isConnected: boolean = false;
  private connection: mongoose.Connection | null = null;

  /**
   * Check if database is available
   */
  public isDatabaseAvailable(): boolean {
    return this.isConnected && this.connection !== null;
  }

  /**
   * Safe operation wrapper for database operations
   */
  private async safeOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    if (!this.isDatabaseAvailable()) {
      logger.debug('Database not available, using fallback value');
      return fallback;
    }
    
    try {
      return await operation();
    } catch (error) {
      logger.warn('Database operation failed, using fallback:', error);
      return fallback;
    }
  }

  constructor() {
    this.setupEventHandlers();
  }

  /**
   * Initialize database connection
   */
  public async connect(config: DatabaseConfig): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    logger.info('Connecting to database...');

    try {
      await mongoose.connect(config.uri, config.options);

      this.connection = mongoose.connection;
      this.isConnected = true;

      logger.info('Database connected successfully');
    } catch (error) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        logger.warn('MongoDB not available — running in development mode without database');
      } else {
        logger.error('Database connection failed:', error);
        throw error;
      }
    }
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        logger.info('Database not connected');
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      this.connection = null;
      
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Database disconnection failed:', error);
      throw error;
    }
  }

  /**
   * Get database connection status
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get database connection
   */
  public getConnection(): mongoose.Connection | null {
    return this.connection;
  }

  /**
   * Setup database event handlers
   */
  private setupEventHandlers(): void {
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to database');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      if (process.env.NODE_ENV !== 'development') {
        logger.error('Mongoose connection error:', error);
      }
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('Mongoose disconnected from database');
      this.isConnected = false;
    });

    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Health check for database
   */
  public async healthCheck(): Promise<boolean> {
    return await this.safeOperation(async () => {
      if (!this.isConnected || !mongoose.connection.db) {
        return false;
      }

      // Ping the database
      await mongoose.connection.db.admin().ping();
      return true;
    }, false);
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<any> {
    return await this.safeOperation(async () => {
      if (!this.isConnected || !mongoose.connection.db) {
        throw new Error('Database not connected');
      }

      const stats = await mongoose.connection.db.stats();
      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      };
    }, {
      collections: 0,
      dataSize: 0,
      storageSize: 0,
      indexes: 0,
      indexSize: 0
    });
  }
}
