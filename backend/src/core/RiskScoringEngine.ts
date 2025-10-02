import { logger } from '@/utils/logger';
import { RedisService } from '@/services/RedisService';
import * as geoip from 'geoip-lite';
import {
  RiskContext,
  TemporalContext,
  GeographicContext,
  BehavioralContext,
  SessionContext,
  NetworkContext,
  ScoringWeights,
  ContextualRiskScore,
  ContributingFactor,
  RiskScoringConfig
} from '@/types/risk';

export interface BaseScores {
  behavioral: number;
  statistical: number;
  relationship: number;
}

export class RiskScoringEngine {
  private redisService: RedisService;
  private config: RiskScoringConfig;
  private contextCache: Map<string, RiskContext> = new Map();

  constructor(redisService: RedisService, config: RiskScoringConfig) {
    this.redisService = redisService;
    this.config = config;
  }

  /**
   * Calculate contextual risk score
   */
  public async calculateContextualRisk(
    baseScores: BaseScores,
    requestData: any
  ): Promise<ContextualRiskScore> {
    try {
      // Extract risk context from request
      const context = await this.extractRiskContext(requestData);
      
      // Calculate base score using configured weights
      const baseScore = this.calculateBaseScore(baseScores);
      
      // Apply contextual multipliers
      const contextualScore = this.applyContextualMultipliers(baseScore, context);
      
      // Calculate confidence level
      const confidence = this.calculateConfidence(context, baseScores);
      
      // Determine risk level
      const riskLevel = this.determineRiskLevel(contextualScore);
      
      // Identify contributing factors
      const contributingFactors = this.identifyContributingFactors(context, baseScores);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(context, riskLevel);
      
      // Cache context for future use
      this.cacheContext(requestData.sessionId, context);
      
      const result: ContextualRiskScore = {
        baseScore,
        contextualScore,
        confidence,
        riskLevel,
        contributing_factors: contributingFactors,
        recommendations
      };
      
      logger.debug('Contextual risk calculated:', {
        sessionId: requestData.sessionId,
        baseScore,
        contextualScore,
        riskLevel,
        confidence
      });
      
      return result;
      
    } catch (error) {
      logger.error('Error calculating contextual risk:', error);
      
      // Return safe fallback
      return {
        baseScore: this.calculateBaseScore(baseScores),
        contextualScore: this.calculateBaseScore(baseScores),
        confidence: 0.5,
        riskLevel: 'medium',
        contributing_factors: [],
        recommendations: ['Unable to perform full risk assessment']
      };
    }
  }

  /**
   * Extract risk context from request data
   */
  private async extractRiskContext(requestData: any): Promise<RiskContext> {
    const temporal = this.extractTemporalContext(requestData);
    const geographic = await this.extractGeographicContext(requestData);
    const behavioral = await this.extractBehavioralContext(requestData);
    const session = this.extractSessionContext(requestData);
    const network = await this.extractNetworkContext(requestData);

    return {
      temporal,
      geographic,
      behavioral,
      session,
      network
    };
  }

  /**
   * Extract temporal context
   */
  private extractTemporalContext(requestData: any): TemporalContext {
    const now = new Date();
    const timeOfDay = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Business hours: 9 AM - 5 PM, Monday-Friday
    const isBusinessHours = (
      timeOfDay >= 9 && timeOfDay <= 17 && 
      dayOfWeek >= 1 && dayOfWeek <= 5
    );
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    return {
      timeOfDay,
      dayOfWeek,
      isBusinessHours,
      isWeekend,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      requestFrequency: requestData.requestFrequency || 0
    };
  }

  /**
   * Extract geographic context
   */
  private async extractGeographicContext(requestData: any): Promise<GeographicContext> {
    try {
      const geo = geoip.lookup(requestData.ipAddress);
      
      if (!geo) {
        return {
          country: 'unknown',
          region: 'unknown',
          city: 'unknown',
          isVpn: false,
          isProxy: false,
          isTor: false,
          riskScore: 0.5 // Unknown = medium risk
        };
      }

      // Check for VPN/Proxy indicators (simplified)
      const isVpn = this.detectVpnUsage(requestData);
      const isProxy = this.detectProxyUsage(requestData);
      const isTor = this.detectTorUsage(requestData);
      
      // Calculate geographic risk score based on threat intelligence
      const riskScore = await this.calculateGeographicRisk(geo.country);

      return {
        country: geo.country,
        region: geo.region || 'unknown',
        city: geo.city || 'unknown',
        coordinates: geo.ll ? {
          latitude: geo.ll[0],
          longitude: geo.ll[1]
        } : undefined,
        isVpn,
        isProxy,
        isTor,
        riskScore
      };
    } catch (error) {
      logger.error('Error extracting geographic context:', error);
      return {
        country: 'unknown',
        region: 'unknown',
        city: 'unknown',
        isVpn: false,
        isProxy: false,
        isTor: false,
        riskScore: 0.5
      };
    }
  }

