import { Request, Response } from 'express';
import { ThompsonSampling } from '@/core/bandit/ThompsonSampling';
import { UserReputationService } from '@/services/UserReputationService';
import { Neo4jService } from '@/graph/Neo4jService';
import { ResponseEngine } from '@/core/response/ResponseEngine';
import { DivertAction } from '@/core/response/ResponseActions';
import { ResponseActionConfig, ResponseActionType } from '@/types/response';
import { BanditActionType, BANDIT_ACTIONS } from '@/types/bandit';
import { ThreatAssessment } from '@/core/ThreatDetectionEngine';
import { BanditConfiguration, getDefaultBanditConfiguration } from '@/config/banditConfig';
import { logger } from '@/utils/logger';

export interface BanditDecision {
  action: BanditActionType;
  contextKey: string;
  confidence: number;
  sufficientData: boolean;
  executed: boolean;
  reason: string;
  latency: number;
}

export class AdaptiveDecisionEngine {
  private bandit: ThompsonSampling;
  private userReputation: UserReputationService;
  private neo4j: Neo4jService;
  private responseEngine?: ResponseEngine;
  private config: BanditConfiguration;

  constructor(
    bandit: ThompsonSampling,
    userReputation: UserReputationService,
    neo4j: Neo4jService,
    responseEngine?: ResponseEngine,
    config?: Partial<BanditConfiguration>,
  ) {
    this.bandit = bandit;
    this.userReputation = userReputation;
    this.neo4j = neo4j;
    this.responseEngine = responseEngine;
    this.config = { ...getDefaultBanditConfiguration(), ...config };
  }

  async decideAndExecute(
    req: Request,
    res: Response,
    assessment: ThreatAssessment,
  ): Promise<BanditDecision> {
    const start = Date.now();

    try {
      const repResult = await this.userReputation.getReputation(assessment.userId, assessment.ipAddress);
      const context = this.userReputation.updateThreatBucket(repResult.context, assessment.threatScore);
      const contextKey = this.bandit.getContext(context);
      const sufficientData = this.bandit.hasSufficientData(context);

      if (!sufficientData) {
        return {
          action: 'monitor',
          contextKey,
          confidence: 0,
          sufficientData: false,
          executed: false,
          reason: 'Insufficient bandit data — using fallback tier system',
          latency: Date.now() - start,
        };
      }

      const action = this.bandit.selectAction(context);

      const result = await this.executeAction(action, req, res, assessment);

      const reward = this.computeImmediateReward(action, assessment, result);
      this.bandit.updateReward(context, action, reward);

      const stats = this.bandit.getStats(context);
      const bestProb = stats.actions[action]?.alpha
        ? stats.actions[action].alpha / (stats.actions[action].alpha + stats.actions[action].beta)
        : 0.5;

      logger.info('Bandit decision', {
        action,
        contextKey,
        threatScore: assessment.threatScore,
        reputationTier: repResult.tier,
        reputationScore: repResult.score.toFixed(3),
        reward: reward.toFixed(3),
        confidence: bestProb.toFixed(3),
        latency: Date.now() - start,
        sessionId: assessment.sessionId,
      });

      return {
        action,
        contextKey,
        confidence: bestProb,
        sufficientData: true,
        executed: result,
        reason: `Bandit selected ${action} with probability ${(bestProb * 100).toFixed(0)}%`,
        latency: Date.now() - start,
      };
    } catch (error) {
      logger.error('AdaptiveDecisionEngine error:', error);
      return {
        action: 'monitor',
        contextKey: 'fallback',
        confidence: 0,
        sufficientData: false,
        executed: false,
        reason: `Bandit error: ${error instanceof Error ? error.message : 'Unknown'}`,
        latency: Date.now() - start,
      };
    }
  }

  private async executeAction(
    action: BanditActionType,
    req: Request,
    res: Response,
    assessment: ThreatAssessment,
  ): Promise<boolean> {
    if (res.headersSent) return false;

    const actionConfig: ResponseActionConfig = {};

    switch (action) {
      case 'allow':
        return true;

      case 'divert': {
        const divert = new DivertAction(actionConfig);
        const result = await divert.execute({
          request: req,
          response: res,
          sessionId: assessment.sessionId,
          riskScore: assessment.threatScore,
          userId: assessment.userId,
          ipAddress: assessment.ipAddress,
        });
        return result.success;
      }

      default: {
        if (this.responseEngine) {
          const result = await this.responseEngine.executeResponse(
            req,
            res,
            assessment.threatScore,
            assessment.sessionId,
            assessment.userId,
          );
          return result.success;
        }
        return true;
      }
    }
  }

  private computeImmediateReward(
    action: BanditActionType,
    assessment: ThreatAssessment,
    executed: boolean,
  ): number {
    if (!executed) return 0;

    const { rewardWeights } = this.config;
    let reward = 0;

    const actionSeverity = BANDIT_ACTIONS.indexOf(action) / (BANDIT_ACTIONS.length - 1);

    if (assessment.threatScore > 0.7) {
      if (actionSeverity >= 0.5) {
        reward += rewardWeights.truePositive;
      }
    }

    if (assessment.threatScore <= 0.3 && action === 'allow') {
      reward += rewardWeights.userSatisfaction;
    }

    if (action === 'allow') {
      reward += rewardWeights.resourceCost;
    }

    reward += rewardWeights.threatReduction * (1 - actionSeverity);

    return Math.max(0, Math.min(1, reward));
  }

  getBandit(): ThompsonSampling {
    return this.bandit;
  }

  getConfig(): BanditConfiguration {
    return this.config;
  }
}
