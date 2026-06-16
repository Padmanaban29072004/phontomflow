import { PlaybookSchema, PlaybookActionStep, validatePlaybook } from './playbook.schema';
import { firewallBlockAction } from './actions/firewall';
import { edrQuarantineAction } from './actions/edr';
import { iamResetCredentialAction } from './actions/iam';
import { notifyAction } from './actions/notify';
import { writePlaybookAuditLog } from './auditLog';
import { MultiArmedBanditFramework } from '../bandit/mab';
import { computeReward } from '../bandit/reward';

export interface PlaybookExecutionResult {
  success: boolean;
  playbookId: string;
  stepsExecuted: string[];
  failedStep?: string;
  error?: string;
}

export class PlaybookExecutor {
  private readonly bandit = new MultiArmedBanditFramework();

  public async execute(playbook: PlaybookSchema, operator: 'system' | 'human' = 'system'): Promise<PlaybookExecutionResult> {
    validatePlaybook(playbook);
    const stepsExecuted: string[] = [];

    try {
      for (const step of playbook.steps) {
        await this.executeWithRetry(playbook.id, step, operator);
        stepsExecuted.push(step.id);
      }
      return { success: true, playbookId: playbook.id, stepsExecuted };
    } catch (error) {
      if (playbook.rollback?.length) {
        for (const rollbackStep of playbook.rollback) {
          try {
            await this.executeAction(rollbackStep);
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

  private async executeWithRetry(playbookId: string, step: PlaybookActionStep, operator: 'system' | 'human'): Promise<void> {
    const retries = step.retries ?? 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const result = await this.executeAction(step);
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

  private async executeAction(step: PlaybookActionStep): Promise<{ ok: boolean; detail: string }> {
    switch (step.type) {
      case 'firewall':
        return firewallBlockAction(step.params);
      case 'edr':
        return edrQuarantineAction(step.params);
      case 'iam':
        return iamResetCredentialAction(step.params);
      case 'notify':
        return notifyAction(step.params);
      default:
        throw new Error(`Unsupported action type: ${step.type}`);
    }
  }
}

