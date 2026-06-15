import { Neo4jService } from '@/graph/Neo4jService';
import { logger } from '@/utils/logger';
import { BanditContext } from '@/types/bandit';
import { getDefaultBanditConfiguration } from '@/config/banditConfig';

export interface ReputationResult {
  score: number;
  tier: 'trusted' | 'unknown' | 'suspicious';
  context: BanditContext;
  features: {
    neo4jRiskScore: number | null;
    totalSessions: number;
    totalFailedLogins: number;
    lastSeen: string | null;
    daysSinceLastSeen: number;
  };
}

export class UserReputationService {
  private cache: Map<string, { result: ReputationResult; expiresAt: number }> = new Map();
  private cacheTTL: number = 30000;
  private config = getDefaultBanditConfiguration();

  constructor(private neo4j: Neo4jService) {}

  async getReputation(userId?: string, ipAddress?: string): Promise<ReputationResult> {
    const cacheKey = userId || ipAddress || 'anonymous';
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await this.computeReputation(userId, ipAddress);

    this.cache.set(cacheKey, { result, expiresAt: Date.now() + this.cacheTTL });
    return result;
  }

  private async computeReputation(userId?: string, ipAddress?: string): Promise<ReputationResult> {
    const features = {
      neo4jRiskScore: null as number | null,
      totalSessions: 0,
      totalFailedLogins: 0,
      lastSeen: null as string | null,
      daysSinceLastSeen: 999,
    };

    if (userId && this.neo4j.isConnected()) {
      try {
        const userResult = await this.neo4j.readQuery(
          `MATCH (u:User {id: $userId})
           OPTIONAL MATCH (u)-[:USED]->(s:Session)
           WITH u, collect(s) as sessions
           RETURN u.riskScore as riskScore,
                  u.lastSeen as lastSeen,
                  size(sessions) as totalSessions,
                  reduce(total = 0, s IN sessions | total + coalesce(s.failedLogins, 0)) as totalFailedLogins`,
          { userId }
        );

        if (userResult.records.length > 0) {
          const record = userResult.records[0];
          const riskScore = record.get('riskScore');
          features.neo4jRiskScore = riskScore != null ? Number(riskScore) : null;

          const lastSeen = record.get('lastSeen');
          features.lastSeen = lastSeen || null;
          if (features.lastSeen) {
            const days = (Date.now() - new Date(features.lastSeen).getTime()) / 86400000;
            features.daysSinceLastSeen = Math.max(0, Math.round(days));
          }

          const sessions = record.get('totalSessions');
          features.totalSessions = sessions != null ? Number(sessions) : 0;

          const failedLogins = record.get('totalFailedLogins');
          features.totalFailedLogins = failedLogins != null ? Number(failedLogins) : 0;
        }
      } catch (error) {
        logger.warn('UserReputationService Neo4j query error:', error);
      }
    }

    const score = this.calculateScore(features);
    const tier = this.getTier(score);

    const context: BanditContext = {
      threatBucket: 'low',
      reputationTier: tier,
    };

    return { score, tier, context, features };
  }

  updateThreatBucket(context: BanditContext, threatScore: number): BanditContext {
    const [low, high] = this.config.threatBuckets;
    let bucket: 'low' | 'medium' | 'high';

    if (threatScore <= low) {
      bucket = 'low';
    } else if (threatScore <= high) {
      bucket = 'medium';
    } else {
      bucket = 'high';
    }

    return { threatBucket: bucket, reputationTier: context.reputationTier };
  }

  private calculateScore(features: ReputationResult['features']): number {
    let score = 0.7;

    if (features.neo4jRiskScore != null) {
      score -= features.neo4jRiskScore * 0.3;
    }

    if (features.totalFailedLogins > 0) {
      score -= Math.min(features.totalFailedLogins * 0.05, 0.3);
    }

    if (features.totalSessions > 10) {
      score += 0.1;
    }

    if (features.daysSinceLastSeen < 7) {
      score += 0.1;
    } else if (features.daysSinceLastSeen > 90) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private getTier(score: number): 'trusted' | 'unknown' | 'suspicious' {
    const [suspiciousThreshold] = this.config.reputationThresholds;
    if (score > 0.7) return 'trusted';
    if (score > suspiciousThreshold) return 'unknown';
    return 'suspicious';
  }

  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}
