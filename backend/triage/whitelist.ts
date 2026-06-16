import { RedisService } from '../src/services/RedisService';

export interface WhitelistRule {
  id: string;
  field: 'src_ip' | 'user_id' | 'event_type' | 'rule_id';
  value: string;
  tuneFactor?: number; // 0..1 where lower suppresses more
}

export class WhitelistEngine {
  constructor(private readonly redis = new RedisService()) {}

  private key(ruleId: string): string {
    return `triage:whitelist:${ruleId}`;
  }

  public async putRule(rule: WhitelistRule): Promise<void> {
    await this.redis.set(this.key(rule.id), JSON.stringify(rule), 60 * 60 * 24 * 30);
  }

  public async getRule(ruleId: string): Promise<WhitelistRule | null> {
    const raw = await this.redis.get(this.key(ruleId));
    return raw ? (JSON.parse(raw) as WhitelistRule) : null;
  }

  public async shouldSuppress(ruleId: string, observedValue: string): Promise<boolean> {
    const rule = await this.getRule(ruleId);
    if (!rule) return false;
    if (rule.value !== observedValue) return false;
    const factor = typeof rule.tuneFactor === 'number' ? rule.tuneFactor : 0.2;
    return factor <= 0.5;
  }
}

