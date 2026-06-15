import * as fs from 'fs';
import * as path from 'path';
import { BanditState, BanditContext, BANDIT_ACTIONS } from '@/types/bandit';
import { ThompsonSampling } from '@/core/bandit/ThompsonSampling';
import { BanditConfiguration } from '@/config/banditConfig';
import { logger } from '@/utils/logger';

export class BanditPersistence {
  private bandit: ThompsonSampling;
  private config: BanditConfiguration;
  private filePath: string;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private dirty: boolean = false;

  constructor(
    bandit: ThompsonSampling,
    config: BanditConfiguration,
    filePath?: string,
  ) {
    this.bandit = bandit;
    this.config = config;
    this.filePath = filePath || path.join(process.cwd(), 'data', 'bandit_state.json');
  }

  async initialize(): Promise<void> {
    await this.load();

    this.saveTimer = setInterval(() => {
      if (this.dirty) {
        this.save().catch((err) => logger.warn('Bandit auto-save error:', err));
      }
    }, this.config.persistenceInterval);

    logger.info('BanditPersistence initialized');
  }

  async load(): Promise<void> {
    try {
      if (!fs.existsSync(this.filePath)) {
        logger.info('No persisted bandit state found, using warm-start priors');
        return;
      }

      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as { state: BanditState; timestamp: string };

      if (data.state) {
        this.bandit.loadState(data.state);
        const entryCount = Object.keys(data.state).length;
        logger.info(`Loaded bandit state: ${entryCount} context-action pairs from ${data.timestamp}`);
      }
    } catch (error) {
      logger.warn('Failed to load bandit state:', error);
    }
  }

  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        state: this.bandit.getState(),
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.dirty = false;
    } catch (error) {
      logger.warn('Failed to save bandit state:', error);
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  async shutdown(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.dirty) {
      await this.save();
    }
  }
}
