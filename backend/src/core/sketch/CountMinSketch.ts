import { logger } from '@/utils/logger';
import { 
  CountMinSketchConfig, 
  FrequencyEstimate, 
  SketchMetrics,
  SketchPersistenceData,
  HashFunction 
} from '@/types/sketch';

/**
 * MurmurHash3 implementation for Count-Min Sketch
 * Provides good distribution and performance for string hashing
 */
class MurmurHash3 {
  private static readonly C1 = 0xcc9e2d51;
  private static readonly C2 = 0x1b873593;
  private static readonly R1 = 15;
  private static readonly R2 = 13;
  private static readonly M = 5;
  private static readonly N = 0xe6546b64;

  public static hash(key: string, seed: number): number {
    const data = Buffer.from(key, 'utf8');
    const length = data.length;
    const nblocks = Math.floor(length / 4);
    let h1 = seed;

    // Process 4-byte blocks
    for (let i = 0; i < nblocks; i++) {
      const k1 = data.readUInt32LE(i * 4);
      
      let k1_rot = ((k1 * this.C1) & 0xffffffff) >>> 0;
      k1_rot = ((k1_rot << this.R1) | (k1_rot >>> (32 - this.R1))) >>> 0;
      k1_rot = ((k1_rot * this.C2) & 0xffffffff) >>> 0;

      h1 ^= k1_rot;
      h1 = ((h1 << this.R2) | (h1 >>> (32 - this.R2))) >>> 0;
      h1 = (((h1 * this.M) & 0xffffffff) + this.N) >>> 0;
    }

    // Process remaining bytes
    const tail = length % 4;
    if (tail > 0) {
      let k1 = 0;
      for (let i = tail - 1; i >= 0; i--) {
        k1 = (k1 << 8) | data[nblocks * 4 + i];
      }
      
      k1 = ((k1 * this.C1) & 0xffffffff) >>> 0;
      k1 = ((k1 << this.R1) | (k1 >>> (32 - this.R1))) >>> 0;
      k1 = ((k1 * this.C2) & 0xffffffff) >>> 0;
      h1 ^= k1;
    }

    // Finalization
    h1 ^= length;
    h1 ^= h1 >>> 16;
    h1 = ((h1 * 0x85ebca6b) & 0xffffffff) >>> 0;
    h1 ^= h1 >>> 13;
    h1 = ((h1 * 0xc2b2ae35) & 0xffffffff) >>> 0;
    h1 ^= h1 >>> 16;

    return h1 >>> 0; // Ensure unsigned 32-bit
  }
}

/**
 * Count-Min Sketch data structure for frequency estimation
 * Provides sub-linear space complexity with probabilistic accuracy guarantees
 */
export class CountMinSketch {
  private matrix!: number[][];
  private config: CountMinSketchConfig;
  private metrics!: SketchMetrics;
  private hashFunctions!: HashFunction[];

  constructor(config: CountMinSketchConfig) {
    this.config = { ...config };
    this.validateConfig();
    this.initializeMatrix();
    this.initializeHashFunctions();
    this.initializeMetrics();

    logger.info('Count-Min Sketch initialized', {
      width: this.config.width,
      depth: this.config.depth,
      errorRate: this.config.errorRate,
      confidence: this.config.confidence,
      memoryUsage: this.getMemoryUsage()
    });
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(): void {
    if (this.config.width <= 0 || this.config.depth <= 0) {
      throw new Error('Width and depth must be positive integers');
    }
    if (this.config.errorRate <= 0 || this.config.errorRate >= 1) {
      throw new Error('Error rate must be between 0 and 1');
    }
    if (this.config.confidence <= 0 || this.config.confidence >= 1) {
      throw new Error('Confidence must be between 0 and 1');
    }
  }

  /**
   * Initialize the sketch matrix with zeros
   */
  private initializeMatrix(): void {
    this.matrix = Array(this.config.depth)
      .fill(null)
      .map(() => Array(this.config.width).fill(0));
  }

  /**
   * Initialize hash functions with different seeds
   */
  private initializeHashFunctions(): void {
    this.hashFunctions = [];
    for (let i = 0; i < this.config.depth; i++) {
      const seed = this.config.hashSeed + i;
      this.hashFunctions.push((item: string, _seed: number, _width: number) => 
        MurmurHash3.hash(item, seed) % this.config.width
      );
    }
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalInserts: 0,
      totalQueries: 0,
      memoryUsage: this.getMemoryUsage(),
      averageInsertTime: 0,
      averageQueryTime: 0,
      errorRate: 0,
      fillRatio: 0
    };
  }

