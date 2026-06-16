import { ThompsonSamplingBandit, BetaArmState } from './thompson';
import { createClient, RedisClientType } from 'redis';

export interface ArmStats extends BetaArmState {
  selections: number;
  rewardSum: number;
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

