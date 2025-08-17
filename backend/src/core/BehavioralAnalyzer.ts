import { logger } from '@/utils/logger';
import { RedisService } from '@/services/RedisService';

export interface BehaviorPattern {
  sessionId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  requestPatterns: RequestPattern[];
  timingPatterns: TimingPattern;
  navigationPatterns: NavigationPattern;
  interactionPatterns: InteractionPattern;
  riskIndicators: RiskIndicator[];
  timestamp: Date;
}

export interface RequestPattern {
  path: string;
  method: string;
  frequency: number;
  timeOfDay: number;
  dayOfWeek: number;
}

export interface TimingPattern {
  averageTimeBetweenRequests: number;
  burstRequests: number;
  idlePeriods: number;
  sessionDuration: number;
}

export interface NavigationPattern {
  pageSequence: string[];
  backButtonUsage: number;
  directAccess: number;
  referrerPatterns: string[];
}

export interface InteractionPattern {
  mouseMovements: number;
  keyboardPatterns: string[];
  formInteractions: number;
  scrollBehavior: number;
}

export interface RiskIndicator {
  type: string;
  score: number;
  description: string;
}

export class BehavioralAnalyzer {
  private redisService: RedisService;
  private behaviorCache: Map<string, BehaviorPattern>;
  private riskThresholds: Map<string, number> = new Map();

  constructor() {
    this.redisService = new RedisService();
    this.behaviorCache = new Map();
    this.initializeRiskThresholds();
  }

  /**
   * Initialize risk thresholds for different behavioral indicators
   */
  private initializeRiskThresholds(): void {
    this.riskThresholds = new Map([
      ['request_frequency', 0.8],
      ['timing_anomaly', 0.7],
      ['navigation_suspicious', 0.6],
      ['interaction_robotic', 0.9],
      ['session_anomaly', 0.75]
    ]);
  }

  /**
   * Main behavioral analysis method
   */
  public async analyze(requestData: any): Promise<number> {
    try {
      const sessionId = requestData.sessionId;
      
      // Get or create behavior pattern for this session
      let behaviorPattern = await this.getBehaviorPattern(sessionId);
      
      // Update behavior pattern with new request data
      behaviorPattern = this.updateBehaviorPattern(behaviorPattern, requestData);
      
      // Store updated pattern
      await this.storeBehaviorPattern(sessionId, behaviorPattern);
      
      // Analyze behavior and calculate risk score
      const riskScore = this.calculateBehavioralRisk(behaviorPattern);
      
      // Cache the pattern for quick access
      this.behaviorCache.set(sessionId, behaviorPattern);
      
      logger.debug(`Behavioral analysis completed for session ${sessionId}, risk score: ${riskScore}`);
      
      return riskScore;
      
    } catch (error) {
      logger.error('Error in behavioral analysis:', error);
      return 0.1; // Return low risk score on error
    }
  }

  /**
   * Get existing behavior pattern or create new one
   */
  private async getBehaviorPattern(sessionId: string): Promise<BehaviorPattern> {
    // Check cache first
    if (this.behaviorCache.has(sessionId)) {
      return this.behaviorCache.get(sessionId)!;
    }
    
    // Check Redis
    const cached = await this.redisService.get(`behavior:${sessionId}`);
    if (cached) {
      const pattern = JSON.parse(cached) as BehaviorPattern;
      this.behaviorCache.set(sessionId, pattern);
      return pattern;
    }
    
    // Create new pattern
    return this.createNewBehaviorPattern(sessionId);
  }

  /**
   * Create new behavior pattern
   */
  private createNewBehaviorPattern(sessionId: string): BehaviorPattern {
    return {
      sessionId,
      ipAddress: '',
      userAgent: '',
      requestPatterns: [],
      timingPatterns: {
        averageTimeBetweenRequests: 0,
        burstRequests: 0,
        idlePeriods: 0,
        sessionDuration: 0
      },
      navigationPatterns: {
        pageSequence: [],
        backButtonUsage: 0,
        directAccess: 0,
        referrerPatterns: []
      },
      interactionPatterns: {
        mouseMovements: 0,
        keyboardPatterns: [],
        formInteractions: 0,
        scrollBehavior: 0
      },
      riskIndicators: [],
      timestamp: new Date()
    };
  }