  /**
   * Extract behavioral context
   */
  private async extractBehavioralContext(requestData: any): Promise<BehavioralContext> {
    const sessionAge = Date.now() - (requestData.sessionStartTime || Date.now());
    
    // Determine user type based on historical data
    const userType = await this.determineUserType(requestData);
    
    // Analyze navigation patterns
    const navigationPattern = this.analyzeNavigationPattern(requestData);
    
    // Determine interaction level
    const interactionLevel = this.determineInteractionLevel(requestData);
    
    return {
      userType,
      sessionAge,
      pageSequenceAnomalies: requestData.pageSequenceAnomalies || 0,
      navigationPattern,
      interactionLevel,
      deviceConsistency: this.checkDeviceConsistency(requestData)
    };
  }

  /**
   * Extract session context
   */
  private extractSessionContext(requestData: any): SessionContext {
    return {
      sessionId: requestData.sessionId,
      userId: requestData.userId,
      isAuthenticated: !!requestData.userId,
      sessionDuration: requestData.sessionDuration || 0,
      requestCount: requestData.requestCount || 1,
      errorCount: requestData.errorCount || 0,
      privilegeLevel: requestData.privilegeLevel || 'guest',
      hashedFingerprint: requestData.hashedFingerprint || 'unknown'
    };
  }

  /**
   * Extract network context
   */
  private async extractNetworkContext(requestData: any): Promise<NetworkContext> {
    const ipReputation = await this.getIpReputation(requestData.ipAddress);
    
    return {
      ipReputation,
      asnNumber: 0, // Would be populated from ASN lookup
      asnOrganization: 'unknown',
      connectionType: this.determineConnectionType(requestData),
      threatIntelligence: {
        isKnownThreat: ipReputation > 0.7,
        threatSources: [],
        lastSeenMalicious: undefined
      }
    };
  }

  /**
   * Calculate base score from individual analyzer scores
   */
  private calculateBaseScore(baseScores: BaseScores): number {
    const weights = this.config.weights;
    
    return (
      baseScores.behavioral * weights.behavioral +
      baseScores.statistical * weights.statistical +
      baseScores.relationship * weights.relationship
    );
  }

