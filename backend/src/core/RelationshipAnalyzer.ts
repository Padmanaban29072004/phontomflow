import { logger } from '@/utils/logger';
import { RedisService } from '@/services/RedisService';
import * as geoip from 'geoip-lite';

export interface NetworkRelationship {
  sourceIP: string;
  targetIP: string;
  relationshipType: 'direct' | 'indirect' | 'coordinated';
  strength: number;
  timestamp: Date;
  metadata: RelationshipMetadata;
}

export interface RelationshipMetadata {
  commonUserAgents: string[];
  commonPaths: string[];
  timeCorrelation: number;
  geographicProximity: number;
  behaviorSimilarity: number;
  attackPatterns: string[];
}

export interface UserRelationship {
  userId: string;
  relatedUsers: string[];
  relationshipType: 'session_sharing' | 'behavior_similarity' | 'geographic_proximity';
  strength: number;
  timestamp: Date;
}

export interface GeographicCluster {
  country: string;
  region: string;
  city: string;
  ipAddresses: string[];
  threatLevel: number;
  attackPatterns: string[];
  timestamp: Date;
}

export interface CoordinatedAttack {
  attackId: string;
  participants: string[];
  attackType: string;
  startTime: Date;
  endTime?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns: string[];
  confidence: number;
}

export class RelationshipAnalyzer {
  private redisService: RedisService;
  private networkGraph: Map<string, Set<string>>;
  private userGraph: Map<string, Set<string>>;
  private geographicClusters: Map<string, GeographicCluster>;
  private coordinatedAttacks: Map<string, CoordinatedAttack>;
  private relationshipCache: Map<string, NetworkRelationship[]>;

  constructor() {
    this.redisService = new RedisService();
    this.networkGraph = new Map();
    this.userGraph = new Map();
    this.geographicClusters = new Map();
    this.coordinatedAttacks = new Map();
    this.relationshipCache = new Map();
  }

  /**
   * Main relationship analysis method
   */
  public async analyze(requestData: any): Promise<number> {
    try {
      const timestamp = new Date();
      
      // Update network relationships
      await this.updateNetworkRelationships(requestData, timestamp);
      
      // Update user relationships
      if (requestData.userId) {
        await this.updateUserRelationships(requestData, timestamp);
      }
      
      // Update geographic clusters
      await this.updateGeographicClusters(requestData, timestamp);
      
      // Detect coordinated attacks
      const coordinatedAttack = await this.detectCoordinatedAttacks(requestData, timestamp);
      
      // Calculate relationship risk score
      const riskScore = this.calculateRelationshipRisk(requestData, coordinatedAttack);
      
      logger.debug(`Relationship analysis completed, risk score: ${riskScore}`);
      
      return riskScore;
      
    } catch (error) {
      logger.error('Error in relationship analysis:', error);
      return 0.1; // Return low risk score on error
    }
  }

  /**
   * Update network relationships
   */
  private async updateNetworkRelationships(requestData: any, timestamp: Date): Promise<void> {
    const sourceIP = requestData.ipAddress;
    
    // Get recent requests from other IPs
    const recentRequests = await this.getRecentRequests(timestamp.getTime() - 300000); // Last 5 minutes
    
    for (const request of recentRequests) {
      if (request.ipAddress !== sourceIP) {
        const relationship = this.analyzeIPRelationship(sourceIP, request.ipAddress, requestData, request);
        
        if (relationship.strength > 0.3) { // Only store significant relationships
          await this.storeNetworkRelationship(relationship);
          this.updateNetworkGraph(sourceIP, request.ipAddress, relationship.strength);
        }
      }
    }
  }

