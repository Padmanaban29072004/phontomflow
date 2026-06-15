export type BanditActionType =
  | 'allow'
  | 'monitor'
  | 'warn'
  | 'restrict'
  | 'block'
  | 'isolate'
  | 'divert';

export interface BanditContext {
  threatBucket: 'low' | 'medium' | 'high';
  reputationTier: 'trusted' | 'unknown' | 'suspicious';
}

export interface BetaState {
  alpha: number;
  beta: number;
}

export type BanditState = Record<string, BetaState>;

export interface RewardSignal {
  action: BanditActionType;
  reward: number;
  context: BanditContext;
  timestamp: string;
  sessionId?: string;
}

export interface BanditStatsEntry {
  alpha: number;
  beta: number;
  selectionCount: number;
  avgReward: number;
}

export interface BanditStats {
  actions: Record<string, BanditStatsEntry>;
  context: string;
  totalSelections: number;
  currentBestAction: BanditActionType | null;
  bestActionProbability: number;
}

export interface WarmStartPrior {
  alpha: number;
  beta: number;
}

export type WarmStartPriors = Record<BanditActionType, WarmStartPrior>;

export interface ContextFeatures {
  threatScore: number;
  userReputation: number;
  graphRisk: number;
  hourOfDay: number;
  sessionActionCount: number;
  isBot: boolean;
}

export const BANDIT_ACTIONS: BanditActionType[] = [
  'allow',
  'monitor',
  'warn',
  'restrict',
  'block',
  'isolate',
  'divert',
];

export const ACTION_SEVERITY: Record<BanditActionType, number> = {
  allow: 0,
  monitor: 1,
  warn: 2,
  restrict: 3,
  block: 4,
  isolate: 5,
  divert: 6,
};
