export interface AnalyzerOutputs {
  behavioralScore: number;
  statisticalScore: number;
  relationshipScore: number;
}

export interface TtpMappingResult {
  ttpIds: string[];
  confidence: number;
  rationale: string[];
}

const TTP_MAP = {
  behavioral: 'T1078', // Valid Accounts
  statistical: 'T1499', // Endpoint DoS
  relationship: 'T1021', // Remote Services
  brute_force: 'T1110',
  exfiltration: 'T1041',
};

export function mapAnalyzersToTtp(outputs: AnalyzerOutputs): TtpMappingResult {
  const ttpIds = new Set<string>();
  const rationale: string[] = [];

  if (outputs.behavioralScore > 0.7) {
    ttpIds.add(TTP_MAP.behavioral);
    rationale.push('Behavioral anomalies indicate suspicious account behavior.');
  }
  if (outputs.statisticalScore > 0.7) {
    ttpIds.add(TTP_MAP.statistical);
    rationale.push('Traffic anomalies align with service abuse patterns.');
  }
  if (outputs.relationshipScore > 0.7) {
    ttpIds.add(TTP_MAP.relationship);
    rationale.push('Entity relationships suggest pivot/lateral movement.');
  }
  if (outputs.behavioralScore > 0.8 && outputs.statisticalScore > 0.8) {
    ttpIds.add(TTP_MAP.brute_force);
    rationale.push('Combined burst + auth behavior maps to brute force activity.');
  }
  if (outputs.relationshipScore > 0.75 && outputs.statisticalScore > 0.75) {
    ttpIds.add(TTP_MAP.exfiltration);
    rationale.push('Correlated network spread and transfer volume suggest exfiltration.');
  }

  const confidence = Math.min(
    1,
    (outputs.behavioralScore + outputs.statisticalScore + outputs.relationshipScore) / 3
  );

  return {
    ttpIds: Array.from(ttpIds),
    confidence,
    rationale,
  };
}

