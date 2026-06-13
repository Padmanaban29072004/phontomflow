import { Neo4jService } from '@/graph/Neo4jService';
import { SessionNode, RelationshipProperties } from '@/graph/types';
import { logger } from '@/utils/logger';

export class SessionRepository {
  constructor(private neo4j: Neo4jService) {}

  async create(session: Partial<SessionNode> & { id: string }): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MERGE (s:Session {id: $id})
         SET s.userAgent = COALESCE($userAgent, s.userAgent),
             s.startTime = COALESCE($startTime, s.startTime),
             s.endTime = COALESCE($endTime, s.endTime),
             s.duration = COALESCE($duration, s.duration),
             s.actionCount = COALESCE($actionCount, s.actionCount),
             s.failedLogins = COALESCE($failedLogins, s.failedLogins)`,
        {
          id: session.id,
          userAgent: session.userAgent || null,
          startTime: session.startTime || new Date().toISOString(),
          endTime: session.endTime || null,
          duration: session.duration ?? null,
          actionCount: session.actionCount ?? null,
          failedLogins: session.failedLogins ?? null,
        }
      );
    } catch (error) {
      logger.warn('SessionRepository.create error:', error);
    }
  }

  async linkIP(
    sessionId: string,
    ipAddress: string,
    properties?: RelationshipProperties
  ): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MATCH (s:Session {id: $sessionId})
         MATCH (ip:IP {address: $ipAddress})
         MERGE (s)-[r:CONNECTED_TO]->(ip)
         SET r.timestamp = COALESCE($timestamp, r.timestamp, datetime().toString()),
             r.bytesTransferred = COALESCE($bytesTransferred, r.bytesTransferred)`,
        {
          sessionId,
          ipAddress,
          timestamp: properties?.timestamp || new Date().toISOString(),
          bytesTransferred: properties?.bytesTransferred || null,
        }
      );
    } catch (error) {
      logger.warn('SessionRepository.linkIP error:', error);
    }
  }

  async linkResource(
    sessionId: string,
    resourceId: string,
    properties?: RelationshipProperties
  ): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MATCH (s:Session {id: $sessionId})
         MATCH (r:Resource {id: $resourceId})
         MERGE (s)-[a:ACCESSED]->(r)
         SET a.timestamp = COALESCE($timestamp, a.timestamp, datetime().toString()),
             a.method = COALESCE($method, a.method),
             a.statusCode = COALESCE($statusCode, a.statusCode),
             a.order = COALESCE($order, a.order)`,
        {
          sessionId,
          resourceId,
          timestamp: properties?.timestamp || new Date().toISOString(),
          method: properties?.method || null,
          statusCode: properties?.statusCode || null,
          order: properties?.order || null,
        }
      );
    } catch (error) {
      logger.warn('SessionRepository.linkResource error:', error);
    }
  }

  async getSessionChain(userId: string, limit: number = 20): Promise<unknown[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const result = await this.neo4j.readQuery(
        `MATCH (u:User {id: $userId})-[:USED]->(s:Session)
         OPTIONAL MATCH (s)-[:CONNECTED_TO]->(ip:IP)
         OPTIONAL MATCH (s)-[:ACCESSED]->(r:Resource)
         RETURN s, collect(DISTINCT ip) as ips, collect(DISTINCT r) as resources
         ORDER BY s.startTime DESC
         LIMIT $limit`,
        { userId, limit }
      );
      return result.records;
    } catch (error) {
      logger.warn('SessionRepository.getSessionChain error:', error);
      return [];
    }
  }
}
