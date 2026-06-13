import { Neo4jService } from '@/graph/Neo4jService';
import { ResourceNode, RelationshipProperties } from '@/graph/types';
import { logger } from '@/utils/logger';

export class ResourceRepository {
  constructor(private neo4j: Neo4jService) {}

  async createOrUpdate(resource: Partial<ResourceNode> & { id: string }): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MERGE (r:Resource {id: $id})
         SET r.path = COALESCE($path, r.path),
             r.method = COALESCE($method, r.method),
             r.type = COALESCE($type, r.type, 'endpoint')`,
        {
          id: resource.id,
          path: resource.path || '/',
          method: resource.method || 'GET',
          type: resource.type || 'endpoint',
        }
      );
    } catch (error) {
      logger.warn('ResourceRepository.createOrUpdate error:', error);
    }
  }

  async getAccessPath(
    userId: string,
    sessionId: string
  ): Promise<{ resources: ResourceNode[]; timestamps: string[] }> {
    if (!this.neo4j.isConnected()) return { resources: [], timestamps: [] };

    try {
      const result = await this.neo4j.readQuery(
        `MATCH (u:User {id: $userId})-[:USED]->(s:Session {id: $sessionId})
         MATCH (s)-[a:ACCESSED]->(r:Resource)
         RETURN r, a.timestamp as ts
         ORDER BY a.order ASC`,
        { userId, sessionId }
      );

      const resources: ResourceNode[] = [];
      const timestamps: string[] = [];
      for (const record of result.records) {
        resources.push(record.get('r').properties as ResourceNode);
        timestamps.push(record.get('ts') || '');
      }
      return { resources, timestamps };
    } catch (error) {
      logger.warn('ResourceRepository.getAccessPath error:', error);
      return { resources: [], timestamps: [] };
    }
  }

  async findByPath(path: string): Promise<ResourceNode | null> {
    if (!this.neo4j.isConnected()) return null;

    try {
      const result = await this.neo4j.readQuery(
        `MATCH (r:Resource {path: $path}) RETURN r LIMIT 1`,
        { path }
      );
      if (result.records.length === 0) return null;
      return result.records[0].get('r').properties as ResourceNode;
    } catch (error) {
      logger.warn('ResourceRepository.findByPath error:', error);
      return null;
    }
  }
}
