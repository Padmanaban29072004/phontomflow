import {
  BanditActionType,
  BanditContext,
  BetaState,
  BanditState,
  BanditStats,
  BanditStatsEntry,
  BANDIT_ACTIONS,
} from '@/types/bandit';
import { BanditConfiguration } from '@/config/banditConfig';
import { logger } from '@/utils/logger';

export class ThompsonSampling {
  private state: BanditState = {};
  private selectionCounts: Map<string, number> = new Map();
  private rewardSums: Map<string, number> = new Map();
  private totalSelections: number = 0;
  private config: BanditConfiguration;
  private rng: () => number;

  constructor(config: BanditConfiguration, rng?: () => number) {
    this.config = config;
    this.rng = rng || Math.random;
    this.initializePriors();
  }

  private contextKey(ctx: BanditContext): string {
    return `threat_${ctx.threatBucket}_reputation_${ctx.reputationTier}`;
  }

  private stateKey(action: BanditActionType, ctx: BanditContext): string {
    return `${this.contextKey(ctx)}:${action}`;
  }

  private initializePriors(): void {
    const emptyContexts: string[] = [];

    for (const bucket of ['low', 'medium', 'high'] as const) {
      for (const tier of ['trusted', 'unknown', 'suspicious'] as const) {
        const ctx: BanditContext = { threatBucket: bucket, reputationTier: tier };
        const key = this.contextKey(ctx);

        for (const action of BANDIT_ACTIONS) {
          const sk = this.stateKey(action, ctx);
          const prior = this.config.warmStartPriors[action];
          this.state[sk] = { alpha: prior.alpha, beta: prior.beta };
          this.selectionCounts.set(sk, 0);
          this.rewardSums.set(sk, 0);
        }

        emptyContexts.push(key);
      }
    }

    this.totalSelections = 0;
  }

  getContext(ctx: BanditContext): string {
    return this.contextKey(ctx);
  }

  selectAction(ctx: BanditContext): BanditActionType {
    const key = this.contextKey(ctx);

    if (this.rng() < this.config.explorationRate) {
      return BANDIT_ACTIONS[Math.floor(this.rng() * BANDIT_ACTIONS.length)];
    }

    let bestAction: BanditActionType = 'allow';
    let bestSample = -Infinity;

    for (const action of BANDIT_ACTIONS) {
      const sk = this.stateKey(action, ctx);
      const beta = this.state[sk];
      if (!beta) continue;

      const sample = this.sampleBeta(beta.alpha, beta.beta);

      if (sample > bestSample) {
        bestSample = sample;
        bestAction = action;
      }
    }

    return bestAction;
  }

  updateReward(ctx: BanditContext, action: BanditActionType, reward: number): void {
    const sk = this.stateKey(action, ctx);
    const beta = this.state[sk];
    if (!beta) return;

    if (reward >= 0.5) {
      beta.alpha += 1;
    } else {
      beta.beta += 1;
    }

    this.selectionCounts.set(sk, (this.selectionCounts.get(sk) || 0) + 1);
    this.rewardSums.set(sk, (this.rewardSums.get(sk) || 0) + reward);
    this.totalSelections++;
  }

  getStats(ctx: BanditContext): BanditStats {
    const key = this.contextKey(ctx);
    const actions: Record<string, BanditStatsEntry> = {};

    let bestAction: BanditActionType | null = null;
    let bestProb = -1;
    let bestActionProb = 0;

    for (const action of BANDIT_ACTIONS) {
      const sk = this.stateKey(action, ctx);
      const beta = this.state[sk];
      const selections = this.selectionCounts.get(sk) || 0;
      const rewardSum = this.rewardSums.get(sk) || 0;

      const expectedProb = beta ? beta.alpha / (beta.alpha + beta.beta) : 0.5;

      actions[action] = {
        alpha: beta?.alpha || 1,
        beta: beta?.beta || 1,
        selectionCount: selections,
        avgReward: selections > 0 ? rewardSum / selections : 0,
      };

      if (expectedProb > bestProb) {
        bestProb = expectedProb;
        bestAction = action;
      }
    }

    return {
      actions,
      context: key,
      totalSelections: this.totalSelections,
      currentBestAction: bestAction,
      bestActionProbability: bestProb,
    };
  }

  getAllStats(): Record<string, BanditStats> {
    const all: Record<string, BanditStats> = {};

    for (const bucket of ['low', 'medium', 'high'] as const) {
      for (const tier of ['trusted', 'unknown', 'suspicious'] as const) {
        const ctx: BanditContext = { threatBucket: bucket, reputationTier: tier };
        all[this.contextKey(ctx)] = this.getStats(ctx);
      }
    }

    return all;
  }

  getState(): BanditState {
    return { ...this.state };
  }

  loadState(state: BanditState): void {
    for (const [key, beta] of Object.entries(state)) {
      if (this.state[key]) {
        this.state[key] = beta;
      }
    }
  }

  hasSufficientData(ctx: BanditContext): boolean {
    for (const action of BANDIT_ACTIONS) {
      const sk = this.stateKey(action, ctx);
      const selections = this.selectionCounts.get(sk) || 0;
      if (selections < this.config.minSamplesPerAction) {
        return false;
      }
    }
    return true;
  }

  private sampleBeta(alpha: number, beta: number): number {
    if (alpha <= 0 || beta <= 0) {
      return alpha / (alpha + beta);
    }

    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  private sampleGamma(shape: number): number {
    if (shape < 1) {
      const u = this.rng();
      return this.sampleGamma(shape + 1) * Math.pow(u, 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    for (let i = 0; i < 100; i++) {
      const v1 = this.rng();
      const v2 = this.rng();

      const z = (Math.sqrt(-2 * Math.log(v1)) * Math.cos(2 * Math.PI * v2)) || 0.01;
      const w = 1 + c * z;

      if (w <= 0) continue;

      const u = this.rng();
      const w3 = w * w * w;

      if (u < 1 - 0.0331 * z * z * z * z) {
        return d * w3;
      }

      if (Math.log(u) < 0.5 * z * z + d * (1 - w3 + Math.log(w3))) {
        return d * w3;
      }
    }

    return d;
  }

  getSelectionCount(action: BanditActionType, ctx: BanditContext): number {
    return this.selectionCounts.get(this.stateKey(action, ctx)) || 0;
  }

  reset(): void {
    this.state = {};
    this.selectionCounts.clear();
    this.rewardSums.clear();
    this.totalSelections = 0;
    this.initializePriors();
  }
}
