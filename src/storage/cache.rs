// PHANTOM-Flow High-Performance Caching System
// Memory-efficient caching with TTL and eviction policies

use std::collections::{HashMap, VecDeque};
use std::hash::{Hash, Hasher};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct Cache<K, V> {
    data: Arc<RwLock<HashMap<K, CacheEntry<V>>>>,
    access_order: Arc<RwLock<VecDeque<K>>>,
    config: CacheConfig,
    stats: Arc<RwLock<CacheStats>>,
}

#[derive(Debug, Clone)]
struct CacheEntry<V> {
    value: V,
    created_at: Instant,
    last_accessed: Instant,
    access_count: u64,
    ttl: Option<Duration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub max_size: usize,
    pub default_ttl: Option<Duration>,
    pub eviction_policy: EvictionPolicy,
    pub enable_stats: bool,
    pub cleanup_interval: Duration,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EvictionPolicy {
    LRU,    // Least Recently Used
    LFU,    // Least Frequently Used
    TTL,    // Time To Live
    Random, // Random eviction
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub insertions: u64,
    pub deletions: u64,
    pub current_size: usize,
    pub total_requests: u64,
}

impl<K, V> Cache<K, V>
where
    K: Clone + Hash + Eq + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    pub fn new(config: CacheConfig) -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            access_order: Arc::new(RwLock::new(VecDeque::new())),
            config,
            stats: Arc::new(RwLock::new(CacheStats::default())),
        }
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let mut data = self.data.write().unwrap();
        let mut stats = self.stats.write().unwrap();
        
        stats.total_requests += 1;

        if let Some(entry) = data.get_mut(key) {
            // Check TTL
            if let Some(ttl) = entry.ttl {
                if entry.created_at.elapsed() > ttl {
                    data.remove(key);
                    stats.misses += 1;
                    return None;
                }
            }

            // Update access information
            entry.last_accessed = Instant::now();
            entry.access_count += 1;
            
            if self.config.enable_stats {
                stats.hits += 1;
            }

            // Update access order for LRU
            if self.config.eviction_policy == EvictionPolicy::LRU {
                self.update_access_order(key);
            }

            Some(entry.value.clone())
        } else {
            if self.config.enable_stats {
                stats.misses += 1;
            }
            None
        }
    }

    pub fn insert(&self, key: K, value: V) -> Option<V> {
        self.insert_with_ttl(key, value, self.config.default_ttl)
    }

    pub fn insert_with_ttl(&self, key: K, value: V, ttl: Option<Duration>) -> Option<V> {
        let mut data = self.data.write().unwrap();
        let mut stats = self.stats.write().unwrap();

        // Check if we need to evict
        if data.len() >= self.config.max_size && !data.contains_key(&key) {
            self.evict_entry(&mut data, &mut stats);
        }

        let entry = CacheEntry {
            value: value.clone(),
            created_at: Instant::now(),
            last_accessed: Instant::now(),
            access_count: 1,
            ttl,
        };

        let old_value = data.insert(key.clone(), entry).map(|e| e.value);
        
        if old_value.is_none() {
            stats.insertions += 1;
            stats.current_size = data.len();
        }

        // Update access order
        if self.config.eviction_policy == EvictionPolicy::LRU {
            self.update_access_order(&key);
        }

        old_value
    }

    pub fn remove(&self, key: &K) -> Option<V> {
        let mut data = self.data.write().unwrap();
        let mut stats = self.stats.write().unwrap();

        if let Some(entry) = data.remove(key) {
            stats.deletions += 1;
            stats.current_size = data.len();
            Some(entry.value)
        } else {
            None
        }
    }

    pub fn contains_key(&self, key: &K) -> bool {
        let data = self.data.read().unwrap();
        data.contains_key(key)
    }

    pub fn len(&self) -> usize {
        let data = self.data.read().unwrap();
        data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn clear(&self) {
        let mut data = self.data.write().unwrap();
        let mut stats = self.stats.write().unwrap();
        
        data.clear();
        stats.current_size = 0;
        stats.evictions += data.len() as u64;
    }

    pub fn cleanup_expired(&self) -> usize {
        let mut data = self.data.write().unwrap();
        let mut stats = self.stats.write().unwrap();
        
        let now = Instant::now();
        let mut expired_keys = Vec::new();

        for (key, entry) in data.iter() {
            if let Some(ttl) = entry.ttl {
                if entry.created_at.elapsed() > ttl {
                    expired_keys.push(key.clone());
                }
            }
        }

        let expired_count = expired_keys.len();
        for key in expired_keys {
            data.remove(&key);
        }

        stats.evictions += expired_count as u64;
        stats.current_size = data.len();
        expired_count
    }

    fn evict_entry(&self, data: &mut HashMap<K, CacheEntry<V>>, stats: &mut CacheStats) {
        let key_to_evict = match self.config.eviction_policy {
            EvictionPolicy::LRU => self.get_lru_key(),
            EvictionPolicy::LFU => self.get_lfu_key(data),
            EvictionPolicy::TTL => self.get_oldest_key(data),
            EvictionPolicy::Random => self.get_random_key(data),
        };

        if let Some(key) = key_to_evict {
            data.remove(&key);
            stats.evictions += 1;
        }
    }

    fn get_lru_key(&self) -> Option<K> {
        let mut access_order = self.access_order.write().unwrap();
        access_order.pop_front()
    }

    fn get_lfu_key(&self, data: &HashMap<K, CacheEntry<V>>) -> Option<K> {
        data.iter()
            .min_by_key(|(_, entry)| entry.access_count)
            .map(|(key, _)| key.clone())
    }

    fn get_oldest_key(&self, data: &HashMap<K, CacheEntry<V>>) -> Option<K> {
        data.iter()
            .min_by_key(|(_, entry)| entry.created_at)
            .map(|(key, _)| key.clone())
    }

    fn get_random_key(&self, data: &HashMap<K, CacheEntry<V>>) -> Option<K> {
        use std::collections::hash_map::RandomState;
        use std::hash::BuildHasher;
        
        let mut hasher = RandomState::new().build_hasher();
        let mut min_hash = u64::MAX;
        let mut selected_key = None;

        for (key, _) in data.iter() {
            key.hash(&mut hasher);
            let hash = hasher.finish();
            if hash < min_hash {
                min_hash = hash;
                selected_key = Some(key.clone());
            }
        }

        selected_key
    }

    fn update_access_order(&self, key: &K) {
        let mut access_order = self.access_order.write().unwrap();
        
        // Remove if already exists
        access_order.retain(|k| k != key);
        
        // Add to end (most recently used)
        access_order.push_back(key.clone());
    }

    pub fn get_stats(&self) -> CacheStats {
        let stats = self.stats.read().unwrap();
        let data = self.data.read().unwrap();
        
        CacheStats {
            hits: stats.hits,
            misses: stats.misses,
            evictions: stats.evictions,
            insertions: stats.insertions,
            deletions: stats.deletions,
            current_size: data.len(),
            total_requests: stats.total_requests,
        }
    }

    pub fn get_hit_rate(&self) -> f64 {
        let stats = self.get_stats();
        if stats.total_requests == 0 {
            0.0
        } else {
            stats.hits as f64 / stats.total_requests as f64
        }
    }

    pub fn get_memory_usage(&self) -> usize {
        // Rough estimation of memory usage
        let data = self.data.read().unwrap();
        data.len() * std::mem::size_of::<(K, CacheEntry<V>)>()
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_size: 1000,
            default_ttl: Some(Duration::from_secs(3600)), // 1 hour
            eviction_policy: EvictionPolicy::LRU,
            enable_stats: true,
            cleanup_interval: Duration::from_secs(300), // 5 minutes
        }
    }
}

