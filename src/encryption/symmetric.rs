// PHANTOM-Flow Symmetric Encryption Engine
// High-performance symmetric encryption for data protection

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, NewAead};
use chacha20poly1305::{ChaCha20Poly1305, Key as ChaChaKey, Nonce as ChaChaNonce};
use chacha20poly1305::aead::{Aead as ChaChaAead, NewAead as ChaChaNewAead};
use rand::{Rng, RngCore};
use rand::rngs::OsRng;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymmetricEngine {
    algorithms: HashMap<EncryptionAlgorithm, Box<dyn EncryptionAlgoTrait + Send + Sync>>,
    default_algorithm: EncryptionAlgorithm,
    key_derivation: KeyDerivationConfig,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EncryptionAlgorithm {
    AES256GCM,
    ChaCha20Poly1305,
    AES128GCM,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyDerivationConfig {
    pub algorithm: KdfAlgorithm,
    pub iterations: u32,
    pub salt_length: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KdfAlgorithm {
    PBKDF2,
    Argon2,
    Scrypt,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub algorithm: EncryptionAlgorithm,
    pub key_id: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionResult {
    pub plaintext: Vec<u8>,
    pub algorithm: EncryptionAlgorithm,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyInfo {
    pub id: String,
    pub algorithm: EncryptionAlgorithm,
    pub created_at: u64,
    pub key_length: usize,
    pub metadata: HashMap<String, String>,
}

pub trait EncryptionAlgoTrait {
    fn encrypt(&self, plaintext: &[u8], key: &[u8]) -> Result<EncryptionResult, EncryptionError>;
    fn decrypt(&self, ciphertext: &[u8], key: &[u8], nonce: &[u8]) -> Result<DecryptionResult, EncryptionError>;
    fn get_key_length(&self) -> usize;
    fn get_nonce_length(&self) -> usize;
    fn get_algorithm(&self) -> EncryptionAlgorithm;
}

pub struct Aes256GcmImpl;

impl EncryptionAlgoTrait for Aes256GcmImpl {
    fn encrypt(&self, plaintext: &[u8], key: &[u8]) -> Result<EncryptionResult, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::InvalidKeyLength);
        }

        let cipher = Aes256Gcm::new(Key::from_slice(key));
        let nonce_bytes = self.generate_nonce();
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, plaintext)
            .map_err(|_| EncryptionError::EncryptionFailed)?;

        Ok(EncryptionResult {
            ciphertext,
            nonce: nonce_bytes,
            algorithm: EncryptionAlgorithm::AES256GCM,
            key_id: None,
            metadata: HashMap::new(),
        })
    }

    fn decrypt(&self, ciphertext: &[u8], key: &[u8], nonce: &[u8]) -> Result<DecryptionResult, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::InvalidKeyLength);
        }

        if nonce.len() != 12 {
            return Err(EncryptionError::InvalidNonceLength);
        }

        let cipher = Aes256Gcm::new(Key::from_slice(key));
        let nonce = Nonce::from_slice(nonce);

        match cipher.decrypt(nonce, ciphertext) {
            Ok(plaintext) => Ok(DecryptionResult {
                plaintext,
                algorithm: EncryptionAlgorithm::AES256GCM,
                success: true,
                error: None,
            }),
            Err(_) => Ok(DecryptionResult {
                plaintext: Vec::new(),
                algorithm: EncryptionAlgorithm::AES256GCM,
                success: false,
                error: Some("Decryption failed".to_string()),
            }),
        }
    }

    fn get_key_length(&self) -> usize {
        32
    }

    fn get_nonce_length(&self) -> usize {
        12
    }

    fn get_algorithm(&self) -> EncryptionAlgorithm {
        EncryptionAlgorithm::AES256GCM
    }
}

