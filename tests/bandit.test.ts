import { computeReward } from '../backend/bandit/reward';
import { ThompsonSamplingBandit } from '../backend/bandit/thompson';
import { MultiArmedBanditFramework } from '../backend/bandit/mab';

describe('Phase 6 bandit learning', () => {
  it('computes reward function values', () => {
    expect(computeReward({ blockedAttack: true, userImpact: false, missedDetection: false })).toBe(1);
    expect(computeReward({ blockedAttack: false, userImpact: true, missedDetection: false })).toBe(-1);
    expect(computeReward({ blockedAttack: false, userImpact: false, missedDetection: true })).toBe(-2);
  });

  it('updates beta parameters with rewards', () => {
    const model = new ThompsonSamplingBandit(() => 0.42);
    const state = { alpha: 1, beta: 1 };
    model.update(state, 1);
    model.update(state, -1);
    expect(state.alpha).toBe(2);
    expect(state.beta).toBe(2);
  });

  it('converges toward best arm under synthetic rewards', async () => {
    const mab = new MultiArmedBanditFramework();
    const context = 'test_ctx';
    const arms = ['monitor', 'block', 'isolate'];
    mab.registerContext(context, arms);

    const trueMeans: Record<string, number> = {
      monitor: 0.1,
      block: 0.9,
      isolate: 0.4,
    };

    const selectionCounts: Record<string, number> = { monitor: 0, block: 0, isolate: 0 };

    for (let i = 0; i < 10000; i += 1) {
      const arm = mab.select(context);
      selectionCounts[arm] += 1;
      const reward = Math.random() < trueMeans[arm] ? 1 : -1;
      await mab.reward(context, arm, reward);
    }

    // Should heavily prefer best arm (block) by 500+ episodes trend and by the end.
    expect(selectionCounts.block).toBeGreaterThan(selectionCounts.monitor);
    expect(selectionCounts.block).toBeGreaterThan(selectionCounts.isolate);
  });
});

