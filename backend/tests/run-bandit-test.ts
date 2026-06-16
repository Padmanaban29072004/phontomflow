import assert from 'assert';
import { computeReward } from '../src/core/bandit/reward';
import { ThompsonSamplingBandit, MultiArmedBanditFramework } from '../src/core/bandit/mab';

async function main() {
  assert.strictEqual(computeReward({ blockedAttack: true, userImpact: false, missedDetection: false }), 1);
  assert.strictEqual(computeReward({ blockedAttack: false, userImpact: true, missedDetection: false }), -1);
  assert.strictEqual(computeReward({ blockedAttack: false, userImpact: false, missedDetection: true }), -2);

  const model = new ThompsonSamplingBandit(() => 0.42);
  const state = { alpha: 1, beta: 1 };
  model.update(state, 1);
  model.update(state, -1);
  assert.strictEqual(state.alpha, 2);
  assert.strictEqual(state.beta, 2);

  const mab = new MultiArmedBanditFramework();
  const ctx = 'test_ctx';
  mab.registerContext(ctx, ['monitor', 'block', 'isolate']);
  const means: Record<string, number> = { monitor: 0.1, block: 0.9, isolate: 0.4 };
  const counts: Record<string, number> = { monitor: 0, block: 0, isolate: 0 };

  for (let i = 0; i < 2000; i += 1) {
    const arm = mab.select(ctx);
    counts[arm] += 1;
    const reward = Math.random() < means[arm] ? 1 : -1;
    await mab.reward(ctx, arm, reward);
  }

  assert.ok(counts.block > counts.monitor);
  assert.ok(counts.block > counts.isolate);
  console.log('bandit tests passed', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

