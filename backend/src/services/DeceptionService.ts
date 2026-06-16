import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';

export type HoneypotEventPayload = {
  eventId: string;
  honeypotId: string;
  honeypotType: string;
  clientIp: string;
  endpoint: string;
  userAgent: string;
  threatLevel: number;
  sourceService: string;
  timestampUnixMs: number;
}

export interface DeceptionConfig {
  enabled: boolean;
  honeypotEndpoints: string[];
  fakeCredentials: string[];
  decoyFiles: string[];
  trapThreshold: number;
  onHoneypotTriggered?: (payload: HoneypotEventPayload) => void;
}

export interface DeceptionEvent {
  id: string;
  type: 'honeypot_access' | 'credential_trap' | 'decoy_file_access' | 'fake_endpoint_hit';
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class DeceptionService {
  private redisService: RedisService;
  private config: DeceptionConfig;
  private activeTraps: Map<string, any> = new Map();

  constructor(redisService: RedisService, config: DeceptionConfig) {
    this.redisService = redisService;
    this.config = config;
  }

  /**
   * Initialize deception service
   */
  public async initialize(): Promise<void> {
    try {
      if (!this.config.enabled) {
        logger.info('Deception service disabled');
        return;
      }

      await this.setupHoneypots();
      await this.createDecoyFiles();
      await this.setupCredentialTraps();
      
      logger.info('Deception service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize deception service:', error);
      throw error;
    }
  }

  /**
   * Setup honeypot endpoints
   */
  private async setupHoneypots(): Promise<void> {
    for (const endpoint of this.config.honeypotEndpoints) {
      this.activeTraps.set(endpoint, {
        type: 'honeypot',
        created: new Date(),
        accessCount: 0
      });
    }
  }

  /**
   * Create decoy files
   */
  private async createDecoyFiles(): Promise<void> {
    for (const file of this.config.decoyFiles) {
      this.activeTraps.set(file, {
        type: 'decoy_file',
        created: new Date(),
        accessCount: 0
      });
    }
  }

  /**
   * Setup credential traps
   */
  private async setupCredentialTraps(): Promise<void> {
    for (const credential of this.config.fakeCredentials) {
      this.activeTraps.set(credential, {
        type: 'credential_trap',
        created: new Date(),
        accessCount: 0
      });
    }
  }

  /**
   * Check if endpoint is a honeypot
   */
  public isHoneypotEndpoint(path: string): boolean {
    return this.config.honeypotEndpoints.includes(path);
  }

  /**
   * Check if file is a decoy
   */
  public isDecoyFile(filename: string): boolean {
    return this.config.decoyFiles.includes(filename);
  }

  /**
   * Check if credentials are fake
   */
  public isFakeCredential(credential: string): boolean {
    return this.config.fakeCredentials.includes(credential);
  }

  /**
   * Record honeypot access
   */
  public async recordHoneypotAccess(
    path: string,
    ipAddress: string,
    userAgent: string,
    details: Record<string, any>
  ): Promise<DeceptionEvent> {
    const event: DeceptionEvent = {
      id: this.generateEventId(),
      type: 'honeypot_access',
      ipAddress,
      userAgent,
      timestamp: new Date(),
      details,
      threatLevel: this.calculateThreatLevel(details)
    };

    await this.storeDeceptionEvent(event);
    await this.updateTrapAccess(path);
    
    logger.warn('Honeypot accessed:', {
      path,
      ipAddress,
      userAgent,
      threatLevel: event.threatLevel
    });

    if (this.config.onHoneypotTriggered) {
      const tlMap: Record<string, number> = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
      this.config.onHoneypotTriggered({
        eventId: event.id,
        honeypotId: `honeypot:${path.replace(/\//g, '_')}`,
        honeypotType: event.type,
        clientIp: ipAddress,
        endpoint: path,
        userAgent,
        threatLevel: tlMap[event.threatLevel] ?? 0.5,
        sourceService: 'phantom-flow-deception',
        timestampUnixMs: Date.now(),
      });
    }

    return event;
  }

  /**
   * Record credential trap trigger
   */
  public async recordCredentialTrap(
    credential: string,
    ipAddress: string,
    userAgent: string,
    details: Record<string, any>
  ): Promise<DeceptionEvent> {
    const event: DeceptionEvent = {
      id: this.generateEventId(),
      type: 'credential_trap',
      ipAddress,
      userAgent,
      timestamp: new Date(),
      details,
      threatLevel: 'critical'
    };

    await this.storeDeceptionEvent(event);
    await this.updateTrapAccess(credential);
    
    logger.warn('Credential trap triggered:', {
      credential,
      ipAddress,
      userAgent
    });

    return event;
  }

  /**
   * Record decoy file access
   */
  public async recordDecoyFileAccess(
    filename: string,
    ipAddress: string,
    userAgent: string,
    details: Record<string, any>
  ): Promise<DeceptionEvent> {
    const event: DeceptionEvent = {
      id: this.generateEventId(),
      type: 'decoy_file_access',
      ipAddress,
      userAgent,
      timestamp: new Date(),
      details,
      threatLevel: this.calculateThreatLevel(details)
    };

    await this.storeDeceptionEvent(event);
    await this.updateTrapAccess(filename);
    
    logger.warn('Decoy file accessed:', {
      filename,
      ipAddress,
      userAgent,
      threatLevel: event.threatLevel
    });

    return event;
  }

  /**
   * Store deception event in Redis
   */
  private async storeDeceptionEvent(event: DeceptionEvent): Promise<void> {
    try {
      const key = `deception:event:${event.id}`;
      await this.redisService.set(key, JSON.stringify(event), 86400); // 24 hours

      // Store in events list
      await this.redisService.lpush('deception:events', JSON.stringify(event));
      await this.redisService.ltrim('deception:events', 0, 999); // Keep last 1000 events
    } catch (error) {
      logger.error('Failed to store deception event:', error);
    }
  }

  /**
   * Update trap access count
   */
  private async updateTrapAccess(trapId: string): Promise<void> {
    try {
      const trap = this.activeTraps.get(trapId);
      if (trap) {
        trap.accessCount++;
        this.activeTraps.set(trapId, trap);
      }
    } catch (error) {
      logger.error('Failed to update trap access:', error);
    }
  }

  /**
   * Calculate threat level based on access details
   */
  private calculateThreatLevel(details: Record<string, any>): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;

    // Check for suspicious patterns
    if (details.userAgent?.toLowerCase().includes('bot')) score += 2;
    if (details.userAgent?.toLowerCase().includes('curl')) score += 3;
    if (details.userAgent?.toLowerCase().includes('python')) score += 3;
    if (details.ipAddress?.startsWith('192.168.')) score += 1;
    if (details.requestMethod === 'POST') score += 1;
    if (details.body && Object.keys(details.body).length > 0) score += 1;

    if (score >= 5) return 'critical';
    if (score >= 3) return 'high';
    if (score >= 1) return 'medium';
    return 'low';
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `deception_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get deception events
   */
  public async getDeceptionEvents(limit: number = 100): Promise<DeceptionEvent[]> {
    try {
      const events = await this.redisService.lrange('deception:events', 0, limit - 1);
      return events.map(event => JSON.parse(event)).reverse();
    } catch (error) {
      logger.error('Failed to get deception events:', error);
      return [];
    }
  }

  /**
   * Get deception statistics
   */
  public async getDeceptionStats(): Promise<any> {
    try {
      const totalEvents = await this.redisService.llen('deception:events');
      const trapStats = Array.from(this.activeTraps.entries()).map(([id, trap]) => ({
        id,
        type: trap.type,
        accessCount: trap.accessCount,
        created: trap.created
      }));

      return {
        totalEvents,
        activeTraps: trapStats.length,
        trapStats
      };
    } catch (error) {
      logger.error('Failed to get deception stats:', error);
      return {};
    }
  }

  /**
   * Create deception environment for critical threats
   */
  public async createDeceptionEnvironment(assessment: any): Promise<string> {
    try {
      const deceptionId = `deception_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const deceptionUrl = `/deception/${deceptionId}`;
      
      // Store deception session
      await this.redisService.set(`deception:session:${deceptionId}`, JSON.stringify({
        assessment,
        created: new Date(),
        ipAddress: assessment.ipAddress,
        userAgent: assessment.userAgent
      }), 3600); // 1 hour
      
      logger.info('Created deception environment:', {
        deceptionId,
        ipAddress: assessment.ipAddress,
        threatScore: assessment.threatScore
      });
      
      return deceptionUrl;
    } catch (error) {
      logger.error('Failed to create deception environment:', error);
      return '/deception/default';
    }
  }

  /**
   * Get active traps
   */
  public getActiveTraps(): Map<string, any> {
    return new Map(this.activeTraps);
  }
}
