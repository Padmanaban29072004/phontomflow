import {
  BanditActionType,
  WarmStartPriors,
} from '@/types/bandit';

export interface BanditConfiguration {
  enabled: boolean;
  explorationRate: number;
  warmStartPriors: WarmStartPriors;
  rewardWeights: {
    truePositive: number;
    falsePositive: number;
    userSatisfaction: number;
    resourceCost: number;
    threatReduction: number;
  };
  threatBuckets: number[];
  reputationThresholds: number[];
  minSamplesPerAction: number;
  persistenceInterval: number;
}

export const getDefaultBanditConfiguration = (): BanditConfiguration => ({
  enabled: process.env.BANDIT_ENABLED !== 'false',
  explorationRate: parseFloat(process.env.BANDIT_EXPLORATION_RATE || '0.15'),

  // Warm-start priors match current fixed thresholds:
  // - lower-severity actions start with higher α (more assumed successes)
  // - higher-severity actions start with lower α (more cautious)
  warmStartPriors: {
    allow:    { alpha: 10, beta: 1 },  // Highly trusted default
    monitor:  { alpha: 8,  beta: 1 },  // Very safe
    warn:     { alpha: 6,  beta: 2 },  // Safe
    restrict: { alpha: 4,  beta: 3 },  // Moderate
    block:    { alpha: 3,  beta: 4 },  // Cautious
    isolate:  { alpha: 2,  beta: 5 },  // Rarely needed
    divert:   { alpha: 3,  beta: 3 },  // Balanced start
  },

  // Reward function weights (must sum to 1.0)
  rewardWeights: {
    truePositive:      0.30,
    falsePositive:     0.25,
    userSatisfaction:  0.15,
    resourceCost:      0.10,
    threatReduction:   0.20,
  },

  // Context bucket thresholds (inclusive upper bound)
  threatBuckets: [0.3, 0.7],  // low: <=0.3, medium: <=0.7, high: >0.7
  reputationThresholds: [0.4, 0.7],  // suspicious: <=0.4, unknown: <=0.7, trusted: >0.7

  // Require at least this many samples before trusting bandit over fallback
  minSamplesPerAction: parseInt(process.env.BANDIT_MIN_SAMPLES || '10'),

  // Persist bandit state every 5 minutes
  persistenceInterval: parseInt(process.env.BANDIT_PERSIST_INTERVAL || '300000'),
});
