import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { ResponseAction, ResponseActionConfig, ResponseActionType } from '@/types/response';

export interface ActionExecutionContext {
  request: Request;
  response: Response;
  sessionId: string;
  riskScore: number;
  userId?: string;
  ipAddress: string;
}

export interface ActionExecutionResult {
  success: boolean;
  latency: number;
  error?: string;
  metadata?: Record<string, any>;
}

export abstract class BaseResponseAction {
  protected type: ResponseActionType;
  protected config: ResponseActionConfig;

  constructor(type: ResponseActionType, config: ResponseActionConfig) {
    this.type = type;
    this.config = config;
  }

  abstract execute(context: ActionExecutionContext): Promise<ActionExecutionResult>;

  protected measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latency: number }> {
    const start = Date.now();
    return fn().then(result => ({
      result,
      latency: Date.now() - start
    }));
  }
}

/**
 * Log Only Action - Records the threat but takes no blocking action
 */
export class LogOnlyAction extends BaseResponseAction {
  constructor(config: ResponseActionConfig) {
    super('log_only', config);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    try {
      const { latency } = await this.measureLatency(async () => {
        logger.info('Threat detected - Log only response', {
          sessionId: context.sessionId,
          riskScore: context.riskScore,
          ipAddress: context.ipAddress,
          userId: context.userId,
          path: context.request.path,
          method: context.request.method,
          userAgent: context.request.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      });

      return {
        success: true,
        latency,
        metadata: {
          logged: true,
          logLevel: 'info'
        }
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Rate Limiting Action - Implements rate limiting based on configuration
 */
export class RateLimitAction extends BaseResponseAction {
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: ResponseActionConfig) {
    super('rate_limit', config);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        const rateConfig = this.config.rateLimit;
        if (!rateConfig) {
          throw new Error('Rate limit configuration is required');
        }

        const key = `${context.ipAddress}:${context.sessionId}`;
        const now = Date.now();
        const windowStart = now - rateConfig.window;

        // Clean up expired entries
        this.cleanupExpiredEntries(windowStart);

        // Get current rate limit status
        const current = this.rateLimitStore.get(key) || { count: 0, resetTime: now + rateConfig.window };

        // Check if rate limit is exceeded
        if (current.count >= rateConfig.requests) {
          // Rate limit exceeded
          context.response.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((current.resetTime - now) / 1000),
            limit: rateConfig.requests,
            window: rateConfig.window / 1000
          });
          return { blocked: true, reason: 'rate_limit_exceeded' };
        }

        // Update rate limit counter
        current.count++;
        this.rateLimitStore.set(key, current);

        return { blocked: false, currentCount: current.count };
      });

      return {
        success: true,
        latency,
        metadata: {
          blocked: result.blocked,
          reason: result.reason,
          currentCount: result.currentCount
        }
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private cleanupExpiredEntries(windowStart: number): void {
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (entry.resetTime < windowStart) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Temporary Block Action - Temporarily blocks access
 */
export class TemporaryBlockAction extends BaseResponseAction {
  private blockedSessions: Map<string, { blockedUntil: number; reason: string }> = new Map();

  constructor(config: ResponseActionConfig) {
    super('temporary_block', config);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        const blockConfig = this.config.block;
        if (!blockConfig) {
          throw new Error('Block configuration is required');
        }

        const key = `${context.ipAddress}:${context.sessionId}`;
        const blockedUntil = Date.now() + blockConfig.duration;
        const reason = blockConfig.message || 'Access temporarily restricted due to security concerns';

        // Store block information
        this.blockedSessions.set(key, { blockedUntil, reason });

        // Clean up expired blocks
        this.cleanupExpiredBlocks();

        // Send block response
        context.response.status(403).json({
          error: 'Access Blocked',
          reason,
          blockedUntil: new Date(blockedUntil).toISOString(),
          duration: blockConfig.duration / 1000,
          redirectUrl: blockConfig.redirectUrl
        });

        logger.warn('Temporary block applied', {
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          duration: blockConfig.duration,
          reason,
          blockedUntil: new Date(blockedUntil).toISOString()
        });

        return { blocked: true, duration: blockConfig.duration };
      });

      return {
        success: true,
        latency,
        metadata: {
          blocked: result.blocked,
          duration: result.duration,
          reason: this.config.block?.message
        }
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  isBlocked(ipAddress: string, sessionId: string): boolean {
    const key = `${ipAddress}:${sessionId}`;
    const blockInfo = this.blockedSessions.get(key);
    
    if (!blockInfo) return false;
    
    if (Date.now() > blockInfo.blockedUntil) {
      this.blockedSessions.delete(key);
      return false;
    }
    
    return true;
  }

  private cleanupExpiredBlocks(): void {
    const now = Date.now();
    for (const [key, blockInfo] of this.blockedSessions.entries()) {
      if (now > blockInfo.blockedUntil) {
        this.blockedSessions.delete(key);
      }
    }
  }
}

/**
 * Alert Admin Action - Sends alerts to administrators
 */
export class AlertAdminAction extends BaseResponseAction {
  constructor(config: ResponseActionConfig) {
    super('alert_admin', config);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        const alertConfig = this.config.alert;
        if (!alertConfig) {
          throw new Error('Alert configuration is required');
        }

        const alertData = {
          priority: alertConfig.priority,
          timestamp: new Date().toISOString(),
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          riskScore: context.riskScore,
          userId: context.userId,
          requestPath: context.request.path,
          userAgent: context.request.get('User-Agent'),
          message: `High-risk activity detected (Score: ${context.riskScore})`,
          channels: alertConfig.channels
        };

        // For now, just log the alert (in production, this would send to actual channels)
        logger.error('SECURITY ALERT', alertData);

        // In production, implement actual alerting:
        // - Send emails
        // - Post to Slack
        // - Call webhooks
        // - Send SMS

        return { alertSent: true, channels: alertConfig.channels };
      });

      return {
        success: true,
        latency,
        metadata: {
          alertSent: result.alertSent,
          channels: result.channels,
          priority: this.config.alert?.priority
        }
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Allow Action - No-op pass through. Allows the request to proceed normally.
 */
export class AllowAction extends BaseResponseAction {
  constructor(config: ResponseActionConfig) {
    super('allow', config);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    const start = Date.now();
    logger.info('Allow action — request proceeding normally', {
      sessionId: context.sessionId,
      riskScore: context.riskScore,
      ipAddress: context.ipAddress,
    });
    return {
      success: true,
      latency: Date.now() - start,
      metadata: { allowed: true },
    };
  }
}

/**
 * Divert Action - Redirects the request to a deception/honeypot environment.
 */
export class DivertAction extends BaseResponseAction {
  constructor(config: ResponseActionConfig) {
    super('divert', config);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        const deceptionConfig = this.config.deception;
        const targetUrl = deceptionConfig?.honeypotUrl || '/honeypot';
        const logLevel = deceptionConfig?.logLevel || 'detailed';

        context.response.status(302).redirect(targetUrl);

        logger.warn('Divert action — request redirected to honeypot', {
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          userId: context.userId,
          riskScore: context.riskScore,
          redirectUrl: targetUrl,
          logLevel,
        });

        return { redirected: true, targetUrl };
      });

      return {
        success: true,
        latency,
        metadata: {
          redirected: result.redirected,
          targetUrl: result.targetUrl,
        },
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Challenge Action - Issues a challenge (CAPTCHA / proof-of-work) to verify the user.
 */
export class ChallengeAction extends BaseResponseAction {
  constructor(config: ResponseActionConfig) {
    super('challenge_response', config);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    try {
      const { result, latency } = await this.measureLatency(async () => {
        const challengeConfig = this.config.challenge || {
          type: 'javascript',
          difficulty: 5,
          timeout: 60000,
        };

        // Generate a challenge token (in prod this would use a proper challenge service)
        const challengeToken = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        if (challengeConfig.type === 'captcha') {
          context.response.status(401).json({
            error: 'Challenge required',
            challengeType: 'captcha',
            challengeToken,
            message: 'Please complete the CAPTCHA to continue',
          });
        } else {
          // JavaScript proof-of-work challenge
          context.response.status(401).json({
            error: 'Challenge required',
            challengeType: challengeConfig.type,
            challengeToken,
            difficulty: challengeConfig.difficulty,
            timeout: challengeConfig.timeout,
            message: 'Please complete the verification challenge to continue',
          });
        }

        logger.info('Challenge action issued', {
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          riskScore: context.riskScore,
          challengeType: challengeConfig.type,
          challengeToken,
        });

        return { challenged: true, challengeType: challengeConfig.type, challengeToken };
      });

      return {
        success: true,
        latency,
        metadata: {
          challenged: result.challenged,
          challengeType: result.challengeType,
          challengeToken: result.challengeToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Response Action Factory
 */
export class ResponseActionFactory {
  static createAction(actionType: ResponseActionType, config: ResponseActionConfig): BaseResponseAction {
    switch (actionType) {
      case 'allow':
        return new AllowAction(config);
      case 'log_only':
        return new LogOnlyAction(config);
      case 'rate_limit':
        return new RateLimitAction(config);
      case 'temporary_block':
        return new TemporaryBlockAction(config);
      case 'alert_admin':
        return new AlertAdminAction(config);
      case 'challenge_response':
        return new ChallengeAction(config);
      case 'divert':
        return new DivertAction(config);
      default:
        throw new Error(`Unsupported response action type: ${actionType}`);
    }
  }
}
