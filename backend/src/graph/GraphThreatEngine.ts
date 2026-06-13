import { Neo4jService } from '@/graph/Neo4jService';
import {
  CredentialStuffingResult,
  BotnetResult,
  LateralMovementResult,
} from '@/graph/types';
import { logger } from '@/utils/logger';

export class GraphThreatEngine {
  constructor(private neo4j: Neo4jService) {}

  async detectCredentialStuffing(): Promise<CredentialStuffingResult[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const result = await this.neo4j.readQuery(`
        MATCH (u:User)-[:USED]->(s:Session)-[:CONNECTED_TO]->(ip:IP)
        WITH u, count(DISTINCT s) as sessionCount, count(DISTINCT ip) as ipCount
        WHERE sessionCount > 3 AND ipCount > 1
        MATCH (u)-[:USED]->(s2:Session)
        WHERE s2.failedLogins > 0 AND s2.failedLogins IS NOT NULL
        WITH u, sessionCount, ipCount, count(s2) as suspiciousSessions,
             (toFloat(sessionCount) / toFloat(ipCount)) as ipRatio
        RETURN u.id as userId, u.username as username,
               sessionCount, ipCount, suspiciousSessions, ipRatio,
               CASE
                 WHEN ipRatio > 5 AND suspiciousSessions > 5 THEN 0.9
                 WHEN ipRatio > 3 AND suspiciousSessions > 3 THEN 0.7
                 WHEN ipRatio > 2 AND suspiciousSessions > 1 THEN 0.5
                 ELSE 0.3
               END as threatScore
        ORDER BY threatScore DESC
        LIMIT 50
      `);

      return result.records.map((r) => ({
        userId: r.get('userId'),
        username: r.get('username'),
        sessionCount: r.get('sessionCount').toNumber(),
        ipCount: r.get('ipCount').toNumber(),
        suspiciousSessions: r.get('suspiciousSessions').toNumber(),
        ipRatio: r.get('ipRatio'),
        threatScore: r.get('threatScore'),
      }));
    } catch (error) {
      logger.warn('GraphThreatEngine.detectCredentialStuffing error:', error);
      return [];
    }
  }

  async detectBotnet(): Promise<BotnetResult[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const result = await this.neo4j.readQuery(`
        MATCH (d:Device)-[:CONNECTED_TO]->(ip:IP)
        WHERE d.firstSeen > datetime() - duration('PT1H')
        WITH d, collect(ip.address) as ips
        WHERE size(ips) > 5
        MATCH (d)-[:CONNECTED_TO]->(ip2:IP)<-[:CONNECTED_TO]-(d2:Device)
        WHERE d <> d2
          AND d2.firstSeen > datetime() - duration('PT1H')
        WITH d, d2, ips, size(ips) as ipCount
        RETURN d.id as deviceId, d2.id as relatedDeviceId,
               ipCount, ips,
               CASE
                 WHEN ipCount > 20 THEN 0.9
                 WHEN ipCount > 10 THEN 0.7
                 WHEN ipCount > 5 THEN 0.5
                 ELSE 0.3
               END as threatScore
        ORDER BY ipCount DESC
        LIMIT 50
      `);

      return result.records.map((r) => ({
        deviceId: r.get('deviceId'),
        relatedDeviceId: r.get('relatedDeviceId'),
        ipCount: r.get('ipCount').toNumber(),
        ips: r.get('ips'),
        threatScore: r.get('threatScore'),
      }));
    } catch (error) {
      logger.warn('GraphThreatEngine.detectBotnet error:', error);
      return [];
    }
  }

  async detectLateralMovement(): Promise<LateralMovementResult[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const result = await this.neo4j.readQuery(`
        MATCH path = (u:User)-[:ACCESSED]->(r1:Resource)
        WHERE r1.type <> 'admin'
        MATCH (u)-[:ACCESSED]->(r2:Resource {type: 'admin'})
        WITH u, collect(DISTINCT r1.path) + collect(DISTINCT r2.path) as resources,
             count(DISTINCT r2) as adminResourceCount
        WHERE adminResourceCount > 0
        RETURN u.id as userId, u.username as username,
               resources,
               adminResourceCount as hopCount,
               CASE
                 WHEN adminResourceCount > 5 THEN 0.9
                 WHEN adminResourceCount > 3 THEN 0.7
                 WHEN adminResourceCount > 1 THEN 0.5
                 ELSE 0.2
               END as threatScore
        ORDER BY threatScore DESC
        LIMIT 50
      `);

      return result.records.map((r) => ({
        userId: r.get('userId'),
        username: r.get('username'),
        resources: r.get('resources'),
        hopCount: r.get('hopCount').toNumber(),
        threatScore: r.get('threatScore'),
      }));
    } catch (error) {
      logger.warn('GraphThreatEngine.detectLateralMovement error:', error);
      return [];
    }
  }
}
