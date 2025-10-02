import * as tf from '@tensorflow/tfjs';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { BehavioralAnalyzer } from './BehavioralAnalyzer';
import { StatisticalAnalyzer } from './StatisticalAnalyzer';
import { RelationshipAnalyzer } from './RelationshipAnalyzer';
import { RiskScoringEngine } from './RiskScoringEngine';
import { ThreatScore } from '@/models/ThreatScore';
import { RedisService } from '@/services/RedisService';
import { RiskContext, ContextualRiskScore, RiskScoringConfig } from '@/types/risk';
import { ResponseEngine } from '@/core/response/ResponseEngine';
import { ResponseExecutionResult } from '@/types/response';

export interface ThreatAssessment {
  threatScore: number;  
  confidence: number;
  threatType: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  sessionId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  // Enhanced with contextual risk scoring
  contextualRisk?: ContextualRiskScore;
  riskContext?: RiskContext;
  scoringBreakdown?: {
    behavioral: number;
    statistical: number;
    relationship: number;
    contextualAdjustment: number;
  };
  // Graduated response system
  responseExecution?: ResponseExecutionResult;
}

export interface DetectionMetrics {
  totalRequests: number;
  threatsDetected: number;
  falsePositives: number;
  averageResponseTime: number;
  accuracy: number;
}

export class ThreatDetectionEngine {
  private behavioralAnalyzer: BehavioralAnalyzer;
  private statisticalAnalyzer: StatisticalAnalyzer;
  private relationshipAnalyzer: RelationshipAnalyzer;
  private riskScoringEngine: RiskScoringEngine;
  private responseEngine: ResponseEngine;
  private mlModel: tf.LayersModel | null = null;
  private detectionMetrics: DetectionMetrics;
  private isModelLoaded: boolean = false;

  constructor(redisService?: RedisService, riskScoringConfig?: RiskScoringConfig) {
    this.behavioralAnalyzer = new BehavioralAnalyzer();
    this.statisticalAnalyzer = new StatisticalAnalyzer();
    this.relationshipAnalyzer = new RelationshipAnalyzer();
    
    // Initialize risk scoring engine with default config if not provided
    const defaultConfig: RiskScoringConfig = this.getDefaultRiskScoringConfig();
    const redisServiceInstance = redisService || new (require('@/services/RedisService').RedisService)();
    this.riskScoringEngine = new RiskScoringEngine(
      redisServiceInstance,
      riskScoringConfig || defaultConfig
    );
    
    // Initialize response engine
    const responseConfig = require('@/config/responseConfig').getResponseConfiguration();
    this.responseEngine = new ResponseEngine(responseConfig, redisServiceInstance);
    
    this.detectionMetrics = {
      totalRequests: 0,
      threatsDetected: 0,
      falsePositives: 0,
      averageResponseTime: 0,
      accuracy: 0
    };
    this.initializeModel();
  }

