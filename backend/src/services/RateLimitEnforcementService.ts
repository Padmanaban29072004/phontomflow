/**
 * Rate Limit Enforcement Service
 * Middleware integration and request processing with real-time enforcement
 */

import { Request, Response, NextFunction } from 'express';
import {
  RateLimitRequest,
  RateLimitResult,
  RateLimitViolation,
  RateLimitManagerConfig
} from '@/types/rateLimit';
import { RateLimitManager } from '@/services/RateLimitManager';
import { RedisService } from '@/services/RedisService';
import { logger } from '@/utils/logger';

export interface RateLimitEnforcementConfig {
  enabled: boolean;
  defaultHeaders: boolean;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator: (req: Request) => string;
  skip: (req: Request) => boolean;
  onLimitReached: (req: Request, res: Response, result: RateLimitResult) => void;
  store: 'redis' | 'memory';
}

export interface RateLimitMiddlewareOptions {
  endpoint?: string;
  methods?: string[];
  customLimits?: {
    baseLimit: number;
    timeWindowMs: number;
  };
  threatScoreExtractor?: (req: Request) => number;
  userExtractor?: (req: Request) => { userId?: string; sessionId?: string };
  skipCondition?: (req: Request) => boolean;
}

export class RateLimitEnforcementService {
  private rateLimitManager: RateLimitManager;
  private config: RateLimitEnforcementConfig;
  private redisService: RedisService;
  private violationCount: Map<string, number>;
  private blockedIPs: Set<string>;
  private blockedExpiry: Map<string, Date>;

  constructor(
    redisService: RedisService,
    managerConfig: RateLimitManagerConfig,
    enforcementConfig?: Partial<RateLimitEnforcementConfig>
  ) {
    this.redisService = redisService;
    this.rateLimitManager = new RateLimitManager(redisService, managerConfig);
    this.violationCount = new Map();
    this.blockedIPs = new Set();
    this.blockedExpiry = new Map();

    this.config = {
      enabled: true,
      defaultHeaders: true,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: this.defaultKeyGenerator,
      skip: () => false,
      onLimitReached: this.defaultOnLimitReached,
      store: 'redis',
      ...enforcementConfig
    };

    // Start cleanup timer for blocked IPs
    this.startBlockedIPCleanup();
  }

  /**
   * Create rate limiting middleware
   */
  createMiddleware(options: RateLimitMiddlewareOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check if rate limiting is enabled
        if (!this.config.enabled) {
          return next();
        }

        // Check skip conditions
        if (this.config.skip(req) || (options.skipCondition && options.skipCondition(req))) {
          return next();
        }

        // Check if IP is blocked
        const clientIP = this.extractClientIP(req);
        if (this.isIPBlocked(clientIP)) {
          return this.handleBlockedIP(req, res);
        }

        // Generate rate limit request
        const rateLimitRequest = this.createRateLimitRequest(req, options);

        // Check rate limit
        const result = await this.rateLimitManager.checkRateLimit(rateLimitRequest);

        // Add rate limit headers
        if (this.config.defaultHeaders) {
          this.addRateLimitHeaders(res, result);
        }

        // Handle rate limit result
        if (!result.allowed) {
          await this.handleRateLimitViolation(req, res, result);
          return;
        }

        // Request allowed, proceed
        next();

      } catch (error) {
        logger.error('Rate limit enforcement failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method,
          ip: this.extractClientIP(req)
        });

