export interface RewardSignalInput {
  blockedAttack: boolean;
  userImpact: boolean;
  missedDetection: boolean;
}

// T42: +1 block success no impact, -1 false positive, -2 missed detection
export function computeReward(input: RewardSignalInput): number {
  if (input.missedDetection) return -2;
  if (input.blockedAttack && !input.userImpact) return 1;
  if (!input.blockedAttack && input.userImpact) return -1;
  if (input.blockedAttack && input.userImpact) return -1;
  return 0;
}

