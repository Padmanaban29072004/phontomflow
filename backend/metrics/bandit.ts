export interface BanditMetricPoint {
  timestamp: string;
  context: string;
  arm: string;
  reward: number;
  cumulativeReward: number;
  exploitationRate: number;
  regret: number;
}

export class BanditMetricsCollector {
  private history: BanditMetricPoint[] = [];
  private cumulativeRewardByContext = new Map<string, number>();

  public record(input: { context: string; arm: string; reward: number; exploitationRate: number; regret: number }): void {
    const current = this.cumulativeRewardByContext.get(input.context) || 0;
    const next = current + input.reward;
    this.cumulativeRewardByContext.set(input.context, next);

    this.history.push({
      timestamp: new Date().toISOString(),
      context: input.context,
      arm: input.arm,
      reward: input.reward,
      cumulativeReward: next,
      exploitationRate: input.exploitationRate,
      regret: input.regret,
    });
  }

  public getRecent(limit = 200): BanditMetricPoint[] {
    return this.history.slice(-limit);
  }
}