        // Fail open - allow request to proceed on error
        next();
      }
    };
  }

  /**
   * Enforce rate limit for API endpoints
   */
  async enforceRateLimit(
    req: Request,
    res: Response,
    options: RateLimitMiddlewareOptions = {}
  ): Promise<boolean> {
    try {
      const rateLimitRequest = this.createRateLimitRequest(req, options);
      const result = await this.rateLimitManager.checkRateLimit(rateLimitRequest);

      if (this.config.defaultHeaders) {
        this.addRateLimitHeaders(res, result);
      }

      if (!result.allowed) {
        await this.handleRateLimitViolation(req, res, result);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Rate limit enforcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return true; // Fail open
    }
  }

  /**
   * Block IP address temporarily
   */
  async blockIP(ipAddress: string, durationMs: number, reason: string): Promise<void> {
    try {
      const expiryTime = new Date(Date.now() + durationMs);
      
      this.blockedIPs.add(ipAddress);
      this.blockedExpiry.set(ipAddress, expiryTime);

      // Store in Redis for distributed blocking
      await this.redisService.set(
        `blocked_ip:${ipAddress}`,
        JSON.stringify({ reason, blockedAt: new Date(), expiryTime }),
        Math.ceil(durationMs / 1000)
      );

      logger.warn('IP address blocked', {
        ipAddress,
        duration: `${durationMs}ms`,
        reason,
        expiryTime
      });
    } catch (error) {
      logger.error('Failed to block IP', {
        ipAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ipAddress: string): Promise<void> {
    try {
      this.blockedIPs.delete(ipAddress);
      this.blockedExpiry.delete(ipAddress);

      // Remove from Redis
      await this.redisService.del(`blocked_ip:${ipAddress}`);

      logger.info('IP address unblocked', { ipAddress });
    } catch (error) {
      logger.error('Failed to unblock IP', {
        ipAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get rate limit status for identifier
   */
  async getRateLimitStatus(identifier: string): Promise<{
    blocked: boolean;
    violations: number;
    lastViolation?: Date;
    blockExpiry?: Date;
  }> {
    const violations = this.violationCount.get(identifier) || 0;
    const blocked = this.blockedIPs.has(identifier);
    const blockExpiry = this.blockedExpiry.get(identifier);

    return {
      blocked,
      violations,
      blockExpiry
    };
  }

  /**
   * Get analytics from rate limit manager
   */
  async getAnalytics(startTime: Date, endTime: Date) {
    return this.rateLimitManager.getAnalytics(startTime, endTime);
  }

  /**
   * Get insights from rate limit manager
   */
  async getInsights() {
    return this.rateLimitManager.generateInsights();
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations() {
    return this.rateLimitManager.getOptimizationRecommendations();
  }

  /**
   * Activate emergency mode
   */
  async activateEmergencyMode(): Promise<void> {
    await this.rateLimitManager.activateEmergencyMode();
    logger.warn('Rate limit emergency mode activated');
  }

  /**
   * Deactivate emergency mode
   */
  async deactivateEmergencyMode(): Promise<void> {
    await this.rateLimitManager.deactivateEmergencyMode();
    logger.info('Rate limit emergency mode deactivated');
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    return this.rateLimitManager.getHealthStatus();
  }

  /**
   * Create rate limit request from Express request
   */
  private createRateLimitRequest(req: Request, options: RateLimitMiddlewareOptions): RateLimitRequest {
    const identifier = this.config.keyGenerator(req);
    const threatScore = options.threatScoreExtractor ? options.threatScoreExtractor(req) : undefined;
    const userInfo = options.userExtractor ? options.userExtractor(req) : {};

    return {
      identifier,
      endpoint: options.endpoint || req.path,
      method: req.method,
      ipAddress: this.extractClientIP(req),
      userAgent: req.get('User-Agent'),
      userId: userInfo.userId,
      sessionId: userInfo.sessionId,
      threatScore,
      timestamp: new Date(),
      metadata: {
        originalUrl: req.originalUrl,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers)
      }
    };
  }

  /**
   * Extract client IP address
   */
  private extractClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.get('CF-Connecting-IP') ||
      '127.0.0.1'
    );
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator = (req: Request): string => {
    const ip = this.extractClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const userId = (req as any).user?.id;
    
    if (userId) {
      return `user:${userId}`;
    }
    
    // Combine IP and user agent for anonymous users
    const uaHash = this.simpleHash(userAgent);
    return `${ip}:${uaHash}`;
  };

  /**
   * Default on limit reached handler
   */
  private defaultOnLimitReached = (req: Request, res: Response, result: RateLimitResult): void => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: result.reason || 'Rate limit exceeded',
      retryAfter: result.retryAfter,
      limit: result.limitApplied,
      remaining: result.remainingRequests,
      resetTime: result.resetTime
    });
  };

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(res: Response, result: RateLimitResult): void {
    res.set({
      'X-RateLimit-Limit': result.limitApplied.toString(),
      'X-RateLimit-Remaining': result.remainingRequests.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetTime.getTime() / 1000).toString(),
      'X-RateLimit-Policy': result.metadata.algorithm
    });

    if (!result.allowed && result.retryAfter) {
      res.set('Retry-After', result.retryAfter.toString());
    }
  }

  /**
   * Handle rate limit violation
   */
  private async handleRateLimitViolation(
    req: Request,
    res: Response,
    result: RateLimitResult
  ): Promise<void> {
    const identifier = this.config.keyGenerator(req);
    const ipAddress = this.extractClientIP(req);

    // Track violation
    const violations = (this.violationCount.get(identifier) || 0) + 1;
    this.violationCount.set(identifier, violations);

    // Log violation
    logger.warn('Rate limit violation', {
      identifier,
      ipAddress,
      endpoint: req.path,
      method: req.method,
      violations,
      limit: result.limitApplied,
      userAgent: req.get('User-Agent')
    });

    // Check for escalation
    if (violations >= 10) { // Configurable threshold
      await this.blockIP(ipAddress, 300000, `Repeated rate limit violations (${violations})`); // 5 minutes
    } else if (violations >= 5) {
      await this.blockIP(ipAddress, 60000, `Multiple rate limit violations (${violations})`); // 1 minute
    }

    // Call configured handler
    this.config.onLimitReached(req, res, result);
  }

  /**
   * Check if IP is blocked
   */
  private isIPBlocked(ipAddress: string): boolean {
    if (!this.blockedIPs.has(ipAddress)) {
      return false;
    }

    const expiryTime = this.blockedExpiry.get(ipAddress);
    if (expiryTime && new Date() > expiryTime) {
      // Block expired, remove it
      this.blockedIPs.delete(ipAddress);
      this.blockedExpiry.delete(ipAddress);
      return false;
    }

    return true;
  }

  /**
   * Handle blocked IP request
   */
  private handleBlockedIP(req: Request, res: Response): void {
    const ipAddress = this.extractClientIP(req);
    const expiryTime = this.blockedExpiry.get(ipAddress);
    
    logger.warn('Blocked IP attempted access', {
      ipAddress,
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    res.status(403).json({
      error: 'Forbidden',
      message: 'Your IP address has been temporarily blocked due to rate limit violations',
      blockedUntil: expiryTime,
      retryAfter: expiryTime ? Math.ceil((expiryTime.getTime() - Date.now()) / 1000) : undefined
    });
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }

  /**
   * Simple hash function for user agent
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Start cleanup timer for blocked IPs
   */
  private startBlockedIPCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredBlocks();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired blocked IPs
   */
  private cleanupExpiredBlocks(): void {
    const now = new Date();
    const expiredIPs: string[] = [];

    for (const [ip, expiryTime] of this.blockedExpiry.entries()) {
      if (now > expiryTime) {
        expiredIPs.push(ip);
      }
    }

    for (const ip of expiredIPs) {
      this.blockedIPs.delete(ip);
      this.blockedExpiry.delete(ip);
    }

    if (expiredIPs.length > 0) {
      logger.debug(`Cleaned up ${expiredIPs.length} expired IP blocks`);
    }
  }

  /**
   * Get enforcement statistics
   */
  getStatistics(): {
    blockedIPs: number;
    totalViolations: number;
    activeViolators: number;
  } {
    const totalViolations = Array.from(this.violationCount.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      blockedIPs: this.blockedIPs.size,
      totalViolations,
      activeViolators: this.violationCount.size
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.violationCount.clear();
    this.blockedIPs.clear();
    this.blockedExpiry.clear();
    logger.info('Rate limit enforcement service destroyed');
  }
}
