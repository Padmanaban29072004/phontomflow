// PHANTOM-Flow Advanced Pattern Matching Engine
// High-performance pattern detection for security analysis

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatcher {
    patterns: Arc<RwLock<HashMap<String, CompiledPattern>>>,
    cache: Arc<RwLock<HashMap<String, Vec<PatternMatch>>>>,
    config: MatchingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledPattern {
    pub id: String,
    pub name: String,
    pub regex: Regex,
    pub category: PatternCategory,
    pub severity: PatternSeverity,
    pub confidence: f64,
    pub enabled: bool,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PatternCategory {
    Malware,
    Exploit,
    Phishing,
    DataExfiltration,
    CommandInjection,
    SqlInjection,
    Xss,
    PathTraversal,
    BruteForce,
    DDoS,
    Botnet,
    Cryptocurrency,
    SocialEngineering,
    NetworkAnomaly,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum PatternSeverity {
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern_id: String,
    pub pattern_name: String,
    pub category: PatternCategory,
    pub severity: PatternSeverity,
    pub confidence: f64,
    pub matched_text: String,
    pub start_pos: usize,
    pub end_pos: usize,
    pub context: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingConfig {
    pub case_sensitive: bool,
    pub multiline: bool,
    pub dotall: bool,
    pub cache_size: usize,
    pub max_context_length: usize,
    pub enable_fuzzy_matching: bool,
    pub fuzzy_threshold: f64,
}

impl Default for MatchingConfig {
    fn default() -> Self {
        Self {
            case_sensitive: false,
            multiline: true,
            dotall: false,
            cache_size: 1000,
            max_context_length: 200,
            enable_fuzzy_matching: false,
            fuzzy_threshold: 0.8,
        }
    }
}

impl PatternMatcher {
    pub fn new(config: MatchingConfig) -> Self {
        Self {
            patterns: Arc::new(RwLock::new(HashMap::new())),
            cache: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    pub fn add_pattern(&self, pattern: PatternDefinition) -> Result<(), PatternError> {
        let compiled = self.compile_pattern(pattern)?;
        
        let mut patterns = self.patterns.write().unwrap();
        patterns.insert(compiled.id.clone(), compiled);
        
        Ok(())
    }

    pub fn add_patterns(&self, patterns: Vec<PatternDefinition>) -> Result<(), PatternError> {
        for pattern in patterns {
            self.add_pattern(pattern)?;
        }
        Ok(())
    }

    fn compile_pattern(&self, pattern: PatternDefinition) -> Result<CompiledPattern, PatternError> {
        let mut regex_builder = regex::RegexBuilder::new(&pattern.pattern);
        
        regex_builder
            .case_insensitive(!self.config.case_sensitive)
            .multi_line(self.config.multiline)
            .dot_matches_new_line(self.config.dotall);

        let regex = regex_builder.build()
            .map_err(|e| PatternError::RegexError(e.to_string()))?;

        Ok(CompiledPattern {
            id: pattern.id,
            name: pattern.name,
            regex,
            category: pattern.category,
            severity: pattern.severity,
            confidence: pattern.confidence,
            enabled: pattern.enabled,
            metadata: pattern.metadata,
        })
    }

    pub fn match_text(&self, text: &str) -> Vec<PatternMatch> {
        // Check cache first
        if let Some(cached) = self.get_cached_matches(text) {
            return cached;
        }

        let mut matches = Vec::new();
        let patterns = self.patterns.read().unwrap();

        for pattern in patterns.values() {
            if !pattern.enabled {
                continue;
            }

            let pattern_matches = self.find_pattern_matches(text, pattern);
            matches.extend(pattern_matches);
        }

        // Sort by severity and confidence
        matches.sort_by(|a, b| {
            b.severity.cmp(&a.severity)
                .then(b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal))
        });

        // Cache results
        self.cache_matches(text, &matches);

        matches
    }

    fn find_pattern_matches(&self, text: &str, pattern: &CompiledPattern) -> Vec<PatternMatch> {
        let mut matches = Vec::new();

        for mat in pattern.regex.find_iter(text) {
            let matched_text = mat.as_str().to_string();
            let start_pos = mat.start();
            let end_pos = mat.end();

            let context = self.extract_context(text, start_pos, end_pos);

            let mut metadata = pattern.metadata.clone();
            metadata.insert("pattern_id".to_string(), pattern.id.clone());
            metadata.insert("match_length".to_string(), (end_pos - start_pos).to_string());

            matches.push(PatternMatch {
                pattern_id: pattern.id.clone(),
                pattern_name: pattern.name.clone(),
                category: pattern.category,
                severity: pattern.severity,
                confidence: pattern.confidence,
                matched_text,
                start_pos,
                end_pos,
                context,
                metadata,
            });
        }

        matches
    }

    fn extract_context(&self, text: &str, start: usize, end: usize) -> String {
        let context_length = self.config.max_context_length;
        let text_len = text.len();

        let context_start = start.saturating_sub(context_length / 2);
        let context_end = (end + context_length / 2).min(text_len);

        let context = &text[context_start..context_end];
        
        // Add ellipsis if we truncated
        let mut result = String::new();
        if context_start > 0 {
            result.push_str("...");
        }
        result.push_str(context);
        if context_end < text_len {
            result.push_str("...");
        }

        result
    }

    pub fn match_with_filters(&self, text: &str, filters: &MatchingFilters) -> Vec<PatternMatch> {
        let all_matches = self.match_text(text);
        
        all_matches.into_iter()
            .filter(|m| filters.matches(m))
            .collect()
    }

    pub fn get_pattern_count(&self) -> usize {
        self.patterns.read().unwrap().len()
    }

    pub fn get_enabled_patterns(&self) -> Vec<String> {
        self.patterns.read().unwrap()
            .values()
            .filter(|p| p.enabled)
            .map(|p| p.id.clone())
            .collect()
    }

    pub fn enable_pattern(&self, pattern_id: &str) -> Result<(), PatternError> {
        let mut patterns = self.patterns.write().unwrap();
        if let Some(pattern) = patterns.get_mut(pattern_id) {
            pattern.enabled = true;
            Ok(())
        } else {
            Err(PatternError::PatternNotFound(pattern_id.to_string()))
        }
    }

    pub fn disable_pattern(&self, pattern_id: &str) -> Result<(), PatternError> {
        let mut patterns = self.patterns.write().unwrap();
        if let Some(pattern) = patterns.get_mut(pattern_id) {
            pattern.enabled = false;
            Ok(())
        } else {
            Err(PatternError::PatternNotFound(pattern_id.to_string()))
        }
    }

    pub fn get_statistics(&self) -> MatchingStatistics {
        let patterns = self.patterns.read().unwrap();
        let cache = self.cache.read().unwrap();

        let total_patterns = patterns.len();
        let enabled_patterns = patterns.values().filter(|p| p.enabled).count();
        let cache_hits = cache.len();

        let category_counts: HashMap<PatternCategory, usize> = patterns
            .values()
            .filter(|p| p.enabled)
            .fold(HashMap::new(), |mut acc, p| {
                *acc.entry(p.category).or_insert(0) += 1;
                acc
            });

        MatchingStatistics {
            total_patterns,
            enabled_patterns,
            disabled_patterns: total_patterns - enabled_patterns,
            cache_hits,
            category_distribution: category_counts,
        }
    }

    fn get_cached_matches(&self, text: &str) -> Option<Vec<PatternMatch>> {
        let cache = self.cache.read().unwrap();
        cache.get(text).cloned()
    }

    fn cache_matches(&self, text: &str, matches: &[PatternMatch]) {
        if matches.is_empty() {
            return;
        }

        let mut cache = self.cache.write().unwrap();
        
        // Simple LRU-like behavior: remove oldest entries if cache is full
        if cache.len() >= self.config.cache_size {
            let keys_to_remove: Vec<String> = cache.keys().take(cache.len() - self.config.cache_size + 1).cloned().collect();
            for key in keys_to_remove {
                cache.remove(&key);
            }
        }

        cache.insert(text.to_string(), matches.to_vec());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternDefinition {
    pub id: String,
    pub name: String,
    pub pattern: String,
    pub category: PatternCategory,
    pub severity: PatternSeverity,
    pub confidence: f64,
    pub enabled: bool,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingFilters {
    pub categories: Option<HashSet<PatternCategory>>,
    pub severities: Option<HashSet<PatternSeverity>>,
    pub min_confidence: Option<f64>,
    pub pattern_ids: Option<HashSet<String>>,
}

impl MatchingFilters {
    pub fn new() -> Self {
        Self {
            categories: None,
            severities: None,
            min_confidence: None,
            pattern_ids: None,
        }
    }

    pub fn with_categories(mut self, categories: HashSet<PatternCategory>) -> Self {
        self.categories = Some(categories);
        self
    }

    pub fn with_severities(mut self, severities: HashSet<PatternSeverity>) -> Self {
        self.severities = Some(severities);
        self
    }

    pub fn with_min_confidence(mut self, min_confidence: f64) -> Self {
        self.min_confidence = Some(min_confidence);
        self
    }

    pub fn with_pattern_ids(mut self, pattern_ids: HashSet<String>) -> Self {
        self.pattern_ids = Some(pattern_ids);
        self
    }

    pub fn matches(&self, pattern_match: &PatternMatch) -> bool {
        if let Some(ref categories) = self.categories {
            if !categories.contains(&pattern_match.category) {
                return false;
            }
        }

        if let Some(ref severities) = self.severities {
            if !severities.contains(&pattern_match.severity) {
                return false;
            }
        }

        if let Some(min_conf) = self.min_confidence {
            if pattern_match.confidence < min_conf {
                return false;
            }
        }

        if let Some(ref pattern_ids) = self.pattern_ids {
            if !pattern_ids.contains(&pattern_match.pattern_id) {
                return false;
            }
        }

        true
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchingStatistics {
    pub total_patterns: usize,
    pub enabled_patterns: usize,
    pub disabled_patterns: usize,
    pub cache_hits: usize,
    pub category_distribution: HashMap<PatternCategory, usize>,
}

#[derive(Debug, thiserror::Error)]
pub enum PatternError {
    #[error("Regex compilation error: {0}")]
    RegexError(String),
    #[error("Pattern not found: {0}")]
    PatternNotFound(String),
    #[error("Invalid pattern definition: {0}")]
    InvalidDefinition(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Default for PatternMatcher {
    fn default() -> Self {
        Self::new(MatchingConfig::default())
    }
}

// Utility functions for common pattern creation
impl PatternMatcher {
    pub fn create_malware_patterns() -> Vec<PatternDefinition> {
        vec![
            PatternDefinition {
                id: "malware_trojan".to_string(),
                name: "Trojan Detection".to_string(),
                pattern: r"(?i)(trojan|backdoor|keylogger|rat|remote.*access)".to_string(),
                category: PatternCategory::Malware,
                severity: PatternSeverity::High,
                confidence: 0.85,
                enabled: true,
                metadata: HashMap::new(),
            },
            PatternDefinition {
                id: "malware_ransomware".to_string(),
                name: "Ransomware Detection".to_string(),
                pattern: r"(?i)(ransomware|encrypt.*files|decrypt.*key)".to_string(),
                category: PatternCategory::Malware,
                severity: PatternSeverity::Critical,
                confidence: 0.9,
                enabled: true,
                metadata: HashMap::new(),
            },
        ]
    }

    pub fn create_injection_patterns() -> Vec<PatternDefinition> {
        vec![
            PatternDefinition {
                id: "sql_injection_union".to_string(),
                name: "SQL Injection - UNION".to_string(),
                pattern: r"(?i)(union\s+select|union\s+all\s+select)".to_string(),
                category: PatternCategory::SqlInjection,
                severity: PatternSeverity::High,
                confidence: 0.9,
                enabled: true,
                metadata: HashMap::new(),
            },
            PatternDefinition {
                id: "xss_script_tag".to_string(),
                name: "XSS - Script Tag".to_string(),
                pattern: r"(?i)(<script[^>]*>|javascript:)".to_string(),
                category: PatternCategory::Xss,
                severity: PatternSeverity::Medium,
                confidence: 0.8,
                enabled: true,
                metadata: HashMap::new(),
            },
        ]
    }
}
