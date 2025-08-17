import { logger } from '@/utils/logger';
import { RedisService } from './RedisService';
import * as tf from '@tensorflow/tfjs';

export interface LearningConfig {
  enabled: boolean;
  retrainInterval: number; // minutes
  minDataPoints: number;
  learningRate: number;
  batchSize: number;
  epochs: number;
}

export interface TrainingData {
  features: number[];
  label: number;
  timestamp: Date;
  source: string;
  confidence: number;
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  lastUpdated: Date;
}

export class AdaptiveLearningService {
  private redisService: RedisService;
  private config: LearningConfig;
  private trainingData: TrainingData[] = [];
  private modelPerformance: ModelPerformance;
  private isTraining: boolean = false;
  private lastRetrain: Date | null = null;

  constructor(redisService: RedisService, config: LearningConfig) {
    this.redisService = redisService;
    this.config = config;
    this.modelPerformance = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      falsePositiveRate: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Initialize adaptive learning service
   */
  public async initialize(): Promise<void> {
    try {
      if (!this.config.enabled) {
        logger.info('Adaptive learning service disabled');
        return;
      }

      await this.loadTrainingData();
      await this.loadModelPerformance();
      
      // Start periodic retraining
      this.startPeriodicRetraining();
      
      logger.info('Adaptive learning service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize adaptive learning service:', error);
      throw error;
    }
  }

  /**
   * Add training data point
   */
  public async addTrainingData(data: TrainingData): Promise<void> {
    try {
      this.trainingData.push(data);
      
      // Store in Redis for persistence
      await this.storeTrainingData(data);
      
      // Check if we have enough data for retraining
      if (this.trainingData.length >= this.config.minDataPoints) {
        await this.checkRetrainNeeded();
      }
    } catch (error) {
      logger.error('Failed to add training data:', error);
    }
  }

  /**
   * Store training data in Redis
   */
  private async storeTrainingData(data: TrainingData): Promise<void> {
    try {
      const key = `training:data:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.redisService.set(key, JSON.stringify(data), 604800); // 7 days
      
      // Add to training data list
      await this.redisService.lpush('training:data_list', key);
      await this.redisService.ltrim('training:data_list', 0, 9999); // Keep last 10000 data points
    } catch (error) {
      logger.error('Failed to store training data:', error);
    }
  }

  /**
   * Load training data from Redis
   */
  private async loadTrainingData(): Promise<void> {
    try {
      const dataKeys = await this.redisService.lrange('training:data_list', 0, -1);
      
      for (const key of dataKeys) {
        const data = await this.redisService.get(key);
        if (data) {
          const trainingData = JSON.parse(data) as TrainingData;
          this.trainingData.push(trainingData);
        }
      }
      
      logger.info(`Loaded ${this.trainingData.length} training data points`);
    } catch (error) {
      logger.error('Failed to load training data:', error);
    }
  }

  /**
   * Load model performance from Redis
   */
  private async loadModelPerformance(): Promise<void> {
    try {
      const performance = await this.redisService.get('model:performance');
      if (performance) {
        this.modelPerformance = JSON.parse(performance);
      }
    } catch (error) {
      logger.error('Failed to load model performance:', error);
    }
  }

  /**
   * Check if retraining is needed
   */
  private async checkRetrainNeeded(): Promise<void> {
    if (this.isTraining) {
      return;
    }

    const now = new Date();
    const timeSinceLastRetrain = this.lastRetrain 
      ? (now.getTime() - this.lastRetrain.getTime()) / (1000 * 60) // minutes
      : Infinity;

    if (timeSinceLastRetrain >= this.config.retrainInterval) {
      await this.retrainModel();
    }
  }

  /**
   * Retrain the model
   */
  public async retrainModel(): Promise<void> {
    if (this.isTraining) {
      logger.info('Model training already in progress');
      return;
    }

    if (this.trainingData.length < this.config.minDataPoints) {
      logger.info(`Not enough training data. Need ${this.config.minDataPoints}, have ${this.trainingData.length}`);
      return;
    }

    this.isTraining = true;
    
    try {
      logger.info('Starting model retraining...');
      
      // Prepare training data
      const { features, labels } = this.prepareTrainingData();
      
      // Create and train model
      const model = await this.createAndTrainModel(features, labels);
      
      // Evaluate model performance
      const performance = await this.evaluateModel(model, features, labels);
      
      // Update performance metrics
      this.modelPerformance = performance;
      await this.saveModelPerformance();
      
      // Save model
      await this.saveModel(model);
      
      this.lastRetrain = new Date();
      
      logger.info('Model retraining completed successfully', performance);
    } catch (error) {
      logger.error('Model retraining failed:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Prepare training data for model
   */
  private prepareTrainingData(): { features: number[][], labels: number[] } {
    const features: number[][] = [];
    const labels: number[] = [];

    for (const data of this.trainingData) {
      features.push(data.features);
      labels.push(data.label);
    }

    return { features, labels };
  }

  /**
   * Create and train model
   */
  private async createAndTrainModel(features: number[][], labels: number[]): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          inputShape: [features[0].length]
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
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    await model.fit(xs, ys, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationSplit: 0.2,
      verbose: 0
    });

    // Clean up tensors
    xs.dispose();
    ys.dispose();

    return model;
  }

  /**
   * Evaluate model performance
   */
  private async evaluateModel(
    model: tf.LayersModel,
    features: number[][],
    labels: number[]
  ): Promise<ModelPerformance> {
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    const predictions = model.predict(xs) as tf.Tensor;
    const predictionData = await predictions.data();
    const labelData = await ys.data();

    // Calculate metrics
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (let i = 0; i < predictionData.length; i++) {
      const predicted = predictionData[i] > 0.5 ? 1 : 0;
      const actual = labelData[i];

      if (predicted === 1 && actual === 1) truePositives++;
      else if (predicted === 1 && actual === 0) falsePositives++;
      else if (predicted === 0 && actual === 0) trueNegatives++;
      else if (predicted === 0 && actual === 1) falseNegatives++;
    }

    const accuracy = (truePositives + trueNegatives) / (truePositives + trueNegatives + falsePositives + falseNegatives);
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const falsePositiveRate = falsePositives / (falsePositives + trueNegatives) || 0;

    // Clean up tensors
    xs.dispose();
    ys.dispose();
    predictions.dispose();

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      lastUpdated: new Date()
    };
  }

  /**
   * Save model performance
   */
  private async saveModelPerformance(): Promise<void> {
    try {
      await this.redisService.set('model:performance', JSON.stringify(this.modelPerformance));
    } catch (error) {
      logger.error('Failed to save model performance:', error);
    }
  }

  /**
   * Save model
   */
  private async saveModel(model: tf.LayersModel): Promise<void> {
    try {
      await model.save('file://./models/adaptive-learning-model');
      logger.info('Model saved successfully');
    } catch (error) {
      logger.error('Failed to save model:', error);
    }
  }

  /**
   * Start periodic retraining
   */
  private startPeriodicRetraining(): void {
    setInterval(async () => {
      await this.checkRetrainNeeded();
    }, 60000); // Check every minute
  }

  /**
   * Get model performance
   */
  public getModelPerformance(): ModelPerformance {
    return { ...this.modelPerformance };
  }

  /**
   * Get training data statistics
   */
  public getTrainingDataStats(): any {
    return {
      totalDataPoints: this.trainingData.length,
      lastRetrain: this.lastRetrain,
      isTraining: this.isTraining,
      minDataPoints: this.config.minDataPoints
    };
  }

  /**
   * Clear old training data
   */
  public async clearOldTrainingData(daysOld: number = 7): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      this.trainingData = this.trainingData.filter(data => 
        data.timestamp.getTime() > cutoffTime
      );
      
      logger.info(`Cleared training data older than ${daysOld} days`);
    } catch (error) {
      logger.error('Failed to clear old training data:', error);
    }
  }
}