  /**
   * Update behavior pattern with new request data
   */
  private updateBehaviorPattern(pattern: BehaviorPattern, requestData: any): BehaviorPattern {
    const now = new Date();
    
    // Update basic info
    pattern.ipAddress = requestData.ipAddress;
    pattern.userAgent = requestData.userAgent;
    pattern.userId = requestData.userId;
    pattern.timestamp = now;
    
    // Update request patterns
    this.updateRequestPatterns(pattern, requestData);
    
    // Update timing patterns
    this.updateTimingPatterns(pattern, requestData);
    
    // Update navigation patterns
    this.updateNavigationPatterns(pattern, requestData);
    
    // Update interaction patterns
    this.updateInteractionPatterns(pattern, requestData);
    
    // Recalculate risk indicators
    pattern.riskIndicators = this.calculateRiskIndicators(pattern);
    
    return pattern;
  }

  /**
   * Update request patterns
   */
  private updateRequestPatterns(pattern: BehaviorPattern, requestData: any): void {
    const existingPattern = pattern.requestPatterns.find(
      p => p.path === requestData.requestPath && p.method === requestData.requestMethod
    );
    
    if (existingPattern) {
      existingPattern.frequency++;
    } else {
      pattern.requestPatterns.push({
        path: requestData.requestPath,
        method: requestData.requestMethod,
        frequency: 1,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      });
    }
  }

  /**
   * Update timing patterns
   */
  private updateTimingPatterns(pattern: BehaviorPattern, requestData: any): void {
    const now = new Date();
    const timeDiff = now.getTime() - pattern.timestamp.getTime();
    
    // Update session duration
    pattern.timingPatterns.sessionDuration = now.getTime() - pattern.timestamp.getTime();
    
    // Detect burst requests (multiple requests in short time)
    if (timeDiff < 1000) { // Less than 1 second
      pattern.timingPatterns.burstRequests++;
    }
    
    // Detect idle periods (long gaps between requests)
    if (timeDiff > 300000) { // More than 5 minutes
      pattern.timingPatterns.idlePeriods++;
    }
    
    // Update average time between requests
    const totalRequests = pattern.requestPatterns.reduce((sum, p) => sum + p.frequency, 0);
    if (totalRequests > 1) {
      pattern.timingPatterns.averageTimeBetweenRequests = 
        pattern.timingPatterns.sessionDuration / totalRequests;
    }
  }

  /**
   * Update navigation patterns
   */
  private updateNavigationPatterns(pattern: BehaviorPattern, requestData: any): void {
    // Add to page sequence
    pattern.navigationPatterns.pageSequence.push(requestData.requestPath);
    
    // Check for direct access (no referrer)
    const referrer = requestData.headers.referer;
    if (!referrer) {
      pattern.navigationPatterns.directAccess++;
    } else {
      pattern.navigationPatterns.referrerPatterns.push(referrer);
    }
    
    // Keep only last 20 pages to prevent memory issues
    if (pattern.navigationPatterns.pageSequence.length > 20) {
      pattern.navigationPatterns.pageSequence = pattern.navigationPatterns.pageSequence.slice(-20);
    }
  }

  /**
   * Update interaction patterns
   */
  private updateInteractionPatterns(pattern: BehaviorPattern, requestData: any): void {
    // This would typically come from client-side tracking
    // For now, we'll simulate based on request characteristics
    
    // Simulate mouse movements based on request timing
    const timeDiff = Date.now() - pattern.timestamp.getTime();
    if (timeDiff < 1000) {
      pattern.interactionPatterns.mouseMovements += Math.floor(Math.random() * 10);
    }
    
    // Detect form interactions
    if (requestData.requestMethod === 'POST' && requestData.body) {
      pattern.interactionPatterns.formInteractions++;
    }
    
    // Simulate scroll behavior
    pattern.interactionPatterns.scrollBehavior += Math.floor(Math.random() * 5);
  }

