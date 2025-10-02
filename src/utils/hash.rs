// PHANTOM-Flow High-Performance Hashing Utilities
// Optimized hash functions for security operations

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use ring::digest;
use blake3::Hasher as Blake3Hasher;

pub struct HashUtils;

impl HashUtils {
    pub fn sha256(data: &[u8]) -> Vec<u8> {
        let digest = digest::digest(&digest::SHA256, data);
        digest.as_ref().to_vec()
    }

    pub fn sha512(data: &[u8]) -> Vec<u8> {
        let digest = digest::digest(&digest::SHA512, data);
        digest.as_ref().to_vec()
    }

    pub fn blake3(data: &[u8]) -> Vec<u8> {
        let mut hasher = Blake3Hasher::new();
        hasher.update(data);
        hasher.finalize().as_bytes().to_vec()
    }

    pub fn fast_hash<T: Hash>(data: &T) -> u64 {
        let mut hasher = DefaultHasher::new();
        data.hash(&mut hasher);
        hasher.finish()
    }

    pub fn verify_sha256(data: &[u8], expected: &[u8]) -> bool {
        let computed = Self::sha256(data);
        computed.as_slice() == expected
    }

    pub fn hash_string(s: &str) -> String {
        let hash = Self::sha256(s.as_bytes());
        hex::encode(hash)
    }

    pub fn secure_compare(a: &[u8], b: &[u8]) -> bool {
        if a.len() != b.len() {
            return false;
        }
        
        let mut result = 0u8;
        for i in 0..a.len() {
            result |= a[i] ^ b[i];
        }
        result == 0
    }
}

pub struct MultiHasher {
    sha256_context: digest::Context,
    blake3_hasher: Blake3Hasher,
}

impl MultiHasher {
    pub fn new() -> Self {
        Self {
            sha256_context: digest::Context::new(&digest::SHA256),
            blake3_hasher: Blake3Hasher::new(),
        }
    }

    pub fn update(&mut self, data: &[u8]) {
        self.sha256_context.update(data);
        self.blake3_hasher.update(data);
    }

    pub fn finalize(self) -> MultiHashResult {
        MultiHashResult {
            sha256: self.sha256_context.finish().as_ref().to_vec(),
            blake3: self.blake3_hasher.finalize().as_bytes().to_vec(),
        }
    }
}

impl Default for MultiHasher {
    fn default() -> Self {
        Self::new()
    }
}

pub struct MultiHashResult {
    pub sha256: Vec<u8>,
    pub blake3: Vec<u8>,
}

pub fn benchmark_hashes(data: &[u8], iterations: usize) -> HashBenchmark {
    use std::time::Instant;

    let start = Instant::now();
    for _ in 0..iterations {
        let _ = HashUtils::sha256(data);
    }
    let sha256_time = start.elapsed();

    let start = Instant::now();
    for _ in 0..iterations {
        let _ = HashUtils::blake3(data);
    }
    let blake3_time = start.elapsed();

    HashBenchmark {
        data_size: data.len(),
        iterations,
        sha256_time,
        blake3_time,
    }
}

pub struct HashBenchmark {
    pub data_size: usize,
    pub iterations: usize,
    pub sha256_time: std::time::Duration,
    pub blake3_time: std::time::Duration,
}
