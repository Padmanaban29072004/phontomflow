import express, { Router } from 'express';
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
import { authRoutes, initAuthRoutes } from '@/api/routes/auth';
import { threatRoutes } from '@/api/routes/threats';
import { dashboardRoutes } from '@/api/routes/dashboard';
import { createDeceptionRouter } from '@/api/routes/deception';
import { metricsRoutes } from '@/api/routes/metrics';
import { docsRoutes } from '@/api/routes/docs';
import { influxdbRoutes } from '@/api/routes/influxdb';
import { playbooksRoutes } from '@/api/routes/playbooks';
import { l2Routes } from '@/api/routes/l2';
import { Neo4jService } from '@/graph/Neo4jService';
import { Neo4jIntegration } from '@/services/Neo4jIntegration';
import { createGraphRouter } from '@/api/routes/graph';
import { ThompsonSampling } from '@/core/bandit/ThompsonSampling';
import { UserReputationService } from '@/services/UserReputationService';
import { AdaptiveDecisionEngine } from '@/services/AdaptiveDecisionEngine';
import { BanditPersistence } from '@/services/BanditPersistence';
import { FeedbackCollector } from '@/services/FeedbackCollector';
import { getDefaultBanditConfiguration } from '@/config/banditConfig';
import { createBanditRouter } from '@/api/routes/bandit';
import { v4 as uuidv4 } from 'uuid';
import { GrpcClients } from '@/rpc/GrpcClients';
import { KafkaBus } from '@/events/KafkaBus';

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
  private neo4jIntegration!: Neo4jIntegration;
  private databaseService: DatabaseService;
  private redisService: RedisService;
  private neo4jService: Neo4jService;
  private graphRoutes!: Router;
  private adaptiveDecisionEngine!: AdaptiveDecisionEngine;
  private feedbackCollector!: FeedbackCollector;
  private banditPersistence!: BanditPersistence;
  private banditRoutes!: Router;
  private grpcClients?: GrpcClients;
  private kafkaBus?: KafkaBus;

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
    this.neo4jService = new Neo4jService();

    this.initializeMiddleware();
    this.initializeGraphRoutes();
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
    this.app.use('/api/metrics', metricsRoutes);
    this.app.use('/api/docs', docsRoutes);
    this.app.use('/api/influxdb', influxdbRoutes);
    this.app.use('/api/playbooks', playbooksRoutes);
    this.app.use('/api/l2', l2Routes);

    // Threat detection middleware for all API routes
    this.app.use('/api/*', async (req, res, next) => {
      // Skip threat detection for internal API routes (req.path is relative to /api mount)
      const skipPaths = ['/graph', '/bandit', '/docs', '/playbooks', '/l2'];
      if (skipPaths.some(p => req.path.startsWith(p))) {
        return next();
      }

      try {
        const assessment = await this.threatDetectionEngine.detectThreats(req, res, next);
        
        // Add threat assessment to request object
        (req as any).threatAssessment = assessment;

        // Publish ThreatDetected event (fire-and-forget)
        if (this.kafkaBus) {
          this.kafkaBus.publish('threat-detected', {
            eventId: uuidv4(),
            requestId: assessment.sessionId || uuidv4(),
            clientIp: assessment.ipAddress,
            threatScore: assessment.threatScore,
            riskLevel: assessment.riskLevel,
            threatType: Array.isArray(assessment.threatType) ? assessment.threatType.join(',') : 'unknown',
            requestPath: assessment.requestPath,
            requestMethod: assessment.requestMethod,
            sourceService: 'phantom-flow-backend',
            timestampUnixMs: Date.now(),
          }).catch(() => {/* fire-and-forget */});
        }

        // Run parallel gRPC analysis with other services (fire-and-forget)
        if (this.grpcClients) {
          const grpcRequest = {
            requestId: assessment.sessionId || uuidv4(),
            clientIp: assessment.ipAddress,
            userAgent: assessment.userAgent,
            requestMethod: assessment.requestMethod,
            requestPath: assessment.requestPath,
            headers: {},
            body: Buffer.alloc(0),
            sessionId: assessment.sessionId,
            userId: assessment.userId,
          };
          Promise.allSettled([
            this.grpcClients.predictThreat(
              [assessment.threatScore], assessment.ipAddress, assessment.userAgent,
              assessment.requestPath, assessment.requestMethod,
            ),
            this.grpcClients.analyzeWithRust(grpcRequest),
            this.grpcClients.analyzeWithGo(grpcRequest),
          ]).then(([ml, rust, go]) => {
            if (ml.status === 'fulfilled' && ml.value.success) {
              logger.debug(`gRPC ML analysis: score=${ml.value.threatScore}`);
            }
            if (rust.status === 'fulfilled' && rust.value.success) {
              logger.debug(`gRPC Rust analysis: malicious=${rust.value.isMalicious}`);
            }
            if (go.status === 'fulfilled' && go.value.success) {
              logger.debug(`gRPC Go analysis: threat=${go.value.threatType}`);
            }
          }).catch(() => {/* fire-and-forget */});
        }

        // Handle high-risk threats
        if (assessment.riskLevel === 'critical') {
          logger.warn('Critical threat detected, applying immediate protection', {
            ipAddress: assessment.ipAddress,
            threatScore: assessment.threatScore,
            sessionId: assessment.sessionId
          });

          // Publish AttackObserved event (fire-and-forget)
          if (this.kafkaBus) {
            this.kafkaBus.publish('attack-observed', {
              eventId: uuidv4(),
              requestId: assessment.sessionId || uuidv4(),
              clientIp: assessment.ipAddress,
              threatScore: assessment.threatScore,
              riskLevel: assessment.riskLevel,
              attackPattern: Array.isArray(assessment.threatType) ? assessment.threatType.join(',') : 'critical',
              targetPath: assessment.requestPath || '',
              sourceService: 'phantom-flow-backend',
              timestampUnixMs: Date.now(),
            }).catch(() => {/* fire-and-forget */});
          }
          
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
        
        // Let adaptive bandit engine evaluate and learn from this request
        if (this.adaptiveDecisionEngine) {
          const decisionStart = Date.now();
          this.adaptiveDecisionEngine.decideAndExecute(req, res, assessment)
            .then((decision) => {
              (req as any).banditDecision = decision;

              // Publish ResponseExecuted event (fire-and-forget)
              if (this.kafkaBus) {
                this.kafkaBus.publish('response-executed', {
                  eventId: uuidv4(),
                  requestId: assessment.sessionId || uuidv4(),
                  clientIp: assessment.ipAddress,
                  actionType: decision.action,
                  target: assessment.requestPath || '',
                  success: decision.executed !== false,
                  durationMs: Date.now() - decisionStart,
                  threatId: assessment.sessionId || uuidv4(),
                  sourceService: 'phantom-flow-backend',
                  timestampUnixMs: Date.now(),
                }).catch(() => {/* fire-and-forget */});
              }
            })
            .catch((err: Error) => {
              logger.warn('Bandit decision error:', err.message);
            });
        }

        // Persist request data to Neo4j graph (fire-and-forget)
        this.neo4jIntegration.persistRequest({
          ipAddress: assessment.ipAddress,
          sessionId: assessment.sessionId,
          userId: assessment.userId,
          userAgent: assessment.userAgent,
          requestPath: assessment.requestPath,
          requestMethod: assessment.requestMethod,
          threatScore: assessment.threatScore,
          riskLevel: assessment.riskLevel,
          threatType: assessment.threatType,
        }).catch((err: Error) => {
          logger.warn('Neo4j graph persistence skipped:', err.message);
        });

        next();
      } catch (error) {
        logger.error('Error in threat detection middleware:', error);
        next();
      }
    });

    // Mount graph routes
    this.app.use('/api/graph', this.graphRoutes);
    logger.info('ðŸ“Š Graph API routes mounted at /api/graph');

    // 404 handler set up in start() after all routes mounted
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
    // Initialize threat detection engine with enhanced risk scoring
    this.threatDetectionEngine = new ThreatDetectionEngine(this.redisService);
    
    // Initialize deception service with configuration
    const deceptionConfig: DeceptionConfig = {
      enabled: process.env.HONEYPOT_ENABLED === 'true',
      honeypotEndpoints: ['/admin', '/api/admin', '/internal', '/debug'],
      fakeCredentials: ['admin:admin123', 'root:password', 'test:test123'],
      decoyFiles: ['config.json', 'database.sql', 'secrets.txt'],
      trapThreshold: 0.8,
      onHoneypotTriggered: (payload) => {
        if (this.kafkaBus) {
          this.kafkaBus.publish('honeypot-triggered', payload).catch(() => {});
        }
      },
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

    // Initialize Neo4j graph integration if available
    this.neo4jIntegration = new Neo4jIntegration(this.neo4jService);
    if (this.neo4jService.isConnected()) {
      logger.info('Neo4jIntegration initialized with live connection');
    } else {
      logger.info('Neo4jIntegration initialized in fallback mode (no graph persistence)');
    }

    // Initialize adaptive bandit engine
    const banditConfig = getDefaultBanditConfiguration();
    const bandit = new ThompsonSampling(banditConfig);
    this.banditPersistence = new BanditPersistence(bandit, banditConfig);
    await this.banditPersistence.initialize();

    const userReputation = new UserReputationService(this.neo4jService);
    this.feedbackCollector = new FeedbackCollector(bandit, this.banditPersistence, banditConfig);
    this.adaptiveDecisionEngine = new AdaptiveDecisionEngine(
      bandit,
      userReputation,
      this.neo4jService,
      undefined,
      banditConfig,
    );

    this.banditRoutes = createBanditRouter(this.adaptiveDecisionEngine, this.feedbackCollector);
    this.app.use('/api/bandit', this.banditRoutes);
    logger.info('ðŸŽ° Bandit API routes mounted at /api/bandit');

    this.app.use('/api/deception', createDeceptionRouter(this.deceptionService));
    logger.info('Deception API routes mounted at /api/deception');

    // Initialize gRPC clients
    this.grpcClients = new GrpcClients();
    this.grpcClients.init();

    // Initialize Kafka event bus
    this.kafkaBus = new KafkaBus();
    try {
      await this.kafkaBus.connect();
    } catch (error) {
      logger.warn('Kafka unavailable â€” continuing without event bus in current environment');
      this.kafkaBus = undefined;
    }

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
        if (this.kafkaBus) {
          this.kafkaBus.publish('model-updated', {
            eventId: uuidv4(),
            modelName: 'adaptive-threat-detector',
            modelVersion: `v${Date.now()}`,
            accuracyBefore: 0,
            accuracyAfter: 0,
            trainingSamples: 0,
            trainingDurationSec: 0,
            sourceService: 'phantom-flow-backend',
            timestampUnixMs: Date.now(),
          }).catch(() => {/* fire-and-forget */});
        }
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
   * Initialize graph routes (lazy â€” called after Neo4j connection attempt)
   */
  private initializeGraphRoutes(): void {
    this.graphRoutes = createGraphRouter(this.neo4jService);
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
            serverSelectionTimeoutMS: isDevelopment ? 2000 : 5000, // Shorter timeout in development
            socketTimeoutMS: 45000,
            connectTimeoutMS: isDevelopment ? 2000 : 10000, // Shorter connect timeout in development
          }
        });
        logger.info('âœ… MongoDB connected successfully');
      } catch (dbError) {
        if (isDevelopment) {
          logger.warn('âš ï¸ MongoDB not available - running in development mode without database');
          logger.warn('ðŸ’¡ To install MongoDB: https://docs.mongodb.com/manual/installation/');
        } else {
          throw dbError;
        }
      }

      // Initialize auth routes with database service (uses in-memory fallback if MongoDB unavailable)
      initAuthRoutes(this.databaseService);

      try {
        await this.redisService.connect();
        logger.info('âœ… Redis connected successfully');
      } catch (redisError) {
        if (isDevelopment) {
          logger.warn('âš ï¸ Redis not available - running in development mode without cache');
          logger.warn('ðŸ’¡ To install Redis: https://redis.io/download');
        } else {
          throw redisError;
        }
      }

      try {
        await this.neo4jService.connect();
        if (this.neo4jService.isConnected()) {
          await this.neo4jService.createIndexes();
          logger.info('âœ… Neo4j connected successfully');
        }
      } catch (neo4jError) {
        if (isDevelopment) {
          logger.warn('âš ï¸ Neo4j not available - graph features use in-memory fallback');
          logger.warn('ðŸ’¡ To start Neo4j: docker compose up -d neo4j');
        } else {
          throw neo4jError;
        }
      }

        // Initialize services after database connection attempts
      await this.initializeServices();

      // 404 handler (after all routes mounted including bandit)
      this.app.use('*', (req, res) => {
        res.status(404).json({
          error: 'Not found',
          message: 'The requested resource was not found'
        });
      });

      // Start the server
      this.server.listen(this.port, () => {
        logger.info(`ðŸš€ PHANTOM-Flow Defense System started on port ${this.port}`);
        logger.info(`ðŸ“Š Dashboard available at http://localhost:${this.port}/api/dashboard`);
        logger.info(`ðŸ”’ Threat detection active`);
        logger.info(`ðŸŽ­ Deception layer enabled`);
        logger.info(`ðŸ§  Adaptive learning system running`);
        
        if (isDevelopment) {
          logger.info(`ðŸ”§ Development mode: Some features may be limited without databases`);
          logger.info(`ðŸ“ Health check: http://localhost:${this.port}/health`);
          logger.info(`ðŸ  Server running successfully - Press Ctrl+C to stop`);
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
    logger.info('ðŸ›‘ Shutting down PHANTOM-Flow server...');
    
    try {
      // Stop adaptive learning service if it exists
      if (this.adaptiveLearningService) {
        await this.adaptiveLearningService.stop();
      }
      
      // Persist bandit state and stop
      if (this.banditPersistence) {
        await this.banditPersistence.shutdown();
      }

      // Disconnect Kafka
      if (this.kafkaBus) {
        await this.kafkaBus.disconnect();
      }

      // Close database connections
      await this.databaseService.disconnect();
      await this.redisService.disconnect();
      await this.neo4jService.disconnect();
      
      // Close server
      this.server.close(() => {
        logger.info('âœ… PHANTOM-Flow server shutdown complete');
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

