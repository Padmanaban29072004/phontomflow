export interface BetaArmState {
  alpha: number;
  beta: number;
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

