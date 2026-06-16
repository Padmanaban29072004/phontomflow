export interface RewardSignalInput {
  blockedAttack: boolean;
  userImpact: boolean;
  missedDetection: boolean;
}

export function computeReward(input: RewardSignalInput): number {
  if (input.missedDetection) return -2;
  if (input.blockedAttack && !input.userImpact) return 1;
  if (!input.blockedAttack && input.userImpact) return -1;
  if (input.blockedAttack && input.userImpact) return -1;
  return 0;
}
