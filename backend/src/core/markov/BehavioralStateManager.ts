import { logger } from '@/utils/logger';
import {
  BehavioralState,
  BehavioralActionType,
  BehavioralContext,
  StateSequence,
  StateCompressionConfig
} from '@/types/markov';

/**
 * Request data interface for state conversion
 */
interface RequestData {
  method?: string;
  path?: string;
  statusCode?: number;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  userId?: string;
  timestamp?: Date;
  duration?: number;
  errorType?: string;
  riskScore?: number;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * BehavioralStateManager converts raw user actions into behavioral states
 * Handles state categorization, context determination, and sequence management
 */
export class BehavioralStateManager {
  private compressionConfig: StateCompressionConfig;
  private stateHistory: Map<string, StateSequence> = new Map();
  private actionPatterns: Map<string, RegExp> = new Map();
  private contextRules: Map<string, (data: RequestData) => BehavioralContext> = new Map();

  constructor(compressionConfig?: StateCompressionConfig) {
    this.compressionConfig = compressionConfig || this.getDefaultCompressionConfig();
    this.initializeActionPatterns();
    this.initializeContextRules();
  }

  /**
   * Convert request data to behavioral state
   */
  public createBehavioralState(requestData: RequestData): BehavioralState {
    try {
      const action = this.determineAction(requestData);
      const context = this.determineContext(requestData);
      const timestamp = requestData.timestamp || new Date();

      const state: BehavioralState = {
        action,
        context,
        timestamp,
        metadata: {
          path: requestData.path,
          method: requestData.method,
          statusCode: requestData.statusCode,
          userAgent: requestData.userAgent,
          ipAddress: requestData.ipAddress,
          sessionId: requestData.sessionId,
          userId: requestData.userId,
          duration: requestData.duration,
          errorType: requestData.errorType,
          riskScore: requestData.riskScore
        }
      };

      logger.debug('Created behavioral state', {
        action: state.action,
        context: state.context,
        sessionId: state.metadata.sessionId
      });

      return state;

    } catch (error) {
      logger.error('Error creating behavioral state:', error);
      return this.getDefaultState(requestData);
    }
  }

  /**
   * Add state to sequence and manage session history
   */
  public addToSequence(state: BehavioralState): StateSequence {
    const sessionId = state.metadata.sessionId || 'unknown';
    
    if (!this.stateHistory.has(sessionId)) {
      this.stateHistory.set(sessionId, {
        states: [],
        sessionId,
        userId: state.metadata.userId,
        startTime: state.timestamp,
        endTime: state.timestamp,
        totalDuration: 0,
        isComplete: false
      });
    }

    const sequence = this.stateHistory.get(sessionId)!;
    sequence.states.push(state);
    sequence.endTime = state.timestamp;
    sequence.totalDuration = sequence.endTime.getTime() - sequence.startTime.getTime();

    // Update risk score if available
    if (state.metadata.riskScore !== undefined) {
      sequence.riskScore = Math.max(sequence.riskScore || 0, state.metadata.riskScore);
    }

    // Apply compression if needed
    if (this.compressionConfig.enabled && sequence.states.length > 100) {
      this.compressSequence(sequence);
    }

    return sequence;
  }

  /**
   * Get sequence for a session
   */
  public getSequence(sessionId: string): StateSequence | undefined {
    return this.stateHistory.get(sessionId);
  }

  /**
   * Complete a sequence (e.g., on session end)
   */
  public completeSequence(sessionId: string): StateSequence | undefined {
    const sequence = this.stateHistory.get(sessionId);
    if (sequence) {
      sequence.isComplete = true;
      sequence.endTime = new Date();
    }
    return sequence;
  }

  /**
   * Get all active sequences
   */
  public getActiveSequences(): StateSequence[] {
    return Array.from(this.stateHistory.values()).filter(seq => !seq.isComplete);
  }

