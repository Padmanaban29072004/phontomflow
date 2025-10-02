import { logger } from '@/utils/logger';
import { 
  HyperLogLogConfig, 
  CardinalityEstimate, 
  HyperLogLogMetrics, 
  HLLPersistenceData,
  HLLRegisters 
} from '@/types/hyperloglog';
import { HLLHashFactory, HLLHashUtils } from './HLLHashFunctions';

/**
 * Sparse register implementation for small cardinalities
 */
class SparseRegisters implements HLLRegisters {
  private registers: Map<number, number> = new Map();
  private precision: number;

  constructor(precision: number) {
    this.precision = precision;
  }

  get(index: number): number {
    return this.registers.get(index) || 0;
  }

  set(index: number, value: number): void {
    if (value > 0) {
      this.registers.set(index, value);
    } else {
      this.registers.delete(index);
    }
  }

  size(): number {
    return 1 << this.precision;
  }

  isSparse(): boolean {
    return true;
  }

  toDense(): number[] {
    const dense = new Array(this.size()).fill(0);
    for (const [index, value] of this.registers) {
      dense[index] = value;
    }
    return dense;
  }

  toSparse(): Map<number, number> {
    return new Map(this.registers);
  }

  memoryUsage(): number {
    // Approximate memory usage: Map overhead + entries
    return 64 + (this.registers.size * 16); // bytes
  }

  shouldConvertToDense(threshold: number = 0.25): boolean {
    const utilization = this.registers.size / this.size();
    return utilization > threshold;
  }
}

/**
 * Dense register implementation for large cardinalities
 */
class DenseRegisters implements HLLRegisters {
  private registers: number[];
  private precision: number;

  constructor(precision: number, initialData?: number[]) {
    this.precision = precision;
    this.registers = initialData || new Array(1 << precision).fill(0);
  }

  get(index: number): number {
    return this.registers[index];
  }

  set(index: number, value: number): void {
    this.registers[index] = value;
  }

  size(): number {
    return this.registers.length;
  }

  isSparse(): boolean {
    return false;
  }

  toDense(): number[] {
    return [...this.registers];
  }

  toSparse(): Map<number, number> {
    const sparse = new Map<number, number>();
    for (let i = 0; i < this.registers.length; i++) {
      if (this.registers[i] > 0) {
        sparse.set(i, this.registers[i]);
      }
    }
    return sparse;
  }

  memoryUsage(): number {
    return this.registers.length * 4; // 4 bytes per register (assuming 32-bit numbers)
  }
}

/**
 * HyperLogLog implementation for cardinality estimation
 */
export class HyperLogLog {
  private config: HyperLogLogConfig;
  private registers: HLLRegisters;
  private hashFunction: (data: string | Buffer) => bigint;
  private metrics: HyperLogLogMetrics;
  private alpha: number; // Bias correction constant

  constructor(config: HyperLogLogConfig) {
    this.config = { ...config };
    this.validateConfig();
    
    this.hashFunction = HLLHashFactory.createHashFunction(config.hashFunction);
    this.registers = config.sparseMode 
      ? new SparseRegisters(config.precision)
      : new DenseRegisters(config.precision);
    
    this.alpha = this.calculateAlpha();
    this.metrics = this.initializeMetrics();

    logger.info('HyperLogLog initialized', {
      precision: this.config.precision,
      hashFunction: this.config.hashFunction,
      sparseMode: this.config.sparseMode,
      expectedError: this.getTheoreticalError()
    });
  }

  /**
   * Add an element to the HyperLogLog
   */
  public add(element: string): void {
    const startTime = process.hrtime.bigint();

    try {
      const hash = this.hashFunction(element);
      const bucket = HLLHashUtils.extractBucket(hash, this.config.precision);
      const leadingZeros = HLLHashUtils.getLeadingZeroCount(hash, this.config.precision);
      
      const currentValue = this.registers.get(bucket);
      if (leadingZeros > currentValue) {
        this.registers.set(bucket, leadingZeros);
      }

      // Check if we should convert from sparse to dense
      if (this.registers.isSparse() && this.shouldConvertToDense()) {
        this.convertToDense();
      }

      this.metrics.totalAdds++;
      
      const endTime = process.hrtime.bigint();
      const addTime = Number(endTime - startTime) / 1000; // microseconds
      this.updateAverageTime('add', addTime);

    } catch (error) {
      logger.error('Error adding element to HyperLogLog:', error);
      throw error;
    }
  }