  /**
   * Apply contextual multipliers to base score
   */
  private applyContextualMultipliers(baseScore: number, context: RiskContext): number {
    let multiplier = 1.0;
    const multipliers = this.config.weights.contextMultipliers;

    // Temporal multipliers
    if (!context.temporal.isBusinessHours) {
      multiplier *= multipliers.temporal.offHours;
    }
    if (context.temporal.isWeekend) {
      multiplier *= multipliers.temporal.weekend;
    }
    if (context.temporal.timeOfDay >= 0 && context.temporal.timeOfDay <= 6) {
      multiplier *= multipliers.temporal.nightTime;
    }
    if (context.temporal.requestFrequency > 60) { // More than 60 req/min
      multiplier *= multipliers.temporal.highFrequency;
    }

    // Geographic multipliers
    if (context.geographic.isVpn) {
      multiplier *= multipliers.geographic.vpnUsage;
    }
    if (context.geographic.isProxy) {
      multiplier *= multipliers.geographic.proxyUsage;
    }
    if (context.geographic.isTor) {
      multiplier *= multipliers.geographic.torUsage;
    }
    if (context.geographic.riskScore > 0.7) {
      multiplier *= multipliers.geographic.highRiskCountry;
    }

    // Behavioral multipliers
    if (context.behavioral.userType === 'new') {
      multiplier *= multipliers.behavioral.newUser;
    }
    if (context.behavioral.userType === 'suspicious') {
      multiplier *= multipliers.behavioral.suspiciousUser;
    }
    if (context.behavioral.interactionLevel === 'bot-like') {
      multiplier *= multipliers.behavioral.botLikeBehavior;
    }

    // Session multipliers
    if (!context.session.isAuthenticated) {
      multiplier *= multipliers.session.unauthenticated;
    }
    if (context.session.sessionDuration < 30000) { // Less than 30 seconds
      multiplier *= multipliers.session.shortSession;
    }

    // Network multipliers
    if (context.network.threatIntelligence.isKnownThreat) {
      multiplier *= multipliers.network.knownThreat;
    }
    if (context.network.ipReputation > 0.5) {
      multiplier *= multipliers.network.poorReputation;
    }

    // Apply sensitivity factor
    const sensitizedMultiplier = 1 + (multiplier - 1) * this.config.contextSensitivity;
    
    return Math.min(baseScore * sensitizedMultiplier, 1.0);
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(context: RiskContext, baseScores: BaseScores): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence with more data points
    if (context.session.requestCount > 10) confidence += 0.1;
    if (context.behavioral.sessionAge > 300000) confidence += 0.1; // 5+ minutes
    if (context.geographic.country !== 'unknown') confidence += 0.1;
    if (context.session.isAuthenticated) confidence += 0.15;
    
    // Decrease confidence for inconsistencies
    if (!context.behavioral.deviceConsistency) confidence -= 0.1;
    if (context.geographic.country === 'unknown') confidence -= 0.1;
    
    return Math.max(0.1, Math.min(confidence, 1.0));
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    const thresholds = this.config.thresholds;
    
    if (score >= thresholds.critical) return 'critical';
    if (score >= thresholds.high) return 'high';
    if (score >= thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Identify contributing factors
   */
  private identifyContributingFactors(context: RiskContext, baseScores: BaseScores): ContributingFactor[] {
    const factors: ContributingFactor[] = [];

    // Add significant contributing factors
    if (baseScores.behavioral > 0.7) {
      factors.push({
        factor: 'behavioral_anomaly',
        weight: this.config.weights.behavioral,
        impact: baseScores.behavioral,
        description: 'Suspicious behavioral patterns detected'
      });
    }

    if (context.geographic.isVpn || context.geographic.isProxy) {
      factors.push({
        factor: 'anonymization_tools',
        weight: 0.3,
        impact: 0.8,
        description: 'VPN or proxy usage detected'
      });
    }

    if (!context.temporal.isBusinessHours) {
      factors.push({
        factor: 'off_hours_access',
        weight: 0.2,
        impact: 0.6,
        description: 'Access outside business hours'
      });
    }

    return factors;
  }

  /**
   * Generate recommendations based on context and risk
   */
  private generateRecommendations(context: RiskContext, riskLevel: string): string[] {
    const recommendations: string[] = [];

    switch (riskLevel) {
      case 'critical':
        recommendations.push('Block request immediately');
        recommendations.push('Trigger security alert');
        recommendations.push('Log detailed forensic data');
        break;
      case 'high':
        recommendations.push('Apply enhanced authentication');
        recommendations.push('Increase monitoring');
        recommendations.push('Rate limit aggressively');
        break;
      case 'medium':
        recommendations.push('Monitor closely');
        recommendations.push('Apply standard rate limiting');
        break;
      case 'low':
        recommendations.push('Allow with normal monitoring');
        break;
    }

    // Context-specific recommendations
    if (context.geographic.isVpn) {
      recommendations.push('Verify user identity due to VPN usage');
    }
    
    if (!context.session.isAuthenticated && riskLevel !== 'low') {
      recommendations.push('Encourage user authentication');
    }

    return recommendations;
  }

  // Helper methods (simplified implementations)
  private detectVpnUsage(requestData: any): boolean {
    // Simplified VPN detection
    return false;
  }

  private detectProxyUsage(requestData: any): boolean {
    // Simplified proxy detection
    return false;
  }

  private detectTorUsage(requestData: any): boolean {
    // Simplified Tor detection
    return false;
  }

  private async calculateGeographicRisk(country: string): Promise<number> {
    // Simplified geographic risk scoring
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    return highRiskCountries.includes(country) ? 0.8 : 0.2;
  }

  private async determineUserType(requestData: any): Promise<'new' | 'returning' | 'frequent' | 'suspicious'> {
    // Simplified user type determination
    if (!requestData.userId) return 'new';
    if (requestData.requestCount > 100) return 'frequent';
    if (requestData.requestCount > 10) return 'returning';
    return 'new';
  }

  private analyzeNavigationPattern(requestData: any): 'linear' | 'random' | 'targeted' | 'scanning' {
    // Simplified navigation pattern analysis
    return 'linear';
  }

  private determineInteractionLevel(requestData: any): 'high' | 'medium' | 'low' | 'bot-like' {
    // Simplified interaction level determination
    return 'medium';
  }

  private checkDeviceConsistency(requestData: any): boolean {
    // Simplified device consistency check
    return true;
  }

  private determineConnectionType(requestData: any): 'residential' | 'datacenter' | 'mobile' | 'unknown' {
    // Simplified connection type determination
    return 'unknown';
  }

  private async getIpReputation(ipAddress: string): Promise<number> {
    // Simplified IP reputation lookup
    return 0.1; // Low risk by default
  }

  private cacheContext(sessionId: string, context: RiskContext): void {
    this.contextCache.set(sessionId, context);
    
    // Clean up old entries (keep last 1000)
    if (this.contextCache.size > 1000) {
      const firstKey = this.contextCache.keys().next().value;
      if (firstKey) {
        this.contextCache.delete(firstKey);
      }
    }
  }

  /**
   * Get cached context for a session
   */
  public getCachedContext(sessionId: string): RiskContext | null {
    return this.contextCache.get(sessionId) || null;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<RiskScoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Risk scoring configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfig(): RiskScoringConfig {
    return { ...this.config };
  }
}
