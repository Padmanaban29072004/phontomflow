import { logger } from '@/utils/logger';
import { HLLHashFunction } from '@/types/hyperloglog';

/**
 * 64-bit MurmurHash3 implementation optimized for HyperLogLog
 * Provides good distribution and performance for cardinality estimation
 */
export class MurmurHash3_64 {
  private static readonly C1 = 0x87c37b91114253d5n;
  private static readonly C2 = 0x4cf5ad432745937fn;
  private static readonly R1 = 31n;
  private static readonly R2 = 27n;
  private static readonly M = 5n;
  private static readonly N1 = 0x52dce729n;
  private static readonly N2 = 0x38495ab5n;

  /**
   * Compute 64-bit MurmurHash3 hash
   */
  public static hash(data: string | Buffer, seed: bigint = 0n): bigint {
    const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const length = BigInt(bytes.length);
    const nblocks = length / 16n;

    let h1 = seed;
    let h2 = seed;

    // Process 16-byte blocks
    for (let i = 0n; i < nblocks; i++) {
      const offset = Number(i * 16n);
      
      let k1 = this.readUInt64LE(bytes, offset);
      let k2 = this.readUInt64LE(bytes, offset + 8);

      // Mix k1
      k1 = this.multiply64(k1, this.C1);
      k1 = this.rotateLeft64(k1, this.R1);
      k1 = this.multiply64(k1, this.C2);
      h1 ^= k1;

      h1 = this.rotateLeft64(h1, this.R2);
      h1 = h1 + h2;
      h1 = this.multiply64(h1, this.M) + this.N1;

      // Mix k2
      k2 = this.multiply64(k2, this.C2);
      k2 = this.rotateLeft64(k2, 33n);
      k2 = this.multiply64(k2, this.C1);
      h2 ^= k2;

      h2 = this.rotateLeft64(h2, this.R1);
      h2 = h2 + h1;
      h2 = this.multiply64(h2, this.M) + this.N2;
    }

    // Process remaining bytes
    const tail = Number(nblocks * 16n);
    const remaining = Number(length % 16n);
    
    let k1 = 0n;
    let k2 = 0n;

    if (remaining >= 15) k2 ^= BigInt(bytes[tail + 14]) << 48n;
    if (remaining >= 14) k2 ^= BigInt(bytes[tail + 13]) << 40n;
    if (remaining >= 13) k2 ^= BigInt(bytes[tail + 12]) << 32n;
    if (remaining >= 12) k2 ^= BigInt(bytes[tail + 11]) << 24n;
    if (remaining >= 11) k2 ^= BigInt(bytes[tail + 10]) << 16n;
    if (remaining >= 10) k2 ^= BigInt(bytes[tail + 9]) << 8n;
    if (remaining >= 9) {
      k2 ^= BigInt(bytes[tail + 8]);
      k2 = this.multiply64(k2, this.C2);
      k2 = this.rotateLeft64(k2, 33n);
      k2 = this.multiply64(k2, this.C1);
      h2 ^= k2;
    }

    if (remaining >= 8) k1 ^= BigInt(bytes[tail + 7]) << 56n;
    if (remaining >= 7) k1 ^= BigInt(bytes[tail + 6]) << 48n;
    if (remaining >= 6) k1 ^= BigInt(bytes[tail + 5]) << 40n;
    if (remaining >= 5) k1 ^= BigInt(bytes[tail + 4]) << 32n;
    if (remaining >= 4) k1 ^= BigInt(bytes[tail + 3]) << 24n;
    if (remaining >= 3) k1 ^= BigInt(bytes[tail + 2]) << 16n;
    if (remaining >= 2) k1 ^= BigInt(bytes[tail + 1]) << 8n;
    if (remaining >= 1) {
      k1 ^= BigInt(bytes[tail]);
      k1 = this.multiply64(k1, this.C1);
      k1 = this.rotateLeft64(k1, this.R1);
      k1 = this.multiply64(k1, this.C2);
      h1 ^= k1;
    }

    // Finalization
    h1 ^= length;
    h2 ^= length;

    h1 = h1 + h2;
    h2 = h2 + h1;

    h1 = this.fmix64(h1);
    h2 = this.fmix64(h2);

    h1 = h1 + h2;
    h2 = h2 + h1;

    return h1; // Return first 64 bits
  }

  private static readUInt64LE(buffer: Buffer, offset: number): bigint {
    const low = buffer.readUInt32LE(offset);
    const high = buffer.readUInt32LE(offset + 4);
    return (BigInt(high) << 32n) | BigInt(low);
  }

  private static multiply64(a: bigint, b: bigint): bigint {
    return (a * b) & 0xFFFFFFFFFFFFFFFFn;
  }

  private static rotateLeft64(value: bigint, shift: bigint): bigint {
    return ((value << shift) | (value >> (64n - shift))) & 0xFFFFFFFFFFFFFFFFn;
  }

  private static fmix64(k: bigint): bigint {
    k ^= k >> 33n;
    k = this.multiply64(k, 0xff51afd7ed558ccdn);
    k ^= k >> 33n;
    k = this.multiply64(k, 0xc4ceb9fe1a85ec53n);
    k ^= k >> 33n;
    return k;
  }
}

/**
 * FNV-1a hash function (simpler alternative)
 */
export class FNV1aHash {
  private static readonly FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  private static readonly FNV_PRIME = 0x100000001b3n;

