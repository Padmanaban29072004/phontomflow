// PHANTOM-Flow LZ4 Compression for Performance
// High-speed compression for security data

use std::io::{self, Read, Write};

pub struct Lz4Compressor {
    compression_level: u32,
    block_size: usize,
}

impl Lz4Compressor {
    pub fn new() -> Self {
        Self {
            compression_level: 1,
            block_size: 64 * 1024, // 64KB
        }
    }

    pub fn with_level(level: u32) -> Self {
        Self {
            compression_level: level,
            block_size: 64 * 1024,
        }
    }

    pub fn compress(&self, data: &[u8]) -> Result<Vec<u8>, CompressionError> {
        if data.is_empty() {
            return Ok(Vec::new());
        }

        // Simulate LZ4 compression
        let compressed = self.simple_compress(data);
        Ok(compressed)
    }

    pub fn decompress(&self, data: &[u8]) -> Result<Vec<u8>, CompressionError> {
        if data.is_empty() {
            return Ok(Vec::new());
        }

        // Simulate LZ4 decompression
        let decompressed = self.simple_decompress(data);
        Ok(decompressed)
    }

    fn simple_compress(&self, data: &[u8]) -> Vec<u8> {
        // Simplified compression simulation
        let mut compressed = Vec::with_capacity(data.len());
        
        // Add header
        compressed.extend_from_slice(b"LZ4\x01");
        compressed.extend_from_slice(&(data.len() as u32).to_le_bytes());
        
        // Simple run-length encoding for demonstration
        let mut i = 0;
        while i < data.len() {
            let byte = data[i];
            let mut count = 1;
            
            // Count consecutive identical bytes
            while i + count < data.len() && data[i + count] == byte && count < 255 {
                count += 1;
            }
            
            if count > 3 {
                // Use RLE for sequences of 4 or more
                compressed.push(0xFF); // Escape byte
                compressed.push(count as u8);
                compressed.push(byte);
            } else {
                // Store bytes as-is
                for _ in 0..count {
                    compressed.push(byte);
                }
            }
            
            i += count;
        }
        
        compressed
    }

    fn simple_decompress(&self, data: &[u8]) -> Vec<u8> {
        if data.len() < 8 {
            return Vec::new();
        }
        
        // Check header
        if &data[0..4] != b"LZ4\x01" {
            return Vec::new();
        }
        
        let original_size = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize;
        let mut decompressed = Vec::with_capacity(original_size);
        
        let mut i = 8;
        while i < data.len() {
            if data[i] == 0xFF && i + 2 < data.len() {
                // RLE sequence
                let count = data[i + 1] as usize;
                let byte = data[i + 2];
                
                for _ in 0..count {
                    decompressed.push(byte);
                }
                
                i += 3;
            } else {
                // Regular byte
                decompressed.push(data[i]);
                i += 1;
            }
        }
        
        decompressed
    }

    pub fn compress_stream<R: Read, W: Write>(&self, reader: &mut R, writer: &mut W) -> Result<usize, CompressionError> {
        let mut buffer = vec![0u8; self.block_size];
        let mut total_bytes = 0;
        
        loop {
            let bytes_read = reader.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }
            
            let compressed = self.compress(&buffer[..bytes_read])?;
            writer.write_all(&compressed)?;
            total_bytes += compressed.len();
        }
        
        Ok(total_bytes)
    }

    pub fn get_compression_ratio(&self, original: &[u8], compressed: &[u8]) -> f64 {
        if original.is_empty() {
            return 0.0;
        }
        compressed.len() as f64 / original.len() as f64
    }

    pub fn benchmark(&self, data: &[u8], iterations: usize) -> CompressionBenchmark {
        use std::time::Instant;
        
        let start = Instant::now();
        for _ in 0..iterations {
            let _ = self.compress(data);
        }
        let compression_time = start.elapsed();
        
        let compressed = self.compress(data).unwrap();
        
        let start = Instant::now();
        for _ in 0..iterations {
            let _ = self.decompress(&compressed);
        }
        let decompression_time = start.elapsed();
        
        CompressionBenchmark {
            original_size: data.len(),
            compressed_size: compressed.len(),
            compression_ratio: self.get_compression_ratio(data, &compressed),
            compression_time,
            decompression_time,
            iterations,
        }
    }
}

impl Default for Lz4Compressor {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct CompressionBenchmark {
    pub original_size: usize,
    pub compressed_size: usize,
    pub compression_ratio: f64,
    pub compression_time: std::time::Duration,
    pub decompression_time: std::time::Duration,
    pub iterations: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum CompressionError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    #[error("Compression failed: {0}")]
    CompressionFailed(String),
    #[error("Decompression failed: {0}")]
    DecompressionFailed(String),
    #[error("Invalid data format")]
    InvalidFormat,
}

pub fn compress_data(data: &[u8]) -> Result<Vec<u8>, CompressionError> {
    let compressor = Lz4Compressor::new();
    compressor.compress(data)
}

pub fn decompress_data(data: &[u8]) -> Result<Vec<u8>, CompressionError> {
    let compressor = Lz4Compressor::new();
    compressor.decompress(data)
}