  /**
   * Analyze relationship between two IP addresses
   */
  private analyzeIPRelationship(
    ip1: string,
    ip2: string,
    request1: any,
    request2: any
  ): NetworkRelationship {
    const commonUserAgents = this.findCommonUserAgents(request1.userAgent, request2.userAgent);
    const commonPaths = this.findCommonPaths(request1.requestPath, request2.requestPath);
    const timeCorrelation = this.calculateTimeCorrelation(request1.timestamp, request2.timestamp);
    const geographicProximity = this.calculateGeographicProximity(ip1, ip2);
    const behaviorSimilarity = this.calculateBehaviorSimilarity(request1, request2);
    const attackPatterns = this.detectAttackPatterns(request1, request2);
    
    const relationshipType = this.determineRelationshipType(
      commonUserAgents,
      timeCorrelation,
      geographicProximity,
      behaviorSimilarity
    );
    
    const strength = this.calculateRelationshipStrength(
      commonUserAgents,
      commonPaths,
      timeCorrelation,
      geographicProximity,
      behaviorSimilarity,
      attackPatterns
    );
    
    return {
      sourceIP: ip1,
      targetIP: ip2,
      relationshipType,
      strength,
      timestamp: new Date(),
      metadata: {
        commonUserAgents,
        commonPaths,
        timeCorrelation,
        geographicProximity,
        behaviorSimilarity,
        attackPatterns
      }
    };
  }

  /**
   * Find common user agents
   */
  private findCommonUserAgents(ua1: string, ua2: string): string[] {
    const common: string[] = [];
    const ua1Parts = ua1.toLowerCase().split(' ');
    const ua2Parts = ua2.toLowerCase().split(' ');
    
    for (const part of ua1Parts) {
      if (ua2Parts.includes(part) && part.length > 3) {
        common.push(part);
      }
    }
    
    return common;
  }

  /**
   * Find common request paths
   */
  private findCommonPaths(path1: string, path2: string): string[] {
    const common: string[] = [];
    const path1Parts = path1.split('/').filter(p => p.length > 0);
    const path2Parts = path2.split('/').filter(p => p.length > 0);
    
    for (const part of path1Parts) {
      if (path2Parts.includes(part)) {
        common.push(part);
      }
    }
    
    return common;
  }

  /**
   * Calculate time correlation between requests
   */
  private calculateTimeCorrelation(timestamp1: Date, timestamp2: Date): number {
    const timeDiff = Math.abs(timestamp1.getTime() - timestamp2.getTime());
    const maxDiff = 300000; // 5 minutes
    
    if (timeDiff > maxDiff) return 0;
    
    return 1 - (timeDiff / maxDiff);
  }

  /**
   * Calculate geographic proximity between IPs
   */
  private calculateGeographicProximity(ip1: string, ip2: string): number {
    try {
      const geo1 = geoip.lookup(ip1);
      const geo2 = geoip.lookup(ip2);
      
      if (!geo1 || !geo2) return 0;
      
      if (geo1.country === geo2.country) {
        if (geo1.region === geo2.region) {
          if (geo1.city === geo2.city) {
            return 1.0; // Same city
          }
          return 0.8; // Same region
        }
        return 0.6; // Same country
      }
      
      return 0.1; // Different countries
    } catch (error) {
      logger.error('Error calculating geographic proximity:', error);
      return 0;
    }
  }

  /**
   * Calculate behavior similarity between requests
   */
  private calculateBehaviorSimilarity(request1: any, request2: any): number {
    let similarity = 0;
    
    // Compare request methods
    if (request1.requestMethod === request2.requestMethod) {
      similarity += 0.2;
    }
    
    // Compare user agents
    if (request1.userAgent === request2.userAgent) {
      similarity += 0.3;
    }
    
    // Compare request timing patterns
    const timeDiff1 = Math.abs(request1.timestamp.getTime() - request2.timestamp.getTime());
    if (timeDiff1 < 1000) { // Within 1 second
      similarity += 0.3;
    } else if (timeDiff1 < 10000) { // Within 10 seconds
      similarity += 0.1;
    }
    
    // Compare request patterns
    if (request1.requestPath.includes(request2.requestPath) || 
        request2.requestPath.includes(request1.requestPath)) {
      similarity += 0.2;
    }
    
    return Math.min(similarity, 1.0);
  }