impl Default for CacheStats {
    fn default() -> Self {
        Self {
            hits: 0,
            misses: 0,
            evictions: 0,
            insertions: 0,
            deletions: 0,
            current_size: 0,
            total_requests: 0,
        }
    }
}

// Specialized cache implementations
pub type StringCache<V> = Cache<String, V>;
pub type IntCache<V> = Cache<u64, V>;

// Cache manager for multiple caches
pub struct CacheManager {
    caches: HashMap<String, Box<dyn CacheInterface>>,
}

pub trait CacheInterface: Send + Sync {
    fn get_stats(&self) -> CacheStats;
    fn clear(&self);
    fn len(&self) -> usize;
}

impl<K, V> CacheInterface for Cache<K, V>
where
    K: Clone + Hash + Eq + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    fn get_stats(&self) -> CacheStats {
        self.get_stats()
    }

    fn clear(&self) {
        self.clear();
    }

    fn len(&self) -> usize {
        self.len()
    }
}

impl CacheManager {
    pub fn new() -> Self {
        Self {
            caches: HashMap::new(),
        }
    }

    pub fn add_cache<K, V>(&mut self, name: String, cache: Cache<K, V>)
    where
        K: Clone + Hash + Eq + Send + Sync + 'static,
        V: Clone + Send + Sync + 'static,
    {
        self.caches.insert(name, Box::new(cache));
    }