impl Aes256GcmImpl {
    fn generate_nonce(&self) -> Vec<u8> {
        let mut nonce = vec![0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        nonce
    }
}

pub struct ChaCha20Poly1305Impl;

impl EncryptionAlgoTrait for ChaCha20Poly1305Impl {
    fn encrypt(&self, plaintext: &[u8], key: &[u8]) -> Result<EncryptionResult, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::InvalidKeyLength);
        }

        let cipher = ChaCha20Poly1305::new(ChaChaKey::from_slice(key));
        let nonce_bytes = self.generate_nonce();
        let nonce = ChaChaNonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, plaintext)
            .map_err(|_| EncryptionError::EncryptionFailed)?;

        Ok(EncryptionResult {
            ciphertext,
            nonce: nonce_bytes,
            algorithm: EncryptionAlgorithm::ChaCha20Poly1305,
            key_id: None,
            metadata: HashMap::new(),
        })
    }

    fn decrypt(&self, ciphertext: &[u8], key: &[u8], nonce: &[u8]) -> Result<DecryptionResult, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::InvalidKeyLength);
        }

        if nonce.len() != 12 {
            return Err(EncryptionError::InvalidNonceLength);
        }

        let cipher = ChaCha20Poly1305::new(ChaChaKey::from_slice(key));
        let nonce = ChaChaNonce::from_slice(nonce);

        match cipher.decrypt(nonce, ciphertext) {
            Ok(plaintext) => Ok(DecryptionResult {
                plaintext,
                algorithm: EncryptionAlgorithm::ChaCha20Poly1305,
                success: true,
                error: None,
            }),
            Err(_) => Ok(DecryptionResult {
                plaintext: Vec::new(),
                algorithm: EncryptionAlgorithm::ChaCha20Poly1305,
                success: false,
                error: Some("Decryption failed".to_string()),
            }),
        }
    }

    fn get_key_length(&self) -> usize {
        32
    }

    fn get_nonce_length(&self) -> usize {
        12
    }

    fn get_algorithm(&self) -> EncryptionAlgorithm {
        EncryptionAlgorithm::ChaCha20Poly1305
    }
}

impl ChaCha20Poly1305Impl {
    fn generate_nonce(&self) -> Vec<u8> {
        let mut nonce = vec![0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        nonce
    }
}

impl SymmetricEngine {
    pub fn new(config: KeyDerivationConfig) -> Self {
        let mut algorithms: HashMap<EncryptionAlgorithm, Box<dyn EncryptionAlgoTrait + Send + Sync>> = HashMap::new();
        
        algorithms.insert(EncryptionAlgorithm::AES256GCM, Box::new(Aes256GcmImpl));
        algorithms.insert(EncryptionAlgorithm::ChaCha20Poly1305, Box::new(ChaCha20Poly1305Impl));

        Self {
            algorithms,
            default_algorithm: EncryptionAlgorithm::AES256GCM,
            key_derivation: config,
        }
    }

    pub fn encrypt(&self, plaintext: &[u8], key: &[u8], algorithm: Option<EncryptionAlgorithm>) -> Result<EncryptionResult, EncryptionError> {
        let algo = algorithm.unwrap_or(self.default_algorithm);
        
        let encryption_algo = self.algorithms.get(&algo)
            .ok_or(EncryptionError::UnsupportedAlgorithm)?;

        encryption_algo.encrypt(plaintext, key)
    }

    pub fn decrypt(&self, ciphertext: &[u8], key: &[u8], nonce: &[u8], algorithm: EncryptionAlgorithm) -> Result<DecryptionResult, EncryptionError> {
        let encryption_algo = self.algorithms.get(&algorithm)
            .ok_or(EncryptionError::UnsupportedAlgorithm)?;

        encryption_algo.decrypt(ciphertext, key, nonce)
    }

    pub fn generate_key(&self, algorithm: EncryptionAlgorithm) -> Result<Vec<u8>, EncryptionError> {
        let encryption_algo = self.algorithms.get(&algorithm)
            .ok_or(EncryptionError::UnsupportedAlgorithm)?;

        let key_length = encryption_algo.get_key_length();
        let mut key = vec![0u8; key_length];
        OsRng.fill_bytes(&mut key);
        Ok(key)
    }

    pub fn derive_key(&self, password: &[u8], salt: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        match self.key_derivation.algorithm {
            KdfAlgorithm::PBKDF2 => self.derive_key_pbkdf2(password, salt),
            KdfAlgorithm::Argon2 => self.derive_key_argon2(password, salt),
            KdfAlgorithm::Scrypt => self.derive_key_scrypt(password, salt),
        }
    }