  /**
   * Detect attack patterns in requests
   */
  private detectAttackPatterns(request1: any, request2: any): string[] {
    const patterns: string[] = [];
    
    // Check for SQL injection patterns
    const sqlPatterns = ['union', 'select', 'drop', 'insert', 'delete', 'update', '--', '/*', '*/'];
    const request1Str = JSON.stringify(request1).toLowerCase();
    const request2Str = JSON.stringify(request2).toLowerCase();
    
    for (const pattern of sqlPatterns) {
      if (request1Str.includes(pattern) && request2Str.includes(pattern)) {
        patterns.push('sql_injection');
        break;
      }
    }
    
    // Check for XSS patterns
    const xssPatterns = ['<script', 'javascript:', 'onload', 'onerror', 'onclick'];
    for (const pattern of xssPatterns) {
      if (request1Str.includes(pattern) && request2Str.includes(pattern)) {
        patterns.push('xss');
        break;
      }
    }
    
    // Check for directory traversal
    const traversalPatterns = ['../', '..\\', '%2e%2e', '%2e%2e%2f'];
    for (const pattern of traversalPatterns) {
      if (request1Str.includes(pattern) && request2Str.includes(pattern)) {
        patterns.push('directory_traversal');
        break;
      }
    }
    
    return patterns;
  }

  /**
   * Determine relationship type
   */
  private determineRelationshipType(
    commonUserAgents: string[],
    timeCorrelation: number,
    geographicProximity: number,
    behaviorSimilarity: number
  ): 'direct' | 'indirect' | 'coordinated' {
    const totalScore = (commonUserAgents.length * 0.2) + timeCorrelation + geographicProximity + behaviorSimilarity;
    
    if (totalScore > 2.5) {
      return 'coordinated';
    } else if (totalScore > 1.5) {
      return 'direct';
    } else {
      return 'indirect';
    }
  }

  /**
   * Calculate relationship strength
   */
  private calculateRelationshipStrength(
    commonUserAgents: string[],
    commonPaths: string[],
    timeCorrelation: number,
    geographicProximity: number,
    behaviorSimilarity: number,
    attackPatterns: string[]
  ): number {
    let strength = 0;
    
    strength += commonUserAgents.length * 0.1;
    strength += commonPaths.length * 0.15;
    strength += timeCorrelation * 0.25;
    strength += geographicProximity * 0.2;
    strength += behaviorSimilarity * 0.3;
    
    // Boost strength for attack patterns
    if (attackPatterns.length > 0) {
      strength += 0.2;
    }
    
    return Math.min(strength, 1.0);
  }

  /**
   * Update user relationships
   */
  private async updateUserRelationships(requestData: any, timestamp: Date): Promise<void> {
    const userId = requestData.userId;
    
    // Get recent requests from other users
    const recentUserRequests = await this.getRecentUserRequests(timestamp.getTime() - 300000);
    
    for (const request of recentUserRequests) {
      if (request.userId && request.userId !== userId) {
        const relationship = this.analyzeUserRelationship(userId, request.userId, requestData, request);
        
        if (relationship.strength > 0.3) {
          await this.storeUserRelationship(relationship);
          this.updateUserGraph(userId, request.userId, relationship.strength);
        }
      }
    }
  }

  /**
   * Analyze relationship between two users
   */
  private analyzeUserRelationship(
    user1: string,
    user2: string,
    request1: any,
    request2: any
  ): UserRelationship {
    const behaviorSimilarity = this.calculateBehaviorSimilarity(request1, request2);
    const geographicProximity = this.calculateGeographicProximity(request1.ipAddress, request2.ipAddress);
    const timeCorrelation = this.calculateTimeCorrelation(request1.timestamp, request2.timestamp);
    
    let relationshipType: 'session_sharing' | 'behavior_similarity' | 'geographic_proximity';
    let strength = 0;
    
    if (timeCorrelation > 0.8) {
      relationshipType = 'session_sharing';
      strength = timeCorrelation * 0.6 + behaviorSimilarity * 0.4;
    } else if (behaviorSimilarity > 0.7) {
      relationshipType = 'behavior_similarity';
      strength = behaviorSimilarity * 0.7 + geographicProximity * 0.3;
    } else {
      relationshipType = 'geographic_proximity';
      strength = geographicProximity * 0.8 + behaviorSimilarity * 0.2;
    }
    
    return {
      userId: user1,
      relatedUsers: [user2],
      relationshipType,
      strength,
      timestamp: new Date()
    };
  }