  public static hash(data: string | Buffer): bigint {
    const bytes = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    let hash = this.FNV_OFFSET_BASIS;

    for (let i = 0; i < bytes.length; i++) {
      hash ^= BigInt(bytes[i]);
      hash = (hash * this.FNV_PRIME) & 0xFFFFFFFFFFFFFFFFn;
    }

    return hash;
  }
}

/**
 * Hash function utilities for HyperLogLog
 */
export class HLLHashUtils {
  /**
   * Count leading zeros in a 64-bit integer
   */
  public static countLeadingZeros(value: bigint, maxBits: number = 64): number {
    if (value === 0n) return maxBits;
    
    let count = 0;
    let mask = 1n << BigInt(maxBits - 1);
    
    while ((value & mask) === 0n && count < maxBits) {
      count++;
      mask >>= 1n;
    }
    
    return count;
  }

  /**
   * Extract the first b bits from a hash value
   */
  public static extractBucket(hash: bigint, precision: number): number {
    const mask = (1n << BigInt(precision)) - 1n;
    return Number(hash & mask);
  }

  /**
   * Extract the remaining bits after bucket extraction
   */
  public static extractValue(hash: bigint, precision: number): bigint {
    return hash >> BigInt(precision);
  }

  /**
   * Calculate the number of leading zeros in the value part
   */
  public static getLeadingZeroCount(hash: bigint, precision: number): number {
    const value = this.extractValue(hash, precision);
    const remainingBits = 64 - precision;
    
    if (value === 0n) return remainingBits + 1;
    
    return this.countLeadingZeros(value, remainingBits) + 1;
  }

  /**
   * Validate hash function output
   */
  public static validateHashDistribution(
    hashFunction: HLLHashFunction,
    samples: string[],
    expectedUniformity: number = 0.95
  ): {
    isUniform: boolean;
    uniformityScore: number;
    collisionRate: number;
    recommendations: string[];
  } {
    if (samples.length < 1000) {
      return {
        isUniform: false,
        uniformityScore: 0,
        collisionRate: 0,
        recommendations: ['Need at least 1000 samples for reliable distribution analysis']
      };
    }

    const hashes = samples.map(s => hashFunction(s));
    const uniqueHashes = new Set(hashes.map(h => h.toString()));
    
    const collisionRate = 1 - (uniqueHashes.size / hashes.length);
    
    // Simple uniformity test: check distribution across buckets
    const buckets = new Array(1024).fill(0);
    hashes.forEach(hash => {
      const bucket = Number(hash & 0x3FFn); // Last 10 bits
      buckets[bucket]++;
    });
    
    const expectedPerBucket = hashes.length / buckets.length;
    const variance = buckets.reduce((sum, count) => {
      return sum + Math.pow(count - expectedPerBucket, 2);
    }, 0) / buckets.length;
    
    const uniformityScore = Math.max(0, 1 - (variance / (expectedPerBucket * expectedPerBucket)));
    
    const recommendations: string[] = [];
    if (uniformityScore < expectedUniformity) {
      recommendations.push('Hash function shows poor uniformity - consider using a different hash');
    }
    if (collisionRate > 0.01) {
      recommendations.push('High collision rate detected - hash function may be unsuitable');
    }
    if (uniformityScore >= expectedUniformity && collisionRate <= 0.01) {
      recommendations.push('Hash function shows good distribution characteristics');
    }

    return {
      isUniform: uniformityScore >= expectedUniformity,
      uniformityScore,
      collisionRate,
      recommendations
    };
  }
}

/**
 * Factory for creating hash functions
 */
export class HLLHashFactory {
  /**
   * Create a hash function based on the specified type
   */
  public static createHashFunction(type: 'murmur3' | 'xxhash' | 'fnv1a'): HLLHashFunction {
    switch (type) {
      case 'murmur3':
        return (data: string | Buffer) => MurmurHash3_64.hash(data);
      
      case 'fnv1a':
        return (data: string | Buffer) => FNV1aHash.hash(data);
      
      case 'xxhash':
        // For now, fallback to MurmurHash3
        // In production, you might want to use a dedicated xxhash library
        logger.warn('xxhash not implemented, falling back to MurmurHash3');
        return (data: string | Buffer) => MurmurHash3_64.hash(data);
      
      default:
        throw new Error(`Unsupported hash function type: ${type}`);
    }
  }

  /**
   * Get the recommended hash function for HyperLogLog
   */
  public static getRecommended(): HLLHashFunction {
    return this.createHashFunction('murmur3');
  }

  /**
   * Test hash function performance
   */
  public static benchmarkHashFunction(
    hashFunction: HLLHashFunction,
    testData: string[],
    iterations: number = 1
  ): {
    avgTimePerHash: number; // microseconds
    hashesPerSecond: number;
    totalTime: number; // milliseconds
  } {
    const startTime = process.hrtime.bigint();
    
    for (let i = 0; i < iterations; i++) {
      for (const data of testData) {
        hashFunction(data);
      }
    }
    
    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const totalHashes = testData.length * iterations;
    const avgTimePerHash = (totalTime * 1000) / totalHashes; // Convert to microseconds
    const hashesPerSecond = totalHashes / (totalTime / 1000);
    
    return {
      avgTimePerHash,
      hashesPerSecond,
      totalTime
    };
  }
}