  /**
   * Insert an item into the sketch (increment its frequency)
   */
  public insert(item: string, count: number = 1): void {
    const startTime = process.hrtime.bigint();

    for (let i = 0; i < this.config.depth; i++) {
      const hash = this.hashFunctions[i](item, this.config.hashSeed + i, this.config.width);
      this.matrix[i][hash] += count;
    }

    // Update metrics
    this.metrics.totalInserts++;
    const endTime = process.hrtime.bigint();
    const insertTime = Number(endTime - startTime) / 1000; // Convert to microseconds
    this.updateAverageTime('insert', insertTime);
    this.updateFillRatio();
  }

  /**
   * Query the frequency of an item
   */
  public query(item: string): FrequencyEstimate {
    const startTime = process.hrtime.bigint();

    let minFrequency = Infinity;
    for (let i = 0; i < this.config.depth; i++) {
      const hash = this.hashFunctions[i](item, this.config.hashSeed + i, this.config.width);
      minFrequency = Math.min(minFrequency, this.matrix[i][hash]);
    }

    // Handle case where item was never inserted
    if (minFrequency === Infinity) {
      minFrequency = 0;
    }

    // Update metrics
    this.metrics.totalQueries++;
    const endTime = process.hrtime.bigint();
    const queryTime = Number(endTime - startTime) / 1000; // Convert to microseconds
    this.updateAverageTime('query', queryTime);

    return {
      item,
      frequency: minFrequency,
      confidence: this.config.confidence,
      errorBound: this.calculateErrorBound(),
      timestamp: new Date()
    };
  }

  /**
   * Get multiple frequency estimates efficiently
   */
  public queryBatch(items: string[]): FrequencyEstimate[] {
    return items.map(item => this.query(item));
  }

  /**
   * Calculate the theoretical error bound
   */
  private calculateErrorBound(): number {
    // Error bound = epsilon * total_items
    // where epsilon = e / width
    const epsilon = Math.E / this.config.width;
    return epsilon * this.metrics.totalInserts;
  }

