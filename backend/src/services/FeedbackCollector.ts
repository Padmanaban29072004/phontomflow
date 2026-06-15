import { ThompsonSampling } from '@/core/bandit/ThompsonSampling';
import { BanditPersistence } from '@/services/BanditPersistence';
import { BanditActionType, BanditContext, BANDIT_ACTIONS } from '@/types/bandit';
import { BanditConfiguration, getDefaultBanditConfiguration } from '@/config/banditConfig';
import { logger } from '@/utils/logger';

export type FeedbackSignal =
  | 'true_positive'
  | 'false_positive'
  | 'user_satisfied'
  | 'user_unsatisfied'
  | 'cost_low'
  | 'cost_high'
  | 'threat_reduced'
  | 'threat_persisted';

export interface FeedbackEvent {
  action: BanditActionType;
  context: BanditContext;
  signals: FeedbackSignal[];
  timestamp: string;
  sessionId?: string;
  userId?: string;
}

export class FeedbackCollector {
  private bandit: ThompsonSampling;
  private persistence: BanditPersistence;
  private config: BanditConfiguration;
  private feedbackLog: FeedbackEvent[] = [];
  private maxLogSize: number = 1000;

  constructor(
    bandit: ThompsonSampling,
    persistence: BanditPersistence,
    config?: Partial<BanditConfiguration>,
  ) {
    this.bandit = bandit;
    this.persistence = persistence;
    this.config = { ...getDefaultBanditConfiguration(), ...config };
  }

  processFeedback(event: FeedbackEvent): number {
    const reward = this.computeRewardFromSignals(event.signals);
    this.bandit.updateReward(event.context, event.action, reward);

    this.feedbackLog.push(event);
    if (this.feedbackLog.length > this.maxLogSize) {
      this.feedbackLog.shift();
    }

    this.persistence.markDirty();

    return reward;
  }

  submitManualFeedback(
    action: BanditActionType,
    context: BanditContext,
    signals: FeedbackSignal[],
    sessionId?: string,
    userId?: string,
  ): number {
    const event: FeedbackEvent = {
      action,
      context,
      signals,
      timestamp: new Date().toISOString(),
      sessionId,
      userId,
    };

    return this.processFeedback(event);
  }

  submitAutoFeedback(
    action: BanditActionType,
    context: BanditContext,
    threatScore: number,
    hadSubsequentThreat: boolean,
    userCompletedSuccessfully: boolean,
    sessionId?: string,
  ): number {
    const signals: FeedbackSignal[] = [];

    if (threatScore > 0.7 && action !== 'allow') {
      signals.push('true_positive');
    }

    if (threatScore <= 0.3 && action !== 'allow') {
      signals.push('false_positive');
    }

    if (userCompletedSuccessfully) {
      signals.push('user_satisfied');
    } else {
      signals.push('user_unsatisfied');
    }

    if (action === 'allow' || action === 'monitor') {
      signals.push('cost_low');
    } else {
      signals.push('cost_high');
    }

    if (!hadSubsequentThreat) {
      signals.push('threat_reduced');
    } else {
      signals.push('threat_persisted');
    }

    return this.processFeedback({
      action,
      context,
      signals,
      timestamp: new Date().toISOString(),
      sessionId,
    });
  }

  getRecentFeedback(count: number = 20): FeedbackEvent[] {
    return this.feedbackLog.slice(-count);
  }

  getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      totalFeedback: this.feedbackLog.length,
    };

    for (const action of BANDIT_ACTIONS) {
      const count = this.feedbackLog.filter((e) => e.action === action).length;
      stats[`${action}_count`] = count;
    }

    const signalCounts: Record<string, number> = {};
    for (const event of this.feedbackLog) {
      for (const signal of event.signals) {
        signalCounts[signal] = (signalCounts[signal] || 0) + 1;
      }
    }
    for (const [signal, count] of Object.entries(signalCounts)) {
      stats[`signal_${signal}`] = count;
    }

    return stats;
  }

  private computeRewardFromSignals(signals: FeedbackSignal[]): number {
    const { rewardWeights } = this.config;
    let reward = 0;

    for (const signal of signals) {
      switch (signal) {
        case 'true_positive':
          reward += rewardWeights.truePositive;
          break;
        case 'false_positive':
          reward -= rewardWeights.falsePositive;
          break;
        case 'user_satisfied':
          reward += rewardWeights.userSatisfaction;
          break;
        case 'user_unsatisfied':
          reward -= rewardWeights.userSatisfaction * 0.5;
          break;
        case 'cost_low':
          reward += rewardWeights.resourceCost;
          break;
        case 'cost_high':
          reward -= rewardWeights.resourceCost * 0.5;
          break;
        case 'threat_reduced':
          reward += rewardWeights.threatReduction;
          break;
        case 'threat_persisted':
          reward -= rewardWeights.threatReduction * 0.5;
          break;
      }
    }

    return Math.max(0, Math.min(1, reward));
  }
}
