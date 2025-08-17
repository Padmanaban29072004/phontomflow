import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { logger } from '@/utils/logger';
import { DatabaseService } from '@/services/DatabaseService';
import { RedisService } from '@/services/RedisService';
import { ThreatDetectionEngine } from '@/core/ThreatDetectionEngine';
import { DeceptionService, DeceptionConfig } from '@/services/DeceptionService';
import { AdaptiveLearningService, LearningConfig } from '@/services/AdaptiveLearningService';
import { authRoutes } from '@/api/routes/auth';
import { threatRoutes } from '@/api/routes/threats';
import { dashboardRoutes } from '@/api/routes/dashboard';
import { deceptionRoutes } from '@/api/routes/deception';
import { metricsRoutes } from '@/api/routes/metrics';

// Load environment variables
dotenv.config();

class PhantomFlowServer {
  private app: express.Application;
  private server: any;
  private io: Server;
  private port: number;
  private threatDetectionEngine!: ThreatDetectionEngine;
  private deceptionService!: DeceptionService;
  private adaptiveLearningService!: AdaptiveLearningService;
  private databaseService: DatabaseService;
  private redisService: RedisService;

  constructor() {
    this.port = parseInt(process.env.PORT || '3001');
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });

    // Initialize basic services
    this.databaseService = new DatabaseService();
    this.redisService = new RedisService();

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeSocketIO();
  }

  /**
   * Initialize middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          duration,
          statusCode: res.statusCode
        });
      });
      
      next();
    });

    // Global error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });
  }

  /**
   * Initialize API routes
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/threats', threatRoutes);
    this.app.use('/api/dashboard', dashboardRoutes);
    this.app.use('/api/deception', deceptionRoutes);
    this.app.use('/api/metrics', metricsRoutes);

    // Threat detection middleware for all API routes
    this.app.use('/api/*', async (req, res, next) => {
      try {
        const assessment = await this.threatDetectionEngine.detectThreats(req, res, next);
        
        // Add threat assessment to request object
        (req as any).threatAssessment = assessment;
        
        // Handle high-risk threats
        if (assessment.riskLevel === 'critical') {
          logger.warn('Critical threat detected, applying immediate protection', {
            ipAddress: assessment.ipAddress,
            threatScore: assessment.threatScore,
            sessionId: assessment.sessionId
          });
          
          // Redirect to deception environment for critical threats
          const deceptionUrl = await this.deceptionService.createDeceptionEnvironment(assessment);
          return res.redirect(deceptionUrl);
        }
        
        // Apply rate limiting for high-risk threats
        if (assessment.riskLevel === 'high') {
          // Implement additional rate limiting
          logger.info('High-risk threat detected, applying enhanced protection', {
            ipAddress: assessment.ipAddress,
            threatScore: assessment.threatScore
          });
        }
        
        next();
      } catch (error) {
        logger.error('Error in threat detection middleware:', error);
        next();
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: 'The requested resource was not found'
      });
    });
  }

  /**
   * Initialize Socket.IO for real-time communication
   */
  private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected:', socket.id);

      // Join dashboard room for real-time updates
      socket.on('join-dashboard', (data) => {
        socket.join('dashboard');
        logger.info('Client joined dashboard room:', socket.id);
      });

      // Handle threat alerts
      socket.on('threat-alert', (data) => {
        this.io.to('dashboard').emit('threat-update', data);
      });

      // Handle deception events
      socket.on('deception-event', (data) => {
        this.io.to('dashboard').emit('deception-update', data);
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected:', socket.id);
      });
    });

    // Make io available to routes
    (this.app as any).io = this.io;
  }

  /**
   * Initialize services after database connections
   */
  private async initializeServices(): Promise<void> {
    // Initialize threat detection engine
    this.threatDetectionEngine = new ThreatDetectionEngine();
    
    // Initialize deception service with configuration
    const deceptionConfig: DeceptionConfig = {
      enabled: process.env.HONEYPOT_ENABLED === 'true',
      honeypotEndpoints: ['/admin', '/api/admin', '/internal', '/debug'],
      fakeCredentials: ['admin:admin123', 'root:password', 'test:test123'],
      decoyFiles: ['config.json', 'database.sql', 'secrets.txt'],
      trapThreshold: 0.8
    };
    this.deceptionService = new DeceptionService(this.redisService, deceptionConfig);
    
    // Initialize adaptive learning service with configuration
    const learningConfig: LearningConfig = {
      enabled: true,
      retrainInterval: parseInt(process.env.MODEL_UPDATE_INTERVAL || '60'), // minutes
      minDataPoints: 100,
      learningRate: 0.001,
      batchSize: 32,
      epochs: 10
    };
    this.adaptiveLearningService = new AdaptiveLearningService(this.redisService, learningConfig);

    // Initialize threat detection system
    this.initializeThreatDetection();
  }

  /**
   * Initialize threat detection system
   */
  private initializeThreatDetection(): void {
    // Start adaptive learning service
    this.adaptiveLearningService.start();

    // Set up periodic model retraining
    setInterval(async () => {
      try {
        await this.adaptiveLearningService.retrainModels();
        logger.info('Periodic model retraining completed');
      } catch (error) {
        logger.error('Error in periodic model retraining:', error);
      }
    }, parseInt(process.env.MODEL_UPDATE_INTERVAL || '3600000')); // Default: 1 hour

    // Set up periodic metrics collection
    setInterval(async () => {
      try {
        const metrics = this.threatDetectionEngine.getMetrics();
        await this.redisService.set('metrics:detection', JSON.stringify(metrics), 3600);
        
        // Emit metrics to dashboard
        this.io.to('dashboard').emit('metrics-update', metrics);
      } catch (error) {
        logger.error('Error collecting metrics:', error);
      }
    }, parseInt(process.env.PERFORMANCE_MONITORING_INTERVAL || '60000')); // Default: 1 minute
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Check if we're in development mode and databases are not available
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        logger.info('Running in development mode - attempting to connect to databases...');
      }

      // Try to connect to databases with fallback
      try {
        await this.databaseService.connect({
          uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/phantom-flow',
          options: {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
          }
        });
        logger.info('✅ MongoDB connected successfully');
      } catch (dbError) {
        if (isDevelopment) {
          logger.warn('⚠️ MongoDB not available - running in development mode without database');
          logger.warn('To install MongoDB: https://docs.mongodb.com/manual/installation/');
        } else {
          throw dbError;
        }
      }

      try {
        await this.redisService.connect();
        logger.info('✅ Redis connected successfully');
      } catch (redisError) {
        if (isDevelopment) {
          logger.warn('⚠️ Redis not available - running in development mode without cache');
          logger.warn('To install Redis: https://redis.io/download');
        } else {
          throw redisError;
        }
      }

      // Initialize services after database connection attempts
      await this.initializeServices();

      // Start the server
      this.server.listen(this.port, () => {
        logger.info(`🚀 PHANTOM-Flow Defense System started on port ${this.port}`);
        logger.info(`📊 Dashboard available at http://localhost:${this.port}/api/dashboard`);
        logger.info(`🔒 Threat detection active`);
        logger.info(`🎭 Deception layer enabled`);
        logger.info(`🧠 Adaptive learning system running`);
        
        if (isDevelopment) {
          logger.info(`🔧 Development mode: Some features may be limited without databases`);
          logger.info(`📝 Health check: http://localhost:${this.port}/health`);
        }
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

    } catch (error) {
      logger.error('Failed to start PHANTOM-Flow server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('🛑 Shutting down PHANTOM-Flow server...');
    
    try {
      // Stop adaptive learning service
      this.adaptiveLearningService.stop();
      
      // Close database connections
      await this.databaseService.disconnect();
      await this.redisService.disconnect();
      
      // Close server
      this.server.close(() => {
        logger.info('✅ PHANTOM-Flow server shutdown complete');
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new PhantomFlowServer();
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default server;
