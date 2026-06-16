import { SigmaEngine } from '../backend/detection/sigma';
import { PayloadHeuristicsAnalyzer } from '../backend/detection/payloadHeuristics';
import { YaraScanner } from '../backend/detection/yara';
import { mapAnalyzersToTtp } from '../backend/detection/ttp_mapper';
import { DecisionEngine } from '../backend/triage/decisionEngine';

describe('Phase 2 detection and triage', () => {
  it('evaluates sigma, payload, yara, ttp mapping and triage decision', async () => {
    const sigma = new SigmaEngine();
    sigma.setRules([
      {
        id: 'sigma-auth-bruteforce',
        title: 'Auth brute force',
        level: 'high',
        eventType: 'login_failed',
        contains: ['password', 'failed'],
      },
    ]);

    const event = {
      event_id: 'evt-1',
      source: 'test',
      src_ip: '1.2.3.4',
      timestamp: new Date().toISOString(),
      event_type: 'login_failed',
      severity: 'high' as const,
      raw_payload: { message: 'password failed for admin' },
    };
    expect(sigma.evaluate(event)).toHaveLength(1);

    const payloadAnalyzer = new PayloadHeuristicsAnalyzer();
    const payloadResult = await payloadAnalyzer.analyze({
      requestPath: '/api/login',
      query: {},
      headers: {},
      body: { username: 'admin', password: "' OR 1=1 --" },
    });
    expect(payloadResult.riskScore).toBeGreaterThan(0);

    const yara = new YaraScanner();
    const yaraResult = await yara.scanPayload('powershell -enc AAAA');
    expect(typeof yaraResult.matched).toBe('boolean');

    const ttp = mapAnalyzersToTtp({
      behavioralScore: 0.82,
      statisticalScore: 0.76,
      relationshipScore: 0.73,
    });
    expect(ttp.ttpIds.length).toBeGreaterThan(0);

    const triage = new DecisionEngine();
    const decision = triage.decide({
      riskScore: payloadResult.riskScore,
      confidence: payloadResult.confidence,
      threatLevel: payloadResult.threatLevel,
    });
    expect(['close', 'auto-respond', 'escalate']).toContain(decision.outcome);
  });
});

