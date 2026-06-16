import axios from 'axios';
import { logger } from '@/utils/logger';
import { PlaybookActionStep, PlaybookSchema } from './types';

export interface PlaybookExecutionResult {
  success: boolean;
  playbookId: string;
  stepsExecuted: string[];
  failedStep?: string;
  error?: string;
}

export class PlaybookExecutor {
  public async execute(
    playbook: PlaybookSchema,
    context: Record<string, any>,
    operator: 'system' | 'human'
  ): Promise<PlaybookExecutionResult> {
    const stepsExecuted: string[] = [];
    try {
      for (const step of playbook.steps) {
        await this.executeWithRetry(step, context);
        stepsExecuted.push(step.id);
        logger.info('SOAR step executed', { playbookId: playbook.id, stepId: step.id, operator });
      }
      return { success: true, playbookId: playbook.id, stepsExecuted };
    } catch (error) {
      if (playbook.rollback?.length) {
        for (const rb of playbook.rollback) {
          try {
            await this.executeAction(rb, context);
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

  private interpolate(value: any, context: Record<string, any>): any {
    if (typeof value !== 'string') return value;
    return value.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(context[key] ?? ''));
  }

  private resolveParams(params: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(params || {})) {
      out[k] = this.interpolate(v, context);
    }
    return out;
  }

  private async executeWithRetry(step: PlaybookActionStep, context: Record<string, any>): Promise<void> {
    const retries = step.retries ?? 1;
    let lastErr: unknown;
    for (let i = 0; i < retries; i += 1) {
      try {
        await this.executeAction(step, context);
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Step failed after retries');
  }

  private async executeAction(step: PlaybookActionStep, context: Record<string, any>): Promise<void> {
    const params = this.resolveParams(step.params, context);
    if (step.type === 'notify') {
      const slackWebhook = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhook) {
        await axios.post(slackWebhook, { text: params.message || 'PHANTOM-Flow alert' }, { timeout: 8000 });
      }
      return;
    }
    if (step.type === 'firewall' || step.type === 'edr' || step.type === 'iam') {
      // Safe default in development: simulate action.
      logger.info('Simulated SOAR action', { type: step.type, params });
      return;
    }
    throw new Error(`Unsupported action type: ${step.type}`);
  }
}