  /**
   * Get the top-k most frequent items (approximate)
   * Note: This is an expensive operation, use sparingly
   */
  public getTopK(k: number, candidates?: string[]): FrequencyEstimate[] {
    if (!candidates) {
      throw new Error('Count-Min Sketch requires candidate items for top-k queries');
    }

    const estimates = this.queryBatch(candidates);
    return estimates
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, k);
  }

  /**
   * Clear the sketch (reset all counters)
   */
  public clear(): void {
    this.initializeMatrix();
    this.metrics.totalInserts = 0;
    this.metrics.fillRatio = 0;
    logger.debug('Count-Min Sketch cleared');
  }

  /**
   * Get current metrics
   */
  public getMetrics(): SketchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get sketch configuration
   */
  public getConfig(): CountMinSketchConfig {
    return { ...this.config };
  }

  /**
   * Calculate memory usage in bytes
   */
  public getMemoryUsage(): number {
    // 4 bytes per integer * width * depth + overhead
    const matrixSize = this.config.width * this.config.depth * 4;
    const overhead = 1024; // Rough estimate for object overhead
    return matrixSize + overhead;
  }

  /**
   * Serialize sketch for persistence
   */
  public serialize(): SketchPersistenceData {
    return {
      config: this.config,
      matrix: this.matrix.map(row => [...row]), // Deep copy
      totalItems: this.metrics.totalInserts,
      lastUpdated: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Deserialize sketch from persistence data
   */
  public static deserialize(data: SketchPersistenceData): CountMinSketch {
    const sketch = new CountMinSketch(data.config);
    sketch.matrix = data.matrix.map(row => [...row]); // Deep copy
    sketch.metrics.totalInserts = data.totalItems;
    sketch.updateFillRatio();
    
    logger.info('Count-Min Sketch deserialized', {
      totalItems: data.totalItems,
      lastUpdated: data.lastUpdated
    });
    
    return sketch;
  }

  /**
   * Merge another sketch into this one (for distributed scenarios)
   */
  public merge(other: CountMinSketch): void {
    if (this.config.width !== other.config.width || 
        this.config.depth !== other.config.depth) {
      throw new Error('Cannot merge sketches with different dimensions');
    }

    for (let i = 0; i < this.config.depth; i++) {
      for (let j = 0; j < this.config.width; j++) {
        this.matrix[i][j] += other.matrix[i][j];
      }
    }

    this.metrics.totalInserts += other.metrics.totalInserts;
    this.updateFillRatio();
    
    logger.debug('Count-Min Sketch merged', {
      totalItems: this.metrics.totalInserts
    });
  }

  /**
   * Update average time metrics
   */
  private updateAverageTime(operation: 'insert' | 'query', newTime: number): void {
    const totalOps = operation === 'insert' ? this.metrics.totalInserts : this.metrics.totalQueries;
    const currentAvg = operation === 'insert' ? this.metrics.averageInsertTime : this.metrics.averageQueryTime;
    
    const newAvg = ((currentAvg * (totalOps - 1)) + newTime) / totalOps;
    
    if (operation === 'insert') {
      this.metrics.averageInsertTime = newAvg;
    } else {
      this.metrics.averageQueryTime = newAvg;
    }
  }

  /**
   * Update fill ratio metric
   */
  private updateFillRatio(): void {
    let nonZeroCount = 0;
    const totalCells = this.config.width * this.config.depth;
    
    for (let i = 0; i < this.config.depth; i++) {
      for (let j = 0; j < this.config.width; j++) {
        if (this.matrix[i][j] > 0) {
          nonZeroCount++;
        }
      }
    }
    
    this.metrics.fillRatio = nonZeroCount / totalCells;
  }

  /**
   * Create optimal sketch configuration based on requirements
   */
  public static createOptimalConfig(
    errorRate: number,
    confidence: number,
    maxMemoryBytes?: number
  ): CountMinSketchConfig {
    // Calculate optimal width: w = ceil(e / epsilon)
    const width = Math.ceil(Math.E / errorRate);
    
    // Calculate optimal depth: d = ceil(ln(1 / delta))
    const depth = Math.ceil(Math.log(1 / (1 - confidence)));
    
    // Check memory constraints
    const estimatedMemory = width * depth * 4;
    if (maxMemoryBytes && estimatedMemory > maxMemoryBytes) {
      // Scale down proportionally
      const scaleFactor = Math.sqrt(maxMemoryBytes / estimatedMemory);
      const scaledWidth = Math.max(1, Math.floor(width * scaleFactor));
      const scaledDepth = Math.max(1, Math.floor(depth * scaleFactor));
      
      logger.warn('Sketch config scaled down due to memory constraints', {
        originalWidth: width,
        originalDepth: depth,
        scaledWidth,
        scaledDepth,
        memoryLimit: maxMemoryBytes
      });
      
      return {
        width: scaledWidth,
        depth: scaledDepth,
        hashSeed: Math.floor(Math.random() * 1000000),
        errorRate: errorRate * (width / scaledWidth),
        confidence: confidence * (depth / scaledDepth)
      };
    }
    
    return {
      width,
      depth,
      hashSeed: Math.floor(Math.random() * 1000000),
      errorRate,
      confidence
    };
  }
}
