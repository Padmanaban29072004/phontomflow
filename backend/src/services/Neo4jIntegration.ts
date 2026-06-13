import { Neo4jService } from '@/graph/Neo4jService';
import { UserRepository } from '@/graph/repositories/UserRepository';
import { SessionRepository } from '@/graph/repositories/SessionRepository';
import { IPRepository } from '@/graph/repositories/IPRepository';
import { DeviceRepository } from '@/graph/repositories/DeviceRepository';
import { ResourceRepository } from '@/graph/repositories/ResourceRepository';
import { ThreatRepository } from '@/graph/repositories/ThreatRepository';
import { logger } from '@/utils/logger';

export interface GraphableRequest {
  ipAddress: string;
  sessionId: string;
  userId?: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  threatScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  threatType: string[];
  deviceFingerprint?: string;
}

export class Neo4jIntegration {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;
  private ipRepo: IPRepository;
  private deviceRepo: DeviceRepository;
  private resourceRepo: ResourceRepository;
  private threatRepo: ThreatRepository;
  private requestCounter: number = 0;

  constructor(private neo4j: Neo4jService) {
    this.userRepo = new UserRepository(neo4j);
    this.sessionRepo = new SessionRepository(neo4j);
    this.ipRepo = new IPRepository(neo4j);
    this.deviceRepo = new DeviceRepository(neo4j);
    this.resourceRepo = new ResourceRepository(neo4j);
    this.threatRepo = new ThreatRepository(neo4j);
  }

  async persistRequest(data: GraphableRequest): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      const timestamp = new Date().toISOString();
      this.requestCounter++;

      const ip = await this.persistIP(data, timestamp);
      const resource = await this.persistResource(data);
      const deviceId = data.deviceFingerprint
        ? await this.persistDevice(data, timestamp)
        : undefined;

      if (data.userId) {
        await this.persistUser(data, timestamp);
        await this.persistSession(data, timestamp);
        await this.userRepo.linkSession(data.userId, data.sessionId, { timestamp });
        await this.sessionRepo.linkResource(data.sessionId, resource, { timestamp });

        if (deviceId) {
          await this.deviceRepo.linkSession(deviceId, data.sessionId, { timestamp });
        }
      }

      if (ip) {
        await this.sessionRepo.linkIP(data.sessionId, ip, { timestamp });
      }

      if (data.threatScore >= 0.5) {
        await this.persistThreat(data, timestamp);
      }
    } catch (error) {
      logger.warn('Neo4jIntegration.persistRequest error:', error);
    }
  }

  private async persistIP(data: GraphableRequest, timestamp: string): Promise<string | null> {
    if (!data.ipAddress) return null;

    await this.ipRepo.createOrUpdate({
      address: data.ipAddress,
      lastSeen: timestamp,
      firstSeen: timestamp,
    });

    return data.ipAddress;
  }

  private async persistResource(data: GraphableRequest): Promise<string> {
    const resourceId = `${data.requestMethod}:${data.requestPath}`;
    const type = this.classifyResourcePath(data.requestPath);

    await this.resourceRepo.createOrUpdate({
      id: resourceId,
      path: data.requestPath,
      method: data.requestMethod,
      type,
    });

    return resourceId;
  }

  private async persistDevice(data: GraphableRequest, timestamp: string): Promise<string> {
    const deviceId = data.deviceFingerprint || `device-${Buffer.from(data.userAgent || '').toString('base64').slice(0, 16)}`;

    await this.deviceRepo.createOrUpdate({
      id: deviceId,
      fingerprint: data.deviceFingerprint,
      lastSeen: timestamp,
      firstSeen: timestamp,
    });

    return deviceId;
  }

  private async persistUser(data: GraphableRequest, timestamp: string): Promise<void> {
    await this.userRepo.createOrUpdate({
      id: data.userId!,
      username: data.userId!,
      riskScore: data.threatScore,
      lastSeen: timestamp,
      firstSeen: timestamp,
    });
  }

  private async persistSession(data: GraphableRequest, timestamp: string): Promise<void> {
    await this.sessionRepo.create({
      id: data.sessionId,
      userAgent: data.userAgent,
      startTime: timestamp,
      actionCount: 1,
    });
  }

  private async persistThreat(data: GraphableRequest, timestamp: string): Promise<void> {
    const threatId = `threat-${this.requestCounter}-${Date.now()}`;

    await this.threatRepo.create({
      id: threatId,
      type: data.threatType[0] || 'unknown',
      severity: data.riskLevel,
      score: data.threatScore,
      timestamp,
      description: `Threat detected: ${data.threatType.join(', ')} from ${data.ipAddress}`,
    });

    await this.threatRepo.linkIP(threatId, data.ipAddress, { timestamp });

    if (data.userId) {
      await this.threatRepo.linkUser(threatId, data.userId, { timestamp, vector: data.threatType[0] });
    }
  }

  private classifyResourcePath(path: string): 'endpoint' | 'file' | 'admin' | 'api' {
    if (path.startsWith('/admin') || path.startsWith('/internal')) return 'admin';
    if (path.startsWith('/api')) return 'api';
    if (path.includes('.') && !path.endsWith('/')) return 'file';
    return 'endpoint';
  }
}