  /**
   * Update geographic clusters
   */
  private async updateGeographicClusters(requestData: any, timestamp: Date): Promise<void> {
    try {
      const geo = geoip.lookup(requestData.ipAddress);
      if (!geo) return;
      
      const clusterKey = `${geo.country}-${geo.region}-${geo.city}`;
      
      let cluster = this.geographicClusters.get(clusterKey);
      if (!cluster) {
        cluster = {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          ipAddresses: [],
          threatLevel: 0,
          attackPatterns: [],
          timestamp: new Date()
        };
      }
      
      if (!cluster.ipAddresses.includes(requestData.ipAddress)) {
        cluster.ipAddresses.push(requestData.ipAddress);
      }
      
      // Update threat level based on recent activity
      cluster.threatLevel = this.calculateGeographicThreatLevel(cluster, requestData);
      
      this.geographicClusters.set(clusterKey, cluster);
      
    } catch (error) {
      logger.error('Error updating geographic clusters:', error);
    }
  }

  /**
   * Calculate geographic threat level
   */
  private calculateGeographicThreatLevel(cluster: GeographicCluster, requestData: any): number {
    let threatLevel = cluster.threatLevel;
    
    // Increase threat level for suspicious requests
    if (this.isSuspiciousRequest(requestData)) {
      threatLevel += 0.1;
    }
    
    // Increase threat level for high IP density
    if (cluster.ipAddresses.length > 10) {
      threatLevel += 0.05;
    }
    
    return Math.min(threatLevel, 1.0);
  }

  /**
   * Detect coordinated attacks
   */
  private async detectCoordinatedAttacks(requestData: any, timestamp: Date): Promise<CoordinatedAttack | null> {
    const sourceIP = requestData.ipAddress;
    
    // Check if this IP is part of an existing coordinated attack
    for (const [attackId, attack] of this.coordinatedAttacks) {
      if (attack.participants.includes(sourceIP)) {
        return attack;
      }
    }
    
    // Look for new coordinated attack patterns
    const relatedIPs = this.findRelatedIPs(sourceIP);
    if (relatedIPs.length >= 3) { // Minimum 3 IPs for coordinated attack
      const attackPatterns = this.analyzeAttackPatterns(relatedIPs, requestData);
      
      if (attackPatterns.length > 0) {
        const attack: CoordinatedAttack = {
          attackId: this.generateAttackId(),
          participants: [sourceIP, ...relatedIPs],
          attackType: attackPatterns[0],
          startTime: timestamp,
          severity: this.determineAttackSeverity(attackPatterns),
          patterns: attackPatterns,
          confidence: this.calculateAttackConfidence(relatedIPs, attackPatterns)
        };
        
        this.coordinatedAttacks.set(attack.attackId, attack);
        return attack;
      }
    }
    
    return null;
  }