  /**
   * Get default risk scoring configuration
   */
  private getDefaultRiskScoringConfig(): RiskScoringConfig {
    return {
      weights: {
        behavioral: 0.4,
        statistical: 0.3,
        relationship: 0.3,
        contextMultipliers: {
          temporal: {
            offHours: 1.2,
            weekend: 1.1,
            highFrequency: 1.5,
            nightTime: 1.3
          },
          geographic: {
            highRiskCountry: 1.4,
            vpnUsage: 1.3,
            proxyUsage: 1.2,
            torUsage: 1.8,
            unknownLocation: 1.1
          },
          behavioral: {
            newUser: 1.1,
            suspiciousUser: 1.6,
            botLikeBehavior: 1.8,
            rapidNavigation: 1.3,
            inconsistentDevice: 1.2
          },
          session: {
            unauthenticated: 1.2,
            shortSession: 1.1,
            highErrorRate: 1.4,
            privilegedAccount: 0.9,
            anonymousSession: 1.3
          },
          network: {
            knownThreat: 2.0,
            datacenterOrigin: 1.2,
            poorReputation: 1.5,
            newInfrastructure: 1.1
          }
        }
      },
      thresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.85
      },
      contextSensitivity: 0.7,
      confidenceThreshold: 0.5,
      adaptiveLearning: true
    };
  }

  /**
   * Initialize the machine learning model for threat detection
   */
  private async initializeModel(): Promise<void> {
    try {
      // Load pre-trained model or create a new one
      this.mlModel = await this.loadOrCreateModel();
      this.isModelLoaded = true;
      logger.info('Threat detection ML model initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ML model:', error);
      this.isModelLoaded = false;
    }
  }

  /**
   * Load existing model or create a new one
   */
  private async loadOrCreateModel(): Promise<tf.LayersModel> {
    try {
      // Try to load existing model
      const model = await tf.loadLayersModel('file://./models/threat-detection-model/model.json');
      logger.info('Loaded existing threat detection model');
      return model;
    } catch (error) {
      // Create new model if none exists
      logger.info('Creating new threat detection model');
      return this.createNewModel();
    }
  }

  /**
   * Create a new neural network model for threat detection
   */
  private createNewModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          inputShape: [20] // Input features: behavioral + statistical + relationship
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Main threat detection method that combines all analysis perspectives
   */
  public async detectThreats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<ThreatAssessment> {
    const startTime = Date.now();
    
    try {
      // Extract request data
      const requestData = this.extractRequestData(req);
      
      // Perform multi-perspective analysis
      const behavioralScore = await this.behavioralAnalyzer.analyze(requestData);
      const statisticalScore = await this.statisticalAnalyzer.analyze(requestData);
      const relationshipScore = await this.relationshipAnalyzer.analyze(requestData);
      
      // Use enhanced risk scoring with context
      const contextualRisk = await this.riskScoringEngine.calculateContextualRisk(
        {
          behavioral: behavioralScore,
          statistical: statisticalScore,
          relationship: relationshipScore
        },
        requestData
      );
      
      // Generate enhanced threat assessment
      const assessment = this.generateEnhancedThreatAssessment(
        contextualRisk,
        requestData,
        startTime,
        {
          behavioral: behavioralScore,
          statistical: statisticalScore,
          relationship: relationshipScore
        }
      );
      
      // Update metrics
      this.updateMetrics(assessment, Date.now() - startTime);
      
      // Execute graduated response based on risk score
      const responseExecution = await this.responseEngine.executeResponse(
        req,
        res,
        contextualRisk.contextualScore,
        assessment.sessionId,
        assessment.userId
      );
      
      // Add response execution to assessment
      assessment.responseExecution = responseExecution;
      
      // Log threat if detected
      if (assessment.threatScore > 0.7) {
        logger.warn('Enhanced threat detected:', {
          threatScore: assessment.threatScore,
          contextualScore: contextualRisk.contextualScore,
          riskLevel: assessment.riskLevel,
          ipAddress: assessment.ipAddress,
          sessionId: assessment.sessionId,
          contributingFactors: contextualRisk.contributing_factors.map(f => f.factor),
          responseActions: responseExecution.actionsExecuted,
          responseSuccess: responseExecution.success
        });
      }
      
      return assessment;
      
    } catch (error) {
      logger.error('Error in threat detection:', error);
      // Return safe default assessment
      return this.getDefaultAssessment(req);
    }
  }

  /**
   * Extract relevant data from the request
   */
  private extractRequestData(req: Request): any {
    return {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || '',
      sessionId: this.generateSessionId(),
      userId: undefined,
      requestPath: req.path,
      requestMethod: req.method,
      headers: req.headers,
      timestamp: new Date(),
      body: req.body,
      query: req.query,
      cookies: req.cookies
    };
  }

  /**
   * Combine analysis scores using machine learning
   */
  private async combineScores(
    behavioralScore: number,
    statisticalScore: number,
    relationshipScore: number
  ): Promise<number> {
    if (!this.isModelLoaded || !this.mlModel) {
      // Fallback to weighted average if ML model is not available
      return this.weightedAverage([behavioralScore, statisticalScore, relationshipScore]);
    }

    try {
      // Prepare input tensor
      const input = tf.tensor2d([
        [
          behavioralScore,
          statisticalScore,
          relationshipScore,
          // Add additional features
          ...this.generateAdditionalFeatures()
        ]
      ]);

      // Get prediction
      const prediction = this.mlModel!.predict(input) as tf.Tensor;
      const score = await prediction.data();
      
      // Clean up tensors
      input.dispose();
      prediction.dispose();
      
      return score[0];
    } catch (error) {
      logger.error('Error in ML prediction:', error);
      return this.weightedAverage([behavioralScore, statisticalScore, relationshipScore]);
    }
  }

  /**
   * Generate additional features for ML model
   */
  private generateAdditionalFeatures(): number[] {
    // Generate 17 additional features (total 20 features)
    return Array.from({ length: 17 }, () => Math.random());
  }

  /**
   * Weighted average fallback method
   */
  private weightedAverage(scores: number[]): number {
    const weights = [0.4, 0.35, 0.25]; // Behavioral, Statistical, Relationship
    return scores.reduce((sum, score, index) => sum + score * weights[index], 0);
  }

  /**
   * Generate comprehensive threat assessment
   */
  private generateThreatAssessment(
    combinedScore: number,
    requestData: any,
    startTime: number
  ): ThreatAssessment {
    const threatScore = Math.min(combinedScore, 1.0);
    const confidence = this.calculateConfidence(threatScore);
    const riskLevel = this.determineRiskLevel(threatScore);
    const threatTypes = this.identifyThreatTypes(threatScore, requestData);
    const recommendations = this.generateRecommendations(threatScore, riskLevel);

    return {
      threatScore,
      confidence,
      threatType: threatTypes,
      recommendations,
      riskLevel,
      timestamp: new Date(),
      sessionId: requestData.sessionId,
      userId: requestData.userId,
      ipAddress: requestData.ipAddress,
      userAgent: requestData.userAgent,
      requestPath: requestData.requestPath,
      requestMethod: requestData.requestMethod
    };
  }

  /**
   * Generate enhanced threat assessment with contextual risk scoring
   */
  private generateEnhancedThreatAssessment(
    contextualRisk: ContextualRiskScore,
    requestData: any,
    startTime: number,
    baseScores: { behavioral: number; statistical: number; relationship: number }
  ): ThreatAssessment {
    return {
      threatScore: contextualRisk.contextualScore,
      confidence: contextualRisk.confidence,
      threatType: this.identifyThreatTypes(contextualRisk.contextualScore, requestData),
      recommendations: contextualRisk.recommendations,
      riskLevel: contextualRisk.riskLevel,
      timestamp: new Date(),
      sessionId: requestData.sessionId,
      userId: requestData.userId,
      ipAddress: requestData.ipAddress,
      userAgent: requestData.userAgent,
      requestPath: requestData.requestPath,
      requestMethod: requestData.requestMethod,
      // Enhanced contextual information
      contextualRisk,
      riskContext: this.riskScoringEngine.getCachedContext(requestData.sessionId) || undefined,
      scoringBreakdown: {
        behavioral: baseScores.behavioral,
        statistical: baseScores.statistical,
        relationship: baseScores.relationship,
        contextualAdjustment: contextualRisk.contextualScore - contextualRisk.baseScore
      }
    };
  }

  /**
   * Calculate confidence level based on threat score
   */
  private calculateConfidence(threatScore: number): number {
    if (threatScore < 0.3) return 0.9;
    if (threatScore < 0.7) return 0.7;
    return 0.95;
  }

  /**
   * Determine risk level based on threat score
   */
  private determineRiskLevel(threatScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (threatScore < 0.3) return 'low';
    if (threatScore < 0.6) return 'medium';
    if (threatScore < 0.8) return 'high';
    return 'critical';
  }

  /**
   * Identify specific threat types
   */
  private identifyThreatTypes(threatScore: number, requestData: any): string[] {
    const threats: string[] = [];
    
    if (threatScore > 0.8) {
      threats.push('malicious_behavior');
    }
    if (threatScore > 0.6) {
      threats.push('suspicious_pattern');
    }
    if (threatScore > 0.4) {
      threats.push('anomaly_detected');
    }
    
    return threats;
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(threatScore: number, riskLevel: string): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'critical') {
      recommendations.push('Immediate blocking recommended');
      recommendations.push('Enable enhanced monitoring');
    } else if (riskLevel === 'high') {
      recommendations.push('Apply rate limiting');
      recommendations.push('Enable CAPTCHA challenge');
    } else if (riskLevel === 'medium') {
      recommendations.push('Monitor closely');
      recommendations.push('Log detailed activity');
    }
    
    return recommendations;
  }

  /**
   * Update detection metrics
   */
  private updateMetrics(assessment: ThreatAssessment, responseTime: number): void {
    this.detectionMetrics.totalRequests++;
    
    if (assessment.threatScore > 0.7) {
      this.detectionMetrics.threatsDetected++;
    }
    
    // Update average response time
    this.detectionMetrics.averageResponseTime = 
      (this.detectionMetrics.averageResponseTime * (this.detectionMetrics.totalRequests - 1) + responseTime) / 
      this.detectionMetrics.totalRequests;
  }

  /**
   * Get default assessment for error cases
   */
  private getDefaultAssessment(req: Request): ThreatAssessment {
    return {
      threatScore: 0.1,
      confidence: 0.5,
      threatType: [],
      recommendations: ['Continue monitoring'],
      riskLevel: 'low',
      timestamp: new Date(),
      sessionId: this.generateSessionId(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || '',
      requestPath: req.path,
      requestMethod: req.method
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get current detection metrics
   */
  public getMetrics(): DetectionMetrics {
    return { ...this.detectionMetrics };
  }

  /**
   * Retrain the ML model with new data
   */
  public async retrainModel(trainingData: any[]): Promise<void> {
    if (!this.mlModel) return;
    
    try {
      // Prepare training data
      const features = trainingData.map(data => data.features);
      const labels = trainingData.map(data => data.label);
      
      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels, [labels.length, 1]);
      
      // Train the model
      await this.mlModel.fit(xs, ys, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2
      });
      
      // Save the model
      await this.mlModel.save('file://./models/threat-detection-model');
      
      // Clean up tensors
      xs.dispose();
      ys.dispose();
      
      logger.info('ML model retrained successfully');
    } catch (error) {
      logger.error('Error retraining ML model:', error);
    }
  }
}
