import { Neo4jService } from '@/graph/Neo4jService';
import { DeviceNode, RelationshipProperties } from '@/graph/types';
import { logger } from '@/utils/logger';

export class DeviceRepository {
  constructor(private neo4j: Neo4jService) {}

  async createOrUpdate(device: Partial<DeviceNode> & { id: string }): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MERGE (d:Device {id: $id})
         SET d.fingerprint = COALESCE($fingerprint, d.fingerprint),
             d.os = COALESCE($os, d.os),
             d.browser = COALESCE($browser, d.browser),
             d.screenResolution = COALESCE($screenResolution, d.screenResolution),
             d.language = COALESCE($language, d.language),
             d.lastSeen = $lastSeen,
             d.firstSeen = COALESCE(d.firstSeen, $firstSeen)`,
        {
          id: device.id,
          fingerprint: device.fingerprint || null,
          os: device.os || null,
          browser: device.browser || null,
          screenResolution: device.screenResolution || null,
          language: device.language || null,
          lastSeen: device.lastSeen || new Date().toISOString(),
          firstSeen: device.firstSeen || new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.warn('DeviceRepository.createOrUpdate error:', error);
    }
  }

  async linkSession(
    deviceId: string,
    sessionId: string,
    properties?: RelationshipProperties
  ): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MATCH (d:Device {id: $deviceId})
         MATCH (s:Session {id: $sessionId})
         MERGE (d)-[r:CONNECTED_TO]->(s)
         SET r.timestamp = COALESCE($timestamp, r.timestamp, datetime().toString())`,
        {
          deviceId,
          sessionId,
          timestamp: properties?.timestamp || new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.warn('DeviceRepository.linkSession error:', error);
    }
  }

  async getDevicesByPattern(pattern: string, timeframeMs: number = 3600000): Promise<DeviceNode[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const cutoff = new Date(Date.now() - timeframeMs).toISOString();
      const result = await this.neo4j.readQuery(
        `MATCH (d:Device)
         WHERE d.lastSeen > $cutoff
         AND (d.os CONTAINS $pattern OR d.browser CONTAINS $pattern)
         RETURN d
         ORDER BY d.lastSeen DESC
         LIMIT 50`,
        { cutoff, pattern }
      );
      return result.records.map((r) => r.get('d').properties as DeviceNode);
    } catch (error) {
      logger.warn('DeviceRepository.getDevicesByPattern error:', error);
      return [];
    }
  }
}