    fn derive_key_pbkdf2(&self, password: &[u8], salt: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        use pbkdf2::{pbkdf2_hmac, Algorithm};
        use sha2::Sha256;

        let mut key = vec![0u8; 32];
        pbkdf2_hmac::<Sha256>(password, salt, self.key_derivation.iterations, &mut key);
        Ok(key)
    }

    fn derive_key_argon2(&self, password: &[u8], salt: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        use argon2::{Argon2, Algorithm, Params, Version};

        let params = Params::new(4096, 3, 1, Some(32))
            .map_err(|_| EncryptionError::KeyDerivationFailed)?;

        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let mut key = vec![0u8; 32];
        
        argon2.hash_password_into(password, salt, &mut key)
            .map_err(|_| EncryptionError::KeyDerivationFailed)?;

        Ok(key)
    }

    fn derive_key_scrypt(&self, password: &[u8], salt: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        use scrypt::{scrypt, Params};

        let params = Params::new(14, 8, 1, 32)
            .map_err(|_| EncryptionError::KeyDerivationFailed)?;

        let mut key = vec![0u8; 32];
        scrypt(password, salt, &params, &mut key)
            .map_err(|_| EncryptionError::KeyDerivationFailed)?;

        Ok(key)
    }

    pub fn generate_salt(&self) -> Vec<u8> {
        let mut salt = vec![0u8; self.key_derivation.salt_length];
        OsRng.fill_bytes(&mut salt);
        salt
    }

    pub fn get_supported_algorithms(&self) -> Vec<EncryptionAlgorithm> {
        self.algorithms.keys().cloned().collect()
    }

    pub fn benchmark_algorithm(&self, algorithm: EncryptionAlgorithm, data_sizes: &[usize]) -> AlgorithmBenchmark {
        let encryption_algo = match self.algorithms.get(&algorithm) {
            Some(algo) => algo,
            None => return AlgorithmBenchmark::default(),
        };

        let mut results = Vec::new();

        for &size in data_sizes {
            let data = vec![0u8; size];
            let key = self.generate_key(algorithm).unwrap();

            // Benchmark encryption
            let start = std::time::Instant::now();
            let _ = encryption_algo.encrypt(&data, &key);
            let encrypt_time = start.elapsed();

            // Benchmark decryption
            let encrypted = encryption_algo.encrypt(&data, &key).unwrap();
            let start = std::time::Instant::now();
            let _ = encryption_algo.decrypt(&encrypted.ciphertext, &key, &encrypted.nonce);
            let decrypt_time = start.elapsed();

            results.push(SizeBenchmark {
                data_size: size,
                encrypt_time,
                decrypt_time,
                throughput_mbps: (size as f64 / 1024.0 / 1024.0) / encrypt_time.as_secs_f64(),
            });
        }

        AlgorithmBenchmark {
            algorithm,
            results,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlgorithmBenchmark {
    pub algorithm: EncryptionAlgorithm,
    pub results: Vec<SizeBenchmark>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeBenchmark {
    pub data_size: usize,
    pub encrypt_time: std::time::Duration,
    pub decrypt_time: std::time::Duration,
    pub throughput_mbps: f64,
}

impl Default for AlgorithmBenchmark {
    fn default() -> Self {
        Self {
            algorithm: EncryptionAlgorithm::AES256GCM,
            results: Vec::new(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EncryptionError {
    #[error("Invalid key length")]
    InvalidKeyLength,
    #[error("Invalid nonce length")]
    InvalidNonceLength,
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Unsupported algorithm")]
    UnsupportedAlgorithm,
    #[error("Key derivation failed")]
    KeyDerivationFailed,
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Default for SymmetricEngine {
    fn default() -> Self {
        let config = KeyDerivationConfig {
            algorithm: KdfAlgorithm::Argon2,
            iterations: 100000,
            salt_length: 32,
        };
        Self::new(config)
    }
}

impl Default for KeyDerivationConfig {
    fn default() -> Self {
        Self {
            algorithm: KdfAlgorithm::Argon2,
            iterations: 100000,
            salt_length: 32,
        }
    }
}