  /**
   * Get sequences by user
   */
  public getSequencesByUser(userId: string): StateSequence[] {
    return Array.from(this.stateHistory.values()).filter(seq => seq.userId === userId);
  }

  /**
   * Clean up old sequences
   */
  public cleanupOldSequences(maxAgeHours: number = 24): number {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, sequence] of this.stateHistory.entries()) {
      if (sequence.endTime.getTime() < cutoffTime) {
        this.stateHistory.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old sequences`);
    }

    return cleanedCount;
  }

  /**
   * Get statistics about managed sequences
   */
  public getStatistics(): {
    totalSequences: number;
    activeSequences: number;
    completedSequences: number;
    averageSequenceLength: number;
    totalStates: number;
    memoryUsage: number;
  } {
    const sequences = Array.from(this.stateHistory.values());
    const activeSequences = sequences.filter(seq => !seq.isComplete).length;
    const completedSequences = sequences.filter(seq => seq.isComplete).length;
    const totalStates = sequences.reduce((sum, seq) => sum + seq.states.length, 0);
    const averageSequenceLength = sequences.length > 0 ? totalStates / sequences.length : 0;

    return {
      totalSequences: sequences.length,
      activeSequences,
      completedSequences,
      averageSequenceLength,
      totalStates,
      memoryUsage: this.calculateMemoryUsage()
    };
  }

  /**
   * Determine action type from request data
   */
  private determineAction(data: RequestData): BehavioralActionType {
    const path = data.path || '';
    const method = data.method || 'GET';
    const statusCode = data.statusCode || 200;

    // Error states
    if (statusCode >= 400) {
      if (statusCode === 404) return 'error_404';
      if (statusCode === 403) return 'error_403';
      if (statusCode >= 500) return 'error_500';
      return 'error_404'; // Default error
    }

    // Authentication actions
    if (path.includes('/auth/') || path.includes('/login')) {
      if (method === 'POST') {
        return statusCode === 200 ? 'login_success' : 'login_failure';
      }
      return 'login_attempt';
    }

    if (path.includes('/logout')) return 'logout';

    // API calls
    if (path.startsWith('/api/')) return 'api_call';

    // Search actions
    if (path.includes('/search') || data.body?.query) return 'search';

    // Form submissions
    if (method === 'POST' && !path.includes('/api/')) return 'form_submit';

    // Downloads
    if (path.includes('/download') || path.includes('.pdf') || path.includes('.zip')) {
      return 'download';
    }

    // File uploads
    if (method === 'POST' && (path.includes('/upload') || data.headers?.['content-type']?.includes('multipart'))) {
      return 'upload';
    }

    // Navigation actions
    if (method === 'GET') {
      // Check for specific navigation patterns
      for (const [pattern, regex] of this.actionPatterns) {
        if (regex.test(path)) {
          return pattern as BehavioralActionType;
        }
      }
      return 'page_view';
    }

    // Default based on method
    if (method === 'PUT' || method === 'PATCH') return 'form_submit';
    if (method === 'DELETE') return 'api_call';

    return 'page_view';
  }

  /**
   * Determine behavioral context from request data
   */
  private determineContext(data: RequestData): BehavioralContext {
    // Check custom context rules first
    for (const [ruleId, rule] of this.contextRules) {
      try {
        const context = rule(data);
        if (context !== 'normal') {
          return context;
        }
      } catch (error) {
        logger.warn(`Context rule ${ruleId} failed:`, error);
      }
    }

    // Risk-based context
    if (data.riskScore !== undefined) {
      if (data.riskScore > 0.8) return 'suspicious';
      if (data.riskScore > 0.6) return 'restricted';
    }

    // User authentication status
    if (data.userId) return 'authenticated';

    // Default context
    return 'normal';
  }

  /**
   * Initialize action pattern matching
   */
  private initializeActionPatterns(): void {
    this.actionPatterns.set('back_button', /\/back$|history\.back/i);
    this.actionPatterns.set('refresh', /\/refresh$|reload/i);
    this.actionPatterns.set('redirect', /\/redirect/i);
    this.actionPatterns.set('scroll', /\/scroll|pagination/i);
    this.actionPatterns.set('click', /\/click|button|link/i);
    this.actionPatterns.set('rate_limit_hit', /\/rate-limit|429/i);
    this.actionPatterns.set('captcha_challenge', /\/captcha|challenge/i);
    this.actionPatterns.set('blocked_request', /\/blocked|denied/i);
  }

  /**
   * Initialize context determination rules
   */
  private initializeContextRules(): void {
    // Suspicious IP patterns
    this.contextRules.set('suspicious_ip', (data) => {
      if (data.ipAddress) {
        // Check for known suspicious patterns (simplified)
        if (data.ipAddress.startsWith('10.0.0.') || 
            data.ipAddress.includes('suspicious')) {
          return 'suspicious';
        }
      }
      return 'normal';
    });

    // Admin/privileged access
    this.contextRules.set('privileged_access', (data) => {
      if (data.path?.includes('/admin') || 
          data.path?.includes('/privileged') ||
          data.userId?.includes('admin')) {
        return 'privileged';
      }
      return 'normal';
    });

    // Anonymous access patterns
    this.contextRules.set('anonymous_access', (data) => {
      if (!data.userId && !data.sessionId) {
        return 'anonymous';
      }
      return 'normal';
    });

    // Bot-like behavior
    this.contextRules.set('bot_detection', (data) => {
      const userAgent = data.userAgent?.toLowerCase() || '';
      if (userAgent.includes('bot') || 
          userAgent.includes('crawler') || 
          userAgent.includes('spider')) {
        return 'suspicious';
      }
      return 'normal';
    });

    // High frequency access
    this.contextRules.set('high_frequency', (data) => {
      // This would need to be implemented with rate tracking
      // For now, return normal
      return 'normal';
    });
  }

  /**
   * Compress sequence to save memory
   */
  private compressSequence(sequence: StateSequence): void {
    if (!this.compressionConfig.enabled) return;

    const originalLength = sequence.states.length;
    const targetLength = Math.floor(originalLength * this.compressionConfig.compressionRatio);

    if (targetLength >= originalLength) return;

    switch (this.compressionConfig.compressionAlgorithm) {
      case 'frequency':
        this.compressByFrequency(sequence, targetLength);
        break;
      case 'recency':
        this.compressByRecency(sequence, targetLength);
        break;
      case 'importance':
        this.compressByImportance(sequence, targetLength);
        break;
      case 'hybrid':
        this.compressByHybrid(sequence, targetLength);
        break;
    }

    logger.debug(`Compressed sequence from ${originalLength} to ${sequence.states.length} states`);
  }

  /**
   * Compress by keeping most frequent state types
   */
  private compressByFrequency(sequence: StateSequence, targetLength: number): void {
    // Count state frequencies
    const frequencies = new Map<string, number>();
    for (const state of sequence.states) {
      const key = `${state.action}:${state.context}`;
      frequencies.set(key, (frequencies.get(key) || 0) + 1);
    }

    // Sort states by frequency
    sequence.states.sort((a, b) => {
      const keyA = `${a.action}:${a.context}`;
      const keyB = `${b.action}:${b.context}`;
      return (frequencies.get(keyB) || 0) - (frequencies.get(keyA) || 0);
    });

    sequence.states = sequence.states.slice(0, targetLength);
  }

  /**
   * Compress by keeping most recent states
   */
  private compressByRecency(sequence: StateSequence, targetLength: number): void {
    sequence.states.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    sequence.states = sequence.states.slice(0, targetLength);
  }

  /**
   * Compress by keeping most important states
   */
  private compressByImportance(sequence: StateSequence, targetLength: number): void {
    // Define importance scores for different actions
    const importanceScores: Record<BehavioralActionType, number> = {
      'login_success': 10, 'login_failure': 9, 'logout': 8,
      'error_500': 7, 'error_403': 6, 'error_404': 5,
      'suspicious_activity': 10, 'blocked_request': 8,
      'form_submit': 6, 'api_call': 5, 'search': 4,
      'page_view': 2, 'click': 1, 'scroll': 1,
      'idle': 0, 'active': 1, 'focus_lost': 1, 'focus_gained': 1,
      'page_exit': 3, 'redirect': 2, 'back_button': 2, 'refresh': 2,
      'download': 4, 'upload': 5, 'rate_limit_hit': 7,
      'captcha_challenge': 6, 'session_timeout': 5, 'tab_switch': 1,
      'login_attempt': 9, 'timeout': 6, 'network_error': 6
    };

    sequence.states.sort((a, b) => {
      const scoreA = importanceScores[a.action] || 0;
      const scoreB = importanceScores[b.action] || 0;
      return scoreB - scoreA;
    });

    sequence.states = sequence.states.slice(0, targetLength);
  }

  /**
   * Compress using hybrid approach
   */
  private compressByHybrid(sequence: StateSequence, targetLength: number): void {
    // Combine importance and recency
    const now = Date.now();
    const importanceScores: Record<BehavioralActionType, number> = {
      'login_success': 10, 'login_failure': 9, 'logout': 8,
      'error_500': 7, 'error_403': 6, 'error_404': 5,
      'suspicious_activity': 10, 'blocked_request': 8,
      'form_submit': 6, 'api_call': 5, 'search': 4,
      'page_view': 2, 'click': 1, 'scroll': 1,
      'idle': 0, 'active': 1, 'focus_lost': 1, 'focus_gained': 1,
      'page_exit': 3, 'redirect': 2, 'back_button': 2, 'refresh': 2,
      'download': 4, 'upload': 5, 'rate_limit_hit': 7,
      'captcha_challenge': 6, 'session_timeout': 5, 'tab_switch': 1,
      'login_attempt': 9, 'timeout': 6, 'network_error': 6
    };

    sequence.states.sort((a, b) => {
      const importanceA = importanceScores[a.action] || 0;
      const importanceB = importanceScores[b.action] || 0;
      
      const recencyA = Math.max(0, 1 - (now - a.timestamp.getTime()) / (24 * 60 * 60 * 1000));
      const recencyB = Math.max(0, 1 - (now - b.timestamp.getTime()) / (24 * 60 * 60 * 1000));
      
      const scoreA = importanceA * 0.7 + recencyA * 0.3;
      const scoreB = importanceB * 0.7 + recencyB * 0.3;
      
      return scoreB - scoreA;
    });

    sequence.states = sequence.states.slice(0, targetLength);
  }

  /**
   * Get default behavioral state for errors
   */
  private getDefaultState(data: RequestData): BehavioralState {
    return {
      action: 'page_view',
      context: 'normal',
      timestamp: data.timestamp || new Date(),
      metadata: {
        path: data.path,
        method: data.method,
        statusCode: data.statusCode,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        sessionId: data.sessionId,
        userId: data.userId,
        duration: data.duration,
        errorType: 'state_creation_error',
        riskScore: data.riskScore
      }
    };
  }

  /**
   * Get default compression configuration
   */
  private getDefaultCompressionConfig(): StateCompressionConfig {
    return {
      enabled: true,
      compressionRatio: 0.7, // Keep 70% of states
      preserveImportantStates: true,
      importanceThreshold: 5,
      compressionAlgorithm: 'hybrid'
    };
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    // Rough estimation in bytes
    let totalMemory = 0;
    
    for (const sequence of this.stateHistory.values()) {
      totalMemory += sequence.states.length * 500; // ~500 bytes per state
      totalMemory += 200; // Sequence metadata
    }
    
    return totalMemory;
  }
}
