import { Neo4jService } from '@/graph/Neo4jService';
import { IPNode, RelationshipProperties } from '@/graph/types';
import { logger } from '@/utils/logger';

export class IPRepository {
  constructor(private neo4j: Neo4jService) {}

  async createOrUpdate(ip: Partial<IPNode> & { address: string }): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MERGE (ip:IP {address: $address})
         SET ip.country = COALESCE($country, ip.country),
             ip.city = COALESCE($city, ip.city),
             ip.isp = COALESCE($isp, ip.isp),
             ip.asn = COALESCE($asn, ip.asn),
             ip.proxy = COALESCE($proxy, ip.proxy, false),
             ip.vpn = COALESCE($vpn, ip.vpn, false),
             ip.tor = COALESCE($tor, ip.tor, false),
             ip.lastSeen = $lastSeen,
             ip.firstSeen = COALESCE(ip.firstSeen, $firstSeen)`,
        {
          address: ip.address,
          country: ip.country || null,
          city: ip.city || null,
          isp: ip.isp || null,
          asn: ip.asn || null,
          proxy: ip.proxy ?? null,
          vpn: ip.vpn ?? null,
          tor: ip.tor ?? null,
          lastSeen: ip.lastSeen || new Date().toISOString(),
          firstSeen: ip.firstSeen || new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.warn('IPRepository.createOrUpdate error:', error);
    }
  }

  async linkDevice(
    ipAddress: string,
    deviceId: string,
    properties?: RelationshipProperties
  ): Promise<void> {
    if (!this.neo4j.isConnected()) return;

    try {
      await this.neo4j.writeQuery(
        `MATCH (ip:IP {address: $ipAddress})
         MATCH (d:Device {id: $deviceId})
         MERGE (d)-[r:CONNECTED_TO]->(ip)
         SET r.timestamp = COALESCE($timestamp, r.timestamp, datetime().toString())`,
        {
          ipAddress,
          deviceId,
          timestamp: properties?.timestamp || new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.warn('IPRepository.linkDevice error:', error);
    }
  }

  async getSharedIPs(userIds: string[]): Promise<unknown[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const result = await this.neo4j.readQuery(
        `MATCH (u:User)-[:USED]->(s:Session)-[:CONNECTED_TO]->(ip:IP)
         WHERE u.id IN $userIds
         WITH ip, collect(DISTINCT u) as users
         WHERE size(users) > 1
         RETURN ip, users
         ORDER BY size(users) DESC`,
        { userIds }
      );
      return result.records;
    } catch (error) {
      logger.warn('IPRepository.getSharedIPs error:', error);
      return [];
    }
  }

  async getIPGraph(ipAddress: string, depth: number = 2): Promise<unknown[]> {
    if (!this.neo4j.isConnected()) return [];

    try {
      const result = await this.neo4j.readQuery(
        `MATCH path = (ip:IP {address: $ipAddress})-[*1..$depth]-(connected)
         RETURN path
         LIMIT 100`,
        { ipAddress, depth }
      );
      return result.records;
    } catch (error) {
      logger.warn('IPRepository.getIPGraph error:', error);
      return [];
    }
  }
}