    pub fn get_cache_stats(&self, name: &str) -> Option<CacheStats> {
        self.caches.get(name).map(|cache| cache.get_stats())
    }

    pub fn clear_all(&self) {
        for cache in self.caches.values() {
            cache.clear();
        }
    }

    pub fn get_total_memory_usage(&self) -> usize {
        self.caches.values().map(|cache| cache.len()).sum()
    }
}

impl Default for CacheManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_basic_operations() {
        let config = CacheConfig {
            max_size: 10,
            default_ttl: None,
            eviction_policy: EvictionPolicy::LRU,
            enable_stats: true,
            cleanup_interval: Duration::from_secs(60),
        };

        let cache = Cache::new(config);

        // Test insert and get
        cache.insert("key1".to_string(), "value1".to_string());
        assert_eq!(cache.get(&"key1".to_string()), Some("value1".to_string()));

        // Test miss
        assert_eq!(cache.get(&"key2".to_string()), None);

        // Test overwrite
        cache.insert("key1".to_string(), "value2".to_string());
        assert_eq!(cache.get(&"key1".to_string()), Some("value2".to_string()));
    }

    #[test]
    fn test_ttl_expiration() {
        let config = CacheConfig {
            max_size: 10,
            default_ttl: Some(Duration::from_millis(100)),
            eviction_policy: EvictionPolicy::LRU,
            enable_stats: true,
            cleanup_interval: Duration::from_secs(60),
        };

        let cache = Cache::new(config);
        cache.insert("key1".to_string(), "value1".to_string());

        // Should be available immediately
        assert_eq!(cache.get(&"key1".to_string()), Some("value1".to_string()));

        // Wait for expiration
        thread::sleep(Duration::from_millis(150));
        assert_eq!(cache.get(&"key1".to_string()), None);
    }

    #[test]
    fn test_eviction() {
        let config = CacheConfig {
            max_size: 2,
            default_ttl: None,
            eviction_policy: EvictionPolicy::LRU,
            enable_stats: true,
            cleanup_interval: Duration::from_secs(60),
        };

        let cache = Cache::new(config);

        // Fill cache
        cache.insert("key1".to_string(), "value1".to_string());
        cache.insert("key2".to_string(), "value2".to_string());

        // Access key1 to make it more recently used
        cache.get(&"key1".to_string());

        // Insert third item, should evict key2
        cache.insert("key3".to_string(), "value3".to_string());

        assert_eq!(cache.get(&"key1".to_string()), Some("value1".to_string()));
        assert_eq!(cache.get(&"key2".to_string()), None);
        assert_eq!(cache.get(&"key3".to_string()), Some("value3".to_string()));
    }
}