  /**
   * Calculate risk indicators based on behavior patterns
   */
  private calculateRiskIndicators(pattern: BehaviorPattern): RiskIndicator[] {
    const indicators: RiskIndicator[] = [];
    
    // Request frequency risk
    const totalRequests = pattern.requestPatterns.reduce((sum, p) => sum + p.frequency, 0);
    const sessionDurationMinutes = pattern.timingPatterns.sessionDuration / 60000;
    const requestsPerMinute = totalRequests / Math.max(sessionDurationMinutes, 1);
    
    if (requestsPerMinute > 60) { // More than 60 requests per minute
      indicators.push({
        type: 'request_frequency',
        score: Math.min(requestsPerMinute / 100, 1.0),
        description: `High request frequency: ${requestsPerMinute.toFixed(2)} req/min`
      });
    }
    
    // Timing anomaly risk
    if (pattern.timingPatterns.burstRequests > 10) {
      indicators.push({
        type: 'timing_anomaly',
        score: Math.min(pattern.timingPatterns.burstRequests / 20, 1.0),
        description: `Burst request pattern detected: ${pattern.timingPatterns.burstRequests} bursts`
      });
    }
    
    // Navigation suspicious risk
    if (pattern.navigationPatterns.directAccess > 5) {
      indicators.push({
        type: 'navigation_suspicious',
        score: Math.min(pattern.navigationPatterns.directAccess / 10, 1.0),
        description: `Multiple direct accesses detected: ${pattern.navigationPatterns.directAccess}`
      });
    }
    
    // Interaction robotic risk
    const avgMouseMovements = pattern.interactionPatterns.mouseMovements / 
      Math.max(pattern.requestPatterns.length, 1);
    
    if (avgMouseMovements < 2) { // Very few mouse movements
      indicators.push({
        type: 'interaction_robotic',
        score: 0.9,
        description: 'Robotic interaction pattern detected'
      });
    }
    
    // Session anomaly risk
    if (pattern.timingPatterns.sessionDuration > 3600000) { // More than 1 hour
      indicators.push({
        type: 'session_anomaly',
        score: 0.7,
        description: 'Unusually long session duration'
      });
    }
    
    return indicators;
  }

  /**
   * Calculate overall behavioral risk score
   */
  private calculateBehavioralRisk(pattern: BehaviorPattern): number {
    if (pattern.riskIndicators.length === 0) {
      return 0.1; // Low risk
    }
    
    // Calculate weighted average of risk indicators
    const totalScore = pattern.riskIndicators.reduce((sum, indicator) => {
      const weight = this.riskThresholds.get(indicator.type) || 0.5;
      return sum + (indicator.score * weight);
    }, 0);
    
    const averageScore = totalScore / pattern.riskIndicators.length;
    
    // Apply additional factors
    let finalScore = averageScore;
    
    // Increase risk for new sessions
    if (pattern.requestPatterns.length < 5) {
      finalScore *= 1.2;
    }
    
    // Increase risk for suspicious user agents
    if (this.isSuspiciousUserAgent(pattern.userAgent)) {
      finalScore *= 1.3;
    }
    
    // Increase risk for known malicious IP patterns
    if (this.isSuspiciousIP(pattern.ipAddress)) {
      finalScore *= 1.4;
    }
    
    return Math.min(finalScore, 1.0);
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
      'python', 'java', 'perl', 'ruby', 'php'
    ];
    
    const lowerUA = userAgent.toLowerCase();
    return suspiciousPatterns.some(pattern => lowerUA.includes(pattern));
  }

  /**
   * Check if IP address is suspicious
   */
  private isSuspiciousIP(ipAddress: string): boolean {
    // Check for private IP ranges
    const privateRanges = [
      '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
      '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
      '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'
    ];
    
    return privateRanges.some(range => ipAddress.startsWith(range));
  }

  /**
   * Store behavior pattern in Redis
   */
  private async storeBehaviorPattern(sessionId: string, pattern: BehaviorPattern): Promise<void> {
    try {
      await this.redisService.set(
        `behavior:${sessionId}`,
        JSON.stringify(pattern),
        3600 // Expire in 1 hour
      );
    } catch (error) {
      logger.error('Error storing behavior pattern:', error);
    }
  }

  /**
   * Get behavior pattern for analysis
   */
  public async getBehaviorPatternForAnalysis(sessionId: string): Promise<BehaviorPattern | null> {
    return await this.getBehaviorPattern(sessionId);
  }

  /**
   * Clear behavior cache
   */
  public clearCache(): void {
    this.behaviorCache.clear();
  }
}
