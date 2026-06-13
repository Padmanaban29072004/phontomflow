import neo4j, { Driver, Session, QueryResult } from 'neo4j-driver';
import { logger } from '@/utils/logger';
import { GraphStats } from '@/graph/types';

export class Neo4jService {
  private driver: Driver | null = null;
  private _isConnected: boolean = false;
  private _skipConnection: boolean = false;

  constructor() {
    this._skipConnection = process.env.SKIP_NEO4J_CONNECTION === 'true';
  }

  public async connect(): Promise<void> {
    if (this._skipConnection) {
      logger.info('Neo4j connection skipped via SKIP_NEO4J_CONNECTION');
      return;
    }

    if (this._isConnected) {
      return;
    }

    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'dev-password-123';

    try {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        maxConnectionPoolSize: 10,
        connectionTimeout: 5000,
      });

      await this.driver.verifyConnectivity();
      this._isConnected = true;
      logger.info('Neo4j connected successfully');
    } catch (error) {
      this._isConnected = false;
      this.driver = null;
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        logger.warn('Neo4j not available — graph features will use in-memory fallback');
        logger.warn('To start Neo4j: docker compose up -d neo4j (from project root)');
      } else {
        logger.error('Neo4j connection failed:', error);
        throw error;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.driver || !this._isConnected) {
      return;
    }

    try {
      await this.driver.close();
      this._isConnected = false;
      this.driver = null;
      logger.info('Neo4j disconnected');
    } catch (error) {
      logger.error('Neo4j disconnect error:', error);
    }
  }

  public isConnected(): boolean {
    return this._isConnected && this.driver !== null;
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      await this.driver!.verifyConnectivity();
      return true;
    } catch {
      this._isConnected = false;
      return false;
    }
  }

  public async runQuery(cypher: string, params?: Record<string, unknown>): Promise<QueryResult> {
    if (!this.isConnected() || !this.driver) {
      throw new Error('Neo4j not connected');
    }

    const session: Session = this.driver.session();
    try {
      return await session.run(cypher, params);
    } finally {
      await session.close();
    }
  }

  public async readQuery(cypher: string, params?: Record<string, unknown>): Promise<QueryResult> {
    return this.runQuery(cypher, params);
  }

  public async writeQuery(cypher: string, params?: Record<string, unknown>): Promise<QueryResult> {
    return this.runQuery(cypher, params);
  }

  public async createIndexes(): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    const constraints = [
      'CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (s:Session) REQUIRE s.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (ip:IP) REQUIRE ip.address IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (r:Resource) REQUIRE r.id IS UNIQUE',
      'CREATE CONSTRAINT IF NOT EXISTS FOR (t:Threat) REQUIRE t.id IS UNIQUE',
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS FOR (u:User) ON (u.username)',
      'CREATE INDEX IF NOT EXISTS FOR (ip:IP) ON (ip.country)',
      'CREATE INDEX IF NOT EXISTS FOR (d:Device) ON (d.fingerprint)',
      'CREATE INDEX IF NOT EXISTS FOR (r:Resource) ON (r.path)',
      'CREATE INDEX IF NOT EXISTS FOR (t:Threat) ON (t.type)',
      'CREATE INDEX IF NOT EXISTS FOR (t:Threat) ON (t.severity)',
      'CREATE INDEX IF NOT EXISTS FOR (t:Threat) ON (t.timestamp)',
    ];

    try {
      for (const constraint of constraints) {
        await this.writeQuery(constraint);
      }
      logger.info('Neo4j constraints created');

      for (const index of indexes) {
        await this.writeQuery(index);
      }
      logger.info('Neo4j indexes created');
    } catch (error) {
      logger.warn('Neo4j schema setup error:', error);
    }
  }

  public async getStats(): Promise<GraphStats> {
    const nodeCounts: Record<string, number> = {};
    const relationshipCounts: Record<string, number> = {};

    if (!this.isConnected()) {
      return { nodeCounts, relationshipCounts, totalNodes: 0, totalRelationships: 0 };
    }

    try {
      const nodeLabels = ['User', 'Session', 'IP', 'Device', 'Resource', 'Threat'];
      for (const label of nodeLabels) {
        const result = await this.readQuery(
          `MATCH (n:${label}) RETURN count(n) as count`
        );
        nodeCounts[label] = result.records[0].get('count').toNumber();
      }

      const relTypes = ['USED', 'CONNECTED_TO', 'ATTACKED', 'ACCESSED', 'IMPERSONATED', 'ORIGINATED_FROM'];
      for (const type of relTypes) {
        const result = await this.readQuery(
          `MATCH ()-[r:${type}]->() RETURN count(r) as count`
        );
        relationshipCounts[type] = result.records[0].get('count').toNumber();
      }

      const totalNodes = Object.values(nodeCounts).reduce((a, b) => a + b, 0);
      const totalRelationships = Object.values(relationshipCounts).reduce((a, b) => a + b, 0);

      return { nodeCounts, relationshipCounts, totalNodes, totalRelationships };
    } catch (error) {
      logger.warn('Neo4j getStats error:', error);
      return { nodeCounts, relationshipCounts, totalNodes: 0, totalRelationships: 0 };
    }
  }

  public getDriver(): Driver | null {
    return this.driver;
  }
}
