import { Neo4jService } from '@/graph/Neo4jService';
import { UserNode, RelationshipProperties } from '@/graph/types';
import { logger } from '@/utils/logger';

export class UserRepository {
  constructor(private neo4j: Neo4jService) {}

  async createOrUpdate(user: Partial<UserNode> & { id: string }): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MERGE (u:User {id: $id})
         SET u.username = COALESCE($username, u.username),
             u.fingerprint = COALESCE($fingerprint, u.fingerprint),
             u.riskScore = COALESCE($riskScore, u.riskScore),
             u.lastSeen = $lastSeen,
             u.firstSeen = COALESCE(u.firstSeen, $firstSeen)`,
        {
          id: user.id,
          username: user.username || 'unknown',
          fingerprint: user.fingerprint || null,
          riskScore: user.riskScore ?? null,
          lastSeen: user.lastSeen || new Date().toISOString(),
          firstSeen: user.firstSeen || new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.warn('UserRepository.createOrUpdate error:', error);
    }
  }

  async linkSession(
    userId: string,
    sessionId: string,
    properties?: RelationshipProperties
  ): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MATCH (u:User {id: $userId})
         MATCH (s:Session {id: $sessionId})
         MERGE (u)-[r:USED]->(s)
         SET r.timestamp = COALESCE($timestamp, r.timestamp, datetime().toString()),
             r.duration = COALESCE($duration, r.duration)`,
        {
          userId,
          sessionId,
          timestamp: properties?.timestamp || new Date().toISOString(),
          duration: properties?.duration || null,
        }
      );
    } catch (error) {
      logger.warn('UserRepository.linkSession error:', error);
    }
  }

  async getThreatPaths(userId: string, depth: number = 3): Promise<unknown[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const result = await this.neo4j.readQuery(
        `MATCH path = (u:User {id: $userId})-[:USED]->(s:Session)-[:CONNECTED_TO]->(ip:IP)
         OPTIONAL MATCH (ip)<-[:ATTACKED]-(t:Threat)
         RETURN u, s, ip, collect(DISTINCT t) as threats
         LIMIT $depth`,
        { userId, depth: depth * 10 }
      );
      return result.records;
    } catch (error) {
      logger.warn('UserRepository.getThreatPaths error:', error);
      return [];
    }
  }

  async findByUsername(username: string): Promise<UserNode | null> {
    if (!this.neo4j.isConnected()) return null;

    try {
      const result = await this.neo4j.readQuery(
        `MATCH (u:User {username: $username}) RETURN u`,
        { username }
      );
      if (result.records.length === 0) return null;
      return result.records[0].get('u').properties as UserNode;
    } catch (error) {
      logger.warn('UserRepository.findByUsername error:', error);
      return null;
    }
  }
}
