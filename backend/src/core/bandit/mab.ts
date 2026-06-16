import { createClient, RedisClientType } from 'redis';

export interface BetaArmState {
  alpha: number;
  beta: number;
}

export interface ArmStats extends BetaArmState {
  selections: number;
  rewardSum: number;
}

export class ThompsonSamplingBandit {
  constructor(private readonly rng: () => number = Math.random) {}

  public selectArm(arms: Record<string, BetaArmState>): string {
    let bestArm = Object.keys(arms)[0] || 'default';
    let bestSample = -Infinity;

    for (const [arm, state] of Object.entries(arms)) {
      const sample = this.sampleBeta(state.alpha, state.beta);
      if (sample > bestSample) {
        bestSample = sample;
        bestArm = arm;
      }
    }
    return bestArm;
  }

  public update(state: BetaArmState, reward: number): BetaArmState {
    if (reward > 0) {
      state.alpha += 1;
    } else {
      state.beta += 1;
    }
    return state;
  }

  private sampleBeta(alpha: number, beta: number): number {
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
    while (true) {
      const u1 = this.rng();
      const u2 = this.rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const v = Math.pow(1 + c * z, 3);
      if (v <= 0) continue;
      const u = this.rng();
      if (u < 1 - 0.0331 * Math.pow(z, 4)) return d * v;
      if (Math.log(u) < 0.5 * z * z + d * (1 - v + Math.log(v))) return d * v;
    }
  }
}

export class MultiArmedBanditFramework {
  private readonly model = new ThompsonSamplingBandit();
  private readonly state = new Map<string, Record<string, ArmStats>>();
  private redis?: RedisClientType;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = createClient({ url: redisUrl });
      this.redis.connect().catch(() => {
        this.redis = undefined;
      });
    }
  }

  public registerContext(contextKey: string, arms: string[]): void {
    if (this.state.has(contextKey)) return;
    const initial: Record<string, ArmStats> = {};
    for (const arm of arms) {
      initial[arm] = { alpha: 1, beta: 1, selections: 0, rewardSum: 0 };
    }
    this.state.set(contextKey, initial);
  }

  public select(contextKey: string): string {
    const ctx = this.state.get(contextKey);
    if (!ctx) throw new Error(`Unknown context ${contextKey}`);
    const arm = this.model.selectArm(ctx);
    ctx[arm].selections += 1;
    return arm;
  }

  public async reward(contextKey: string, arm: string, reward: number): Promise<void> {
    const ctx = this.state.get(contextKey);
    if (!ctx || !ctx[arm]) return;
    this.model.update(ctx[arm], reward);
    ctx[arm].rewardSum += reward;
    if (this.redis?.isOpen) {
      await this.redis.set(`bandit:${contextKey}`, JSON.stringify(ctx), { EX: 86400 });
    }
  }

  public getStats(contextKey: string): Record<string, ArmStats> {
    return this.state.get(contextKey) || {};
  }
}
