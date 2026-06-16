export type TriageOutcome = 'close' | 'auto-respond' | 'escalate';

export interface TriageInput {
  riskScore: number;
  confidence: number;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface TriageDecision {
  outcome: TriageOutcome;
  reason: string;
}

export class DecisionEngine {
  public decide(input: TriageInput): TriageDecision {
    if (input.riskScore < 0.35 && input.confidence < 0.5) {
      return { outcome: 'close', reason: 'Low risk with low confidence likely false positive.' };
    }

    if (
      input.threatLevel === 'critical' ||
      (input.riskScore >= 0.8 && input.confidence >= 0.75)
    ) {
      return { outcome: 'escalate', reason: 'High severity signal requires L2 investigation.' };
    }

    if (input.riskScore >= 0.5 && input.confidence >= 0.6) {
      return { outcome: 'auto-respond', reason: 'Known threat profile with enough confidence.' };
    }

    return { outcome: 'close', reason: 'Insufficient confidence for automated response.' };
  }
}

