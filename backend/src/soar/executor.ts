import { PlaybookSchema, PlaybookActionStep, validatePlaybook } from './playbook.schema';
import { firewallBlockAction } from './actions/firewall';
import { edrQuarantineAction } from './actions/edr';
import { iamResetCredentialAction } from './actions/iam';
import { notifyAction } from './actions/notify';
import { writePlaybookAuditLog } from './auditLog';
import { MultiArmedBanditFramework } from '../core/bandit/mab';
import { computeReward } from '../core/bandit/reward';

export interface PlaybookExecutionResult {
  success: boolean;
  playbookId: string;
  stepsExecuted: string[];
  failedStep?: string;
  error?: string;
}

export class PlaybookExecutor {
  private readonly bandit = new MultiArmedBanditFramework();

  public async execute(playbook: PlaybookSchema, contextOrOperator?: Record<string, any> | 'system' | 'human', maybeOperator?: 'system' | 'human'): Promise<PlaybookExecutionResult> {
    let operator: 'system' | 'human' = 'system';
    let context: Record<string, any> = {};
    if (typeof contextOrOperator === 'string') {
      operator = contextOrOperator;
    } else if (contextOrOperator) {
      context = contextOrOperator;
      operator = maybeOperator ?? 'system';
    }
    validatePlaybook(playbook);
    const stepsExecuted: string[] = [];

    try {
      for (const step of playbook.steps) {
        await this.executeWithRetry(playbook.id, step, operator, context);
        stepsExecuted.push(step.id);
      }
      return { success: true, playbookId: playbook.id, stepsExecuted };
    } catch (error) {
      if (playbook.rollback?.length) {
        for (const rollbackStep of playbook.rollback) {
          try {
            await this.executeAction(rollbackStep, context);
          } catch {
            // best-effort rollback
          }
        }
      }
      return {
        success: false,
        playbookId: playbook.id,
        stepsExecuted,
        failedStep: playbook.steps[stepsExecuted.length]?.id,
        error: error instanceof Error ? error.message : 'Unknown execution error',
      };
    }
  }

  // T45: bandit selects playbook, execution outcome is fed back as reward signal.
  public async executeWithBandit(
    contextKey: string,
    candidatePlaybooks: PlaybookSchema[],
    outcome: { blockedAttack: boolean; userImpact: boolean; missedDetection: boolean },
    operator: 'system' | 'human' = 'system'
  ): Promise<PlaybookExecutionResult> {
    if (!candidatePlaybooks.length) {
      throw new Error('No playbooks available for bandit selection');
    }
    this.bandit.registerContext(contextKey, candidatePlaybooks.map((p) => p.id));
    const selectedId = this.bandit.select(contextKey);
    const selected = candidatePlaybooks.find((p) => p.id === selectedId) || candidatePlaybooks[0];
    const result = await this.execute(selected, operator);

    const reward = computeReward(outcome);
    await this.bandit.reward(contextKey, selected.id, reward);
    return result;
  }

  private interpolate(value: any, context?: Record<string, any>): any {
    if (!context || typeof value !== 'string') return value;
    return value.replace(/\{\{(\w+)\}\}/g, (_m: string, key: string) => String(context[key] ?? ''));
  }

  private resolveParams(params: Record<string, any>, context?: Record<string, any>): Record<string, any> {
    if (!context) return params;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(params || {})) {
      out[k] = this.interpolate(v, context);
    }
    return out;
  }

  private async executeWithRetry(playbookId: string, step: PlaybookActionStep, operator: 'system' | 'human', context?: Record<string, any>): Promise<void> {
    const retries = step.retries ?? 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const result = await this.executeAction(step, context);
        await writePlaybookAuditLog({
          playbook_id: playbookId,
          action: `${step.type}:${step.id}`,
          result: result.detail,
          operator,
          details: { attempt, params: step.params },
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Action failed after retries');
  }

  private async executeAction(step: PlaybookActionStep, context?: Record<string, any>): Promise<{ ok: boolean; detail: string }> {
    const params = this.resolveParams(step.params, context);
    switch (step.type) {
      case 'firewall':
        return firewallBlockAction(params as { sourceIp: string });
      case 'edr':
        return edrQuarantineAction(params as { hostId: string });
      case 'iam':
        return iamResetCredentialAction(params as { userId: string });
      case 'notify':
        return notifyAction(params as { message: string; severity?: string });
      default:
        throw new Error(`Unsupported action type: ${step.type}`);
    }
  }
}