  /**
   * Get cardinality estimate
   */
  public count(): CardinalityEstimate {
    const startTime = process.hrtime.bigint();

    try {
      let estimate = this.calculateRawEstimate();
      
      // Apply bias correction for small cardinalities
      if (this.config.biasCorrection) {
        estimate = this.applyBiasCorrection(estimate);
      }

      this.metrics.totalQueries++;
      this.metrics.currentCardinality = estimate;
      
      const endTime = process.hrtime.bigint();
      const queryTime = Number(endTime - startTime) / 1000; // microseconds
      this.updateAverageTime('query', queryTime);

      return {
        count: Math.round(estimate),
        precision: this.config.precision,
        errorRate: this.getTheoreticalError(),
        confidence: this.calculateConfidence(estimate),
        isSparse: this.registers.isSparse(),
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Error calculating cardinality estimate:', error);
      throw error;
    }
  }

  /**
   * Merge another HyperLogLog into this one
   */
  public merge(other: HyperLogLog): void {
    if (this.config.precision !== other.config.precision) {
      throw new Error('Cannot merge HyperLogLogs with different precisions');
    }

    // Convert both to dense if either is dense
    if (!this.registers.isSparse() || !other.registers.isSparse()) {
      if (this.registers.isSparse()) this.convertToDense();
      if (other.registers.isSparse()) other.convertToDense();
    }

    const size = this.registers.size();
    for (let i = 0; i < size; i++) {
      const thisValue = this.registers.get(i);
      const otherValue = other.registers.get(i);
      this.registers.set(i, Math.max(thisValue, otherValue));
    }

    this.metrics.totalAdds += other.metrics.totalAdds;
    
    logger.debug('HyperLogLog merge completed', {
      totalAdds: this.metrics.totalAdds
    });
  }

  /**
   * Clear the HyperLogLog
   */
  public clear(): void {
    this.registers = this.config.sparseMode 
      ? new SparseRegisters(this.config.precision)
      : new DenseRegisters(this.config.precision);
    
    this.metrics.totalAdds = 0;
    this.metrics.currentCardinality = 0;
    
    logger.debug('HyperLogLog cleared');
  }

  /**
   * Get current metrics
   */
  public getMetrics(): HyperLogLogMetrics {
    this.metrics.memoryUsage = this.registers.memoryUsage();
    this.metrics.lastUpdated = new Date();
    return { ...this.metrics };
  }

  /**
   * Serialize for persistence
   */
  public serialize(): HLLPersistenceData {
    return {
      config: this.config,
      registers: this.registers.isSparse() ? this.registers.toSparse() : this.registers.toDense(),
      sparseMode: this.registers.isSparse(),
      cardinality: this.metrics.currentCardinality,
      totalAdds: this.metrics.totalAdds,
      lastUpdated: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Deserialize from persistence data
   */
  public static deserialize(data: HLLPersistenceData): HyperLogLog {
    const hll = new HyperLogLog(data.config);
    
    if (data.sparseMode && data.registers instanceof Map) {
      hll.registers = new SparseRegisters(data.config.precision);
      for (const [index, value] of data.registers) {
        hll.registers.set(index, value);
      }
    } else if (Array.isArray(data.registers)) {
      hll.registers = new DenseRegisters(data.config.precision, data.registers);
    }
    
    hll.metrics.totalAdds = data.totalAdds;
    hll.metrics.currentCardinality = data.cardinality;
    
    logger.info('HyperLogLog deserialized', {
      totalAdds: data.totalAdds,
      cardinality: data.cardinality
    });
    
    return hll;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.precision < 4 || this.config.precision > 16) {
      throw new Error('Precision must be between 4 and 16 bits');
    }
    if (this.config.maxMemoryMB <= 0) {
      throw new Error('Max memory must be positive');
    }
  }

  /**
   * Calculate raw cardinality estimate
   */
  private calculateRawEstimate(): number {
    const m = 1 << this.config.precision; // 2^precision
    let sum = 0;

    for (let i = 0; i < m; i++) {
      const registerValue = this.registers.get(i);
      sum += Math.pow(2, -registerValue);
    }

    return this.alpha * m * m / sum;
  }

  /**
   * Apply bias correction for small cardinalities
   */
  private applyBiasCorrection(rawEstimate: number): number {
    const m = 1 << this.config.precision;
    
    // Small range correction
    if (rawEstimate <= 2.5 * m) {
      let zeros = 0;
      for (let i = 0; i < m; i++) {
        if (this.registers.get(i) === 0) {
          zeros++;
        }
      }
      
      if (zeros !== 0) {
        return m * Math.log(m / zeros);
      }
    }
    
    // Large range correction (for very large cardinalities)
    if (rawEstimate <= (1/30) * Math.pow(2, 32)) {
      return rawEstimate;
    } else {
      return -Math.pow(2, 32) * Math.log(1 - rawEstimate / Math.pow(2, 32));
    }
  }

  /**
   * Calculate alpha constant for bias correction
   */
  private calculateAlpha(): number {
    const m = 1 << this.config.precision;
    
    switch (this.config.precision) {
      case 4: return 0.673;
      case 5: return 0.697;
      case 6: return 0.709;
      default: return 0.7213 / (1 + 1.079 / m);
    }
  }

  /**
   * Get theoretical error rate
   */
  private getTheoreticalError(): number {
    const m = 1 << this.config.precision;
    return 1.04 / Math.sqrt(m);
  }

  /**
   * Calculate confidence in the estimate
   */
  private calculateConfidence(estimate: number): number {
    // Confidence decreases for very small or very large estimates
    const m = 1 << this.config.precision;
    const theoreticalError = this.getTheoreticalError();
    
    let confidence = 1 - theoreticalError;
    
    // Reduce confidence for very small estimates
    if (estimate < m * 2.5) {
      confidence *= 0.8;
    }
    
    // Reduce confidence for very large estimates
    if (estimate > Math.pow(2, 30)) {
      confidence *= 0.9;
    }
    
    return Math.max(0.5, Math.min(1, confidence));
  }

  /**
   * Check if sparse registers should be converted to dense
   */
  private shouldConvertToDense(): boolean {
    if (!this.registers.isSparse()) return false;
    
    const sparseRegisters = this.registers as SparseRegisters;
    return sparseRegisters.shouldConvertToDense();
  }

  /**
   * Convert sparse registers to dense
   */
  private convertToDense(): void {
    if (!this.registers.isSparse()) return;
    
    const denseData = this.registers.toDense();
    this.registers = new DenseRegisters(this.config.precision, denseData);
    
    logger.debug('HyperLogLog converted from sparse to dense mode');
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): HyperLogLogMetrics {
    return {
      totalAdds: 0,
      totalQueries: 0,
      currentCardinality: 0,
      memoryUsage: this.registers.memoryUsage(),
      averageAddTime: 0,
      averageQueryTime: 0,
      sparseThreshold: 0.25,
      lastUpdated: new Date()
    };
  }

  /**
   * Update average operation time
   */
  private updateAverageTime(operation: 'add' | 'query', newTime: number): void {
    if (operation === 'add') {
      const totalOps = this.metrics.totalAdds;
      const currentAvg = this.metrics.averageAddTime;
      this.metrics.averageAddTime = ((currentAvg * (totalOps - 1)) + newTime) / totalOps;
    } else {
      const totalOps = this.metrics.totalQueries;
      const currentAvg = this.metrics.averageQueryTime;
      this.metrics.averageQueryTime = ((currentAvg * (totalOps - 1)) + newTime) / totalOps;
    }
  }

  /**
   * Get memory usage in bytes
   */
  public getMemoryUsage(): number {
    return this.registers.memoryUsage();
  }

  /**
   * Check if memory usage is within limits
   */
  public isMemoryUsageHealthy(): boolean {
    const currentUsage = this.getMemoryUsage();
    const limitBytes = this.config.maxMemoryMB * 1024 * 1024;
    return currentUsage <= limitBytes;
  }
}
