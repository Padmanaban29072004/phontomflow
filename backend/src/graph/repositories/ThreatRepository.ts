import { Neo4jService } from '@/graph/Neo4jService';
import { ThreatNode, RelationshipProperties } from '@/graph/types';
import { logger } from '@/utils/logger';

export class ThreatRepository {
  constructor(private neo4j: Neo4jService) {}

  async create(threat: Partial<ThreatNode> & { id: string }): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `CREATE (t:Threat {
           id: $id,
           type: $type,
           severity: $severity,
           score: $score,
           timestamp: $timestamp,
           description: $description
         })`,
        {
          id: threat.id,
          type: threat.type || 'unknown',
          severity: threat.severity || 'low',
          score: threat.score ?? 0,
          timestamp: threat.timestamp || new Date().toISOString(),
          description: threat.description || null,
        }
      );
    } catch (error) {
      logger.warn('ThreatRepository.create error:', error);
    }
  }

  async linkIP(
    threatId: string,
    ipAddress: string,
    properties?: RelationshipProperties
  ): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MATCH (t:Threat {id: $threatId})
         MATCH (ip:IP {address: $ipAddress})
         MERGE (t)-[r:ATTACKED]->(ip)
         SET r.timestamp = COALESCE($timestamp, r.timestamp, datetime().toString()),
             r.method = COALESCE($method, r.method)`,
        {
          threatId,
          ipAddress,
          timestamp: properties?.timestamp || new Date().toISOString(),
          method: properties?.method || null,
        }
      );
    } catch (error) {
      logger.warn('ThreatRepository.linkIP error:', error);
    }
  }

  async linkUser(
    threatId: string,
    userId: string,
    properties?: RelationshipProperties
  ): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MATCH (t:Threat {id: $threatId})
         MATCH (u:User {id: $userId})
         MERGE (t)-[r:ATTACKED]->(u)
         SET r.timestamp = COALESCE($timestamp, r.timestamp, datetime().toString()),
             r.vector = COALESCE($vector, r.vector)`,
        {
          threatId,
          userId,
          timestamp: properties?.timestamp || new Date().toISOString(),
          vector: properties?.vector || null,
        }
      );
    } catch (error) {
      logger.warn('ThreatRepository.linkUser error:', error);
    }
  }

  async getThreatPatterns(type: string, timeframeMs: number = 86400000): Promise<unknown[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const cutoff = new Date(Date.now() - timeframeMs).toISOString();
      const result = await this.neo4j.readQuery(
        `MATCH (t:Threat {type: $type})
         WHERE t.timestamp > $cutoff
         OPTIONAL MATCH (t)-[r:ATTACKED]->(target)
         RETURN t, type(target) as targetType, target.id as targetId,
                count(r) as attackCount
         ORDER BY t.score DESC
         LIMIT 100`,
        { type, cutoff }
      );
      return result.records;
    } catch (error) {
      logger.warn('ThreatRepository.getThreatPatterns error:', error);
      return [];
    }
  }
}
