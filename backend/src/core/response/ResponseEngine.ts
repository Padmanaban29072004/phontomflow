import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { RedisService } from '@/services/RedisService';
import {
  ResponseTier,
  ResponseLevel,
  ResponseDecision,
  ResponseHistory,
  ResponseMetrics,
  ResponseConfiguration,
  ResponseExecutionResult
} from '@/types/response';
import {
  BaseResponseAction,
  ResponseActionFactory,
  ActionExecutionContext,
  TemporaryBlockAction
} from './ResponseActions';

export class ResponseEngine {
  private config: ResponseConfiguration;
  private redisService: RedisService;
  private responseHistory: Map<string, ResponseHistory[]> = new Map();
  private metrics: ResponseMetrics;
  private actionInstances: Map<string, BaseResponseAction> = new Map();

  constructor(config: ResponseConfiguration, redisService: RedisService) {
    this.config = config;
    this.redisService = redisService;
    this.metrics = this.initializeMetrics();
    this.initializeActionInstances();
  }

  /**
   * Main method to select and execute appropriate response
   */
  public async executeResponse(
    req: Request,
    res: Response,
    riskScore: number,
    sessionId: string,
    userId?: string
  ): Promise<ResponseExecutionResult> {
    const startTime = Date.now();
    
    try {
      if (!this.config.enabled) {
        return this.createSuccessResult([], startTime, 'Response system disabled');
      }

      // Check if session is temporarily blocked
      if (await this.isSessionBlocked(req.ip || 'unknown', sessionId)) {
        return this.handleBlockedSession(req, res, sessionId);
      }

      // Select appropriate response tier
      const decision = await this.selectResponseTier(riskScore, sessionId, req.ip || 'unknown');
      
      if (!decision) {
        return this.createSuccessResult([], startTime, 'No response needed');
      }

      // Execute response actions
      const executionResult = await this.executeResponseActions(decision, req, res, sessionId, userId);
      
      // Record response in history
      await this.recordResponse(decision, executionResult);
      
      // Update metrics
      this.updateMetrics(decision, executionResult);
      
      return executionResult;
      
    } catch (error) {
      logger.error('Error executing response:', error);
      return {
        success: false,
        actionsExecuted: [],
        actionResults: {},
        totalLatency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Select appropriate response tier based on risk score and context
   */
  private async selectResponseTier(
    riskScore: number,
    sessionId: string,
    ipAddress: string
  ): Promise<ResponseDecision | null> {
    // Find appropriate tier based on risk score
    const tier = this.config.tiers.find(t => 
      riskScore >= t.threshold.min && riskScore <= t.threshold.max
    );

    if (!tier) {
      logger.warn('No matching response tier found', { riskScore });
      return null;
    }

    // Get response history for context
    const history = this.getResponseHistory(sessionId);
    const escalationPath = this.calculateEscalationPath(history, tier);
    const cooldownStatus = this.checkCooldownStatus(history, tier);

    // Check if we should escalate based on repeated violations
    const finalTier = this.applyEscalationLogic(tier, history, escalationPath);

    return {
      tier: finalTier,
      actions: finalTier.actions.filter(action => action.enabled),
      reason: this.generateResponseReason(finalTier, riskScore, history),
      confidence: this.calculateConfidence(finalTier, riskScore, history),
      timestamp: new Date(),
      sessionId,
      riskScore,
      context: {
        previousResponses: history,
        escalationPath,
        cooldownStatus
      }
    };
  }

  /**
   * Execute all actions for a response decision
   */
  private async executeResponseActions(
    decision: ResponseDecision,
    req: Request,
    res: Response,
    sessionId: string,
    userId?: string
  ): Promise<ResponseExecutionResult> {
    const startTime = Date.now();
    const actionResults: Record<string, any> = {};
    const actionsExecuted: string[] = [];
    let allSuccessful = true;

    const context: ActionExecutionContext = {
      request: req,
      response: res,
      sessionId,
      riskScore: decision.riskScore,
      userId,
      ipAddress: req.ip || 'unknown'
    };

    // Execute actions in priority order (by severity)
    const sortedActions = [...decision.actions].sort((a, b) => a.severity - b.severity);
    
    for (const action of sortedActions) {
      try {
        const actionInstance = this.getActionInstance(action.type, action.config);
        const result = await actionInstance.execute(context);
        
        actionResults[action.type] = result;
        actionsExecuted.push(action.type);
        
        if (!result.success) {
          allSuccessful = false;
          logger.error(`Response action failed: ${action.type}`, {
            error: result.error,
            sessionId,
            riskScore: decision.riskScore
          });
        }
        
        // If this is a blocking action and it succeeded, don't continue with other actions
        if (result.success && this.isBlockingAction(action.type)) {
          break;
        }
        
      } catch (error) {
        allSuccessful = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        actionResults[action.type] = {
          success: false,
          latency: 0,
          error: errorMessage
        };
        
        logger.error(`Response action exception: ${action.type}`, {
          error: errorMessage,
          sessionId,
          riskScore: decision.riskScore
        });
      }
    }

    return {
      success: allSuccessful,
      actionsExecuted,
      actionResults,
      totalLatency: Date.now() - startTime
    };
  }

  /**
   * Get or create action instance
   */
  private getActionInstance(actionType: string, config: any): BaseResponseAction {
    const key = `${actionType}_${JSON.stringify(config)}`;
    
    if (!this.actionInstances.has(key)) {
      const instance = ResponseActionFactory.createAction(actionType as any, config);
      this.actionInstances.set(key, instance);
    }
    
    return this.actionInstances.get(key)!;
  }

  /**
   * Check if an action type is blocking (stops further action execution)
   */
  private isBlockingAction(actionType: string): boolean {
    return [
      'temporary_block',
      'permanent_block',
      'deception_redirect',
      'challenge_response',
      'divert',
    ].includes(actionType);
  }

  /**
   * Apply escalation logic based on history
   */
  private applyEscalationLogic(
    baseTier: ResponseTier,
    history: ResponseHistory[],
    escalationPath: ResponseLevel[]
  ): ResponseTier {
    const recentViolations = history.filter(h => 
      Date.now() - h.timestamp.getTime() < 300000 // Last 5 minutes
    );

    // Escalate if there are multiple recent violations
    if (recentViolations.length >= 3) {
      const nextLevel = this.getNextEscalationLevel(baseTier.level);
      const escalatedTier = this.config.tiers.find(t => t.level === nextLevel);
      
      if (escalatedTier) {
        logger.info('Escalating response tier', {
          from: baseTier.level,
          to: nextLevel,
          recentViolations: recentViolations.length
        });
        return escalatedTier;
      }
    }

    return baseTier;
  }

  /**
   * Get next escalation level
   */
  private getNextEscalationLevel(currentLevel: ResponseLevel): ResponseLevel {
    const levels: ResponseLevel[] = ['monitor', 'warn', 'restrict', 'block', 'isolate'];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.min(currentIndex + 1, levels.length - 1)];
  }

  /**
   * Calculate escalation path
   */
  private calculateEscalationPath(history: ResponseHistory[], currentTier: ResponseTier): ResponseLevel[] {
    const path: ResponseLevel[] = [currentTier.level];
    const recentHistory = history.slice(-5); // Last 5 responses
    
    recentHistory.forEach(h => {
      if (!path.includes(h.tier)) {
        path.push(h.tier);
      }
    });
    
    return path;
  }

  /**
   * Check cooldown status
   */
  private checkCooldownStatus(history: ResponseHistory[], tier: ResponseTier): boolean {
    if (!tier.cooldownPeriod || history.length === 0) {
      return false;
    }
    
    const lastResponse = history[history.length - 1];
    const timeSinceLastResponse = Date.now() - lastResponse.timestamp.getTime();
    
    return timeSinceLastResponse < tier.cooldownPeriod;
  }

  /**
   * Generate human-readable reason for response
   */
  private generateResponseReason(
    tier: ResponseTier,
    riskScore: number,
    history: ResponseHistory[]
  ): string {
    const baseReason = `Risk score ${riskScore.toFixed(2)} triggered ${tier.level} response`;
    
    if (history.length > 0) {
      const recentViolations = history.filter(h => 
        Date.now() - h.timestamp.getTime() < 300000
      ).length;
      
      if (recentViolations > 1) {
        return `${baseReason}. ${recentViolations} recent violations detected.`;
      }
    }
    
    return baseReason;
  }

  /**
   * Calculate confidence in response decision
   */
  private calculateConfidence(
    tier: ResponseTier,
    riskScore: number,
    history: ResponseHistory[]
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence if risk score is well within tier range
    const tierRange = tier.threshold.max - tier.threshold.min;
    const scorePosition = (riskScore - tier.threshold.min) / tierRange;
    confidence += scorePosition * 0.3;
    
    // Increase confidence if there's consistent history
    if (history.length >= 3) {
      const consistentResponses = history.slice(-3).filter(h => h.tier === tier.level).length;
      confidence += (consistentResponses / 3) * 0.2;
    }
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Record response in history
   */
  private async recordResponse(
    decision: ResponseDecision,
    executionResult: ResponseExecutionResult
  ): Promise<void> {
    const history: ResponseHistory = {
      timestamp: decision.timestamp,
      tier: decision.tier.level,
      actions: decision.actions.map(a => a.type),
      effectiveness: 1, // Will be updated based on subsequent behavior
      duration: executionResult.totalLatency
    };
    
    const sessionHistory = this.getResponseHistory(decision.sessionId);
    sessionHistory.push(history);
    
    // Keep only last 50 responses per session
    if (sessionHistory.length > 50) {
      sessionHistory.splice(0, sessionHistory.length - 50);
    }
    
    this.responseHistory.set(decision.sessionId, sessionHistory);
    
    // Also store in Redis for persistence
    try {
      await this.redisService.set(
        `response_history:${decision.sessionId}`,
        JSON.stringify(sessionHistory),
        86400 // 24 hours
      );
    } catch (error) {
      logger.warn('Failed to store response history in Redis:', error);
    }
  }

  /**
   * Get response history for session
   */
  private getResponseHistory(sessionId: string): ResponseHistory[] {
    return this.responseHistory.get(sessionId) || [];
  }

  /**
   * Check if session is temporarily blocked
   */
  private async isSessionBlocked(ipAddress: string, sessionId: string): Promise<boolean> {
    // Check with TemporaryBlockAction instances
    for (const [, actionInstance] of this.actionInstances) {
      if (actionInstance instanceof TemporaryBlockAction) {
        if (actionInstance.isBlocked(ipAddress, sessionId)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Handle blocked session
   */
  private async handleBlockedSession(
    req: Request,
    res: Response,
    sessionId: string
  ): Promise<ResponseExecutionResult> {
    const startTime = Date.now();
    
    res.status(403).json({
      error: 'Session Blocked',
      message: 'Your session has been temporarily blocked due to security concerns',
      sessionId,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      actionsExecuted: ['session_block_enforced'],
      actionResults: {
        'session_block_enforced': {
          success: true,
          latency: Date.now() - startTime
        }
      },
      totalLatency: Date.now() - startTime
    };
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ResponseMetrics {
    return {
      totalResponses: 0,
      responsesByTier: {
        monitor: 0,
        warn: 0,
        restrict: 0,
        block: 0,
        isolate: 0
      },
      averageResponseTime: 0,
      effectiveness: {
        falsePositives: 0,
        falseNegatives: 0,
        truePositives: 0,
        trueNegatives: 0,
        accuracy: 0,
        precision: 0,
        recall: 0
      },
      escalationRate: 0,
      cooldownViolations: 0
    };
  }

  /**
   * Initialize action instances for reuse
   */
  private initializeActionInstances(): void {
    // Pre-create commonly used action instances
    // This will be populated as actions are used
  }

  /**
   * Update metrics after response execution
   */
  private updateMetrics(decision: ResponseDecision, result: ResponseExecutionResult): void {
    this.metrics.totalResponses++;
    this.metrics.responsesByTier[decision.tier.level]++;
    
    // Update average response time
    const currentAvg = this.metrics.averageResponseTime;
    const newAvg = (currentAvg * (this.metrics.totalResponses - 1) + result.totalLatency) / this.metrics.totalResponses;
    this.metrics.averageResponseTime = newAvg;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ResponseMetrics {
    return { ...this.metrics };
  }

  /**
   * Create success result helper
   */
  private createSuccessResult(
    actionsExecuted: string[],
    startTime: number,
    reason?: string
  ): ResponseExecutionResult {
    return {
      success: true,
      actionsExecuted,
      actionResults: {},
      totalLatency: Date.now() - startTime,
      error: reason
    };
  }

  /**
   * Update configuration
   */
  public updateConfiguration(config: Partial<ResponseConfiguration>): void {
    this.config = { ...this.config, ...config };
    logger.info('Response engine configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): ResponseConfiguration {
    return { ...this.config };
  }
}
