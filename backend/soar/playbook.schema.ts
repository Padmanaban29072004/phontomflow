export type PlaybookActionType = 'firewall' | 'edr' | 'iam' | 'notify';

export interface PlaybookActionStep {
  id: string;
  type: PlaybookActionType;
  params: Record<string, any>;
  timeoutMs?: number;
  retries?: number;
}

export interface PlaybookSchema {
  id: string;
  name: string;
  trigger: {
    eventType?: string;
    minRiskScore?: number;
    minConfidence?: number;
  };
  steps: PlaybookActionStep[];
  rollback?: PlaybookActionStep[];
  timeoutMs?: number;
}

export function validatePlaybook(playbook: any): asserts playbook is PlaybookSchema {
  if (!playbook || typeof playbook !== 'object') throw new Error('Playbook must be an object.');
  if (!playbook.id || !playbook.name) throw new Error('Playbook requires id and name.');
  if (!Array.isArray(playbook.steps) || playbook.steps.length === 0) {
    throw new Error('Playbook requires at least one action step.');
  }
}