  /**
   * Find related IPs based on network graph
   */
  private findRelatedIPs(sourceIP: string): string[] {
    const related: string[] = [];
    const visited = new Set<string>();
    
    const dfs = (ip: string, depth: number) => {
      if (depth > 2 || visited.has(ip)) return; // Max depth 2
      
      visited.add(ip);
      const neighbors = this.networkGraph.get(ip);
      
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && neighbor !== sourceIP) {
            related.push(neighbor);
            dfs(neighbor, depth + 1);
          }
        }
      }
    };
    
    dfs(sourceIP, 0);
    return related;
  }

  /**
   * Analyze attack patterns across related IPs
   */
  private analyzeAttackPatterns(relatedIPs: string[], requestData: any): string[] {
    const patterns: string[] = [];
    
    // Check for DDoS patterns
    if (relatedIPs.length > 5) {
      patterns.push('ddos');
    }
    
    // Check for brute force patterns
    const recentRequests = this.getRecentRequestsFromIPs(relatedIPs);
    if (recentRequests.length > 100) {
      patterns.push('brute_force');
    }
    
    // Check for scanning patterns
    const uniquePaths = new Set(recentRequests.map(r => r.requestPath));
    if (uniquePaths.size > 50) {
      patterns.push('port_scanning');
    }
    
    return patterns;
  }

  /**
   * Determine attack severity
   */
  private determineAttackSeverity(patterns: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (patterns.includes('ddos')) return 'critical';
    if (patterns.includes('brute_force')) return 'high';
    if (patterns.includes('port_scanning')) return 'medium';
    return 'low';
  }

  /**
   * Calculate attack confidence
   */
  private calculateAttackConfidence(relatedIPs: string[], patterns: string[]): number {
    let confidence = 0;
    
    confidence += Math.min(relatedIPs.length / 10, 0.4); // Up to 40% for IP count
    confidence += patterns.length * 0.2; // 20% per pattern
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate relationship risk score
   */
  private calculateRelationshipRisk(requestData: any, coordinatedAttack: CoordinatedAttack | null): number {
    let riskScore = 0;
    
    // Base risk from coordinated attacks
    if (coordinatedAttack) {
      switch (coordinatedAttack.severity) {
        case 'critical':
          riskScore += 0.8;
          break;
        case 'high':
          riskScore += 0.6;
          break;
        case 'medium':
          riskScore += 0.4;
          break;
        case 'low':
          riskScore += 0.2;
          break;
      }
    }
    
    // Risk from network relationships
    const networkRelationships = this.getNetworkRelationships(requestData.ipAddress);
    if (networkRelationships.length > 0) {
      const avgStrength = networkRelationships.reduce((sum, r) => sum + r.strength, 0) / networkRelationships.length;
      riskScore += avgStrength * 0.3;
    }
    
    // Risk from geographic clustering
    const geo = geoip.lookup(requestData.ipAddress);
    if (geo) {
      const clusterKey = `${geo.country}-${geo.region}-${geo.city}`;
      const cluster = this.geographicClusters.get(clusterKey);
      if (cluster && cluster.threatLevel > 0.5) {
        riskScore += cluster.threatLevel * 0.2;
      }
    }
    
    return Math.min(riskScore, 1.0);
  }

  /**
   * Helper methods for data retrieval and storage
   */
  private async getRecentRequests(timeWindow: number): Promise<any[]> {
    // Simplified implementation - in real system would query database
    return [];
  }

  private async getRecentUserRequests(timeWindow: number): Promise<any[]> {
    // Simplified implementation - in real system would query database
    return [];
  }

  private getRecentRequestsFromIPs(ips: string[]): any[] {
    // Simplified implementation - in real system would query database
    return [];
  }

  private isSuspiciousRequest(requestData: any): boolean {
    // Simplified implementation
    return false;
  }

  private generateAttackId(): string {
    return `attack_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private updateNetworkGraph(ip1: string, ip2: string, strength: number): void {
    if (!this.networkGraph.has(ip1)) {
      this.networkGraph.set(ip1, new Set());
    }
    if (!this.networkGraph.has(ip2)) {
      this.networkGraph.set(ip2, new Set());
    }
    
    this.networkGraph.get(ip1)!.add(ip2);
    this.networkGraph.get(ip2)!.add(ip1);
  }

  private updateUserGraph(user1: string, user2: string, strength: number): void {
    if (!this.userGraph.has(user1)) {
      this.userGraph.set(user1, new Set());
    }
    if (!this.userGraph.has(user2)) {
      this.userGraph.set(user2, new Set());
    }
    
    this.userGraph.get(user1)!.add(user2);
    this.userGraph.get(user2)!.add(user1);
  }

  private async storeNetworkRelationship(relationship: NetworkRelationship): Promise<void> {
    try {
      const key = `relationship:network:${relationship.sourceIP}:${relationship.targetIP}`;
      await this.redisService.set(key, JSON.stringify(relationship), 3600);
    } catch (error) {
      logger.error('Error storing network relationship:', error);
    }
  }

  private async storeUserRelationship(relationship: UserRelationship): Promise<void> {
    try {
      const key = `relationship:user:${relationship.userId}`;
      await this.redisService.set(key, JSON.stringify(relationship), 3600);
    } catch (error) {
      logger.error('Error storing user relationship:', error);
    }
  }

  private getNetworkRelationships(ip: string): NetworkRelationship[] {
    return this.relationshipCache.get(ip) || [];
  }
}
