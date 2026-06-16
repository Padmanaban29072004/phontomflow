import fs from 'fs';
import path from 'path';
import { UnifiedEventSchema } from '../ingestion/types';

export interface SigmaRule {
  id: string;
  title: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  eventType?: string;
  contains?: string[];
}

export interface SigmaMatch {
  ruleId: string;
  title: string;
  level: SigmaRule['level'];
  matchedFields: string[];
}

export class SigmaEngine {
  private rules: SigmaRule[] = [];

  public loadRulesFromDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    this.rules = files.map((file) => this.parseRuleText(fs.readFileSync(path.join(dirPath, file), 'utf8')));
  }

  public setRules(rules: SigmaRule[]): void {
    this.rules = rules;
  }

  public evaluate(event: UnifiedEventSchema): SigmaMatch[] {
    return this.rules
      .map((rule) => this.matchRule(rule, event))
      .filter((m): m is SigmaMatch => m !== null);
  }

  private parseRuleText(raw: string): SigmaRule {
    // Lightweight YAML-like parser for common rule fields.
    const get = (key: string): string | undefined => {
      const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return match?.[1]?.trim()?.replace(/^["']|["']$/g, '');
    };
    const containsLines = raw
      .split('\n')
      .filter((line) => line.trim().startsWith('- '))
      .map((line) => line.trim().slice(2).trim())
      .filter(Boolean);

    return {
      id: get('id') || `sigma-${Date.now()}`,
      title: get('title') || 'Untitled Sigma Rule',
      level: (get('level') as SigmaRule['level']) || 'medium',
      eventType: get('event_type') || undefined,
      contains: containsLines.length ? containsLines : undefined,
    };
  }

  private matchRule(rule: SigmaRule, event: UnifiedEventSchema): SigmaMatch | null {
    const matchedFields: string[] = [];
    if (rule.eventType && rule.eventType !== event.event_type) {
      return null;
    }
    if (rule.eventType) matchedFields.push('event_type');

    if (rule.contains?.length) {
      const haystack = JSON.stringify(event.raw_payload).toLowerCase();
      const allFound = rule.contains.every((needle) => haystack.includes(needle.toLowerCase()));
      if (!allFound) return null;
      matchedFields.push('raw_payload');
    }

    return {
      ruleId: rule.id,
      title: rule.title,
      level: rule.level,
      matchedFields,
    };
  }
}

