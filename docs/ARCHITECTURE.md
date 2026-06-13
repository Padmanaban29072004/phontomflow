# PHANTOM-Flow System Architecture

## Overview

PHANTOM-Flow is a **multi-language defense platform** built across four languages, each chosen for its strengths:

| Language | Role | Lines of Code |
|---|---|---|
| TypeScript/Node.js | Core orchestration, API, ML inference | ~28,000 |
| Python | ML training, threat intelligence, security tools | ~5,600 |
| Rust | Performance-critical packet processing & crypto | ~4,400 |
| Go | High-throughput services & CLI tools | ~3,400 |

## High-Level Architecture

```
                         +---------------------+
                         |   React Dashboard   |
                         |  (Frontend - TSX)   |
                         +----------+----------+
                                    |
                              Socket.IO
                                    |
+----------------------------+-----+-----+----------------------------+
|         TypeScript Backend |           |  Go Security Services      |
|                            |           |                            |
|  +----------------------+  |  REST +   |  +----------------------+  |
|  |  ThreatDetectionEngine| |  WebSocket |  |  Security Server    |  |
|  |  - BehavioralAnalyzer |  |           |  |  - Threat Analysis  |  |
|  |  - StatisticalAnalyzer|  |           |  |  - Rate Limiting    |  |
|  |  - RelationshipAnalyzer| |           |  |  - Signatures       |  |
|  |  - RiskScoringEngine  |  |           |  +----------------------+  |
|  +----------------------+  |           |  +----------------------+  |
|  +----------------------+  |           |  |  Network Monitor     |  |
|  |  Services            |  |           |  |  - Packet Capture    |  |
|  |  - DeceptionService  |  |           |  |  - Connection Track  |  |
|  |  - AdaptiveLearning  |  |           |  |  - Alert Management  |  |
|  |  - InfluxDB Metrics  |  |           |  +----------------------+  |
|  +----------------------+  |           |  +----------------------+  |
|  +----------------------+  |           |  |  CLI Tools           |  |
|  |  Advanced Algorithms |  |           |  |  - Threat Scanner    |  |
|  |  - Count-Min Sketch  |  |           |  |  - Log Analyzer      |  |
|  |  - HyperLogLog       |  |           |  +----------------------+  |
|  |  - Markov Chains     |  |           +----------------------------+
|  |  - EWMA Variants     |  |
|  |  - Adaptive Rate Limiting    |
|  +----------------------+  |
+----------------------------+
|       Rust Performance Engine       |
|  +------------------------------+  |
|  |  Security Engine             |  |
|  |  - Threat Signatures         |  |
|  |  - Crypto Analysis           |  |
|  |  - Pattern Matching          |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  |  Performance Engine          |  |
|  |  - Packet Processing Pipeline|  |
|  |  - SIMD Processing           |  |
|  |  - Circuit Breaker           |  |
|  |  - Rate Limiter              |  |
|  |  - Worker Pool               |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  |  Infrastructure              |  |
|  |  - AES-256-GCM / ChaCha20    |  |
|  |  - SHA-256 / BLAKE3          |  |
|  |  - LZ4 Compression           |  |
|  |  - LRU/LFU/TTL Cache         |  |
|  +------------------------------+  |
+------------------------------------+
|       Python Security Modules        |
|  +------------------------------+  |
|  |  ML Threat Detection         |  |
|  |  - TensorFlow + sklearn      |  |
|  |  - Isolation Forest          |  |
|  |  - Random Forest + NN        |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  |  Advanced Threat Intel       |  |
|  |  - BERT NLP                  |  |
|  |  - Graph Neural Networks     |  |
|  |  - MITRE ATT&CK Mapping      |  |
|  |  - LSTM Time-Series          |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  |  Network Forensics           |  |
|  |  - PCAP Parsing              |  |
|  |  - GeoIP Analysis            |  |
|  |  - Network Topology Graphs   |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  |  Penetration Testing         |  |
|  |  - Port Scanning             |  |
|  |  - SQLi/XSS Detection        |  |
|  |  - SSL/TLS Analysis          |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  |  Smart Contract Auditor      |  |
|  |  - Reentrancy Detection      |  |
|  |  - DeFi Security Checks      |  |
|  |  - Gas Optimization          |  |
|  +------------------------------+  |
|  +------------------------------+  |
|  |  Quantum Security            |  |
|  |  - Kyber/Dilithium/SPHINCS+  |  |
|  |  - Shor/Grover Simulators    |  |
|  |  - Quantum Threat Assessment  |  |
|  +------------------------------+  |
+------------------------------------+
```

## Data Flow

### Request Lifecycle

```
1. HTTP Request arrives
       |
       v
2. Express Middleware Pipeline
   - Helmet (security headers)
   - CORS
   - Rate Limiting
   - Body Parsing
   - Request Logging
       |
       v
3. Threat Detection Middleware
   - Extract request data (IP, UA, headers, body)
   - Run BehavioralAnalyzer
   - Run StatisticalAnalyzer
   - Run RelationshipAnalyzer
   - Combine scores via RiskScoringEngine
   - Execute graduated response
       |
       v
4. Decision Points
   - Score < 0.3: Allow (low risk)
   - Score 0.3-0.5: Monitor (medium risk)
   - Score 0.5-0.7: Challenge (high risk)
   - Score > 0.7: Divert to deception (critical)
       |
       v
5. Route Handler
   - API route processes the request
   - Returns response to client
       |
       v
6. Feedback Loop
   - CAPTCHA result / diversion outcome
   - AdaptiveLearningService retrains model
   - Metrics updated in InfluxDB / Redis
```

### Packet Processing Pipeline (Rust)

```
Raw Network Packet
       |
       v
Ethernet Header Parser (14 bytes)
       |
       v
IP Header Parser (IPv4: 20 bytes / IPv6: 40 bytes)
       |
       v
Transport Header Parser (TCP: 20 bytes / UDP: 8 bytes / ICMP: 8 bytes)
       |
       v
+-- Performance Engine Pipeline ------------+
|  1. Circuit Breaker Check                 |
|  2. Rate Limiter (token bucket per IP)    |
|  3. Packet Analysis (protocol, headers)   |
|  4. Threat Detection (signatures + ML)    |
|  5. Pattern Matching (14 categories)      |
|  6. Crypto Analysis (if encrypted)        |
|  7. Metrics Collection                    |
+-------------------------------------------+
       |
       v
Analysis Result (threat_score, risk_level, action)
```

## Component Map

### TypeScript Backend (`backend/src/`)

| Directory | Contents | Purpose |
|---|---|---|
| `core/` | ThreatDetectionEngine, 4 analyzers, 6 algorithm modules | Detection logic |
| `services/` | 20+ services (DB, Redis, Deception, ML, InfluxDB, etc.) | Business logic |
| `api/routes/` | 7 route files (auth, threats, dashboard, deception, metrics, influxdb, docs) | HTTP endpoints |
| `types/` | Type definitions for all subsystems | Type safety |
| `config/` | 8 config files with env-based tuning | Configuration |
| `models/` | Mongoose models (NetworkTraffic, ThreatScore, UserBehavior) | Data models |
| `utils/` | Logger | Utilities |

### Rust (`src/`)

| Module | Files | Purpose |
|---|---|---|
| `security_engine/` | mod.rs, crypto.rs | Threat analysis & crypto inspection |
| `performance_engine/` | core.rs | Pipeline processing, SIMD, worker pool |
| `network/` | packet_parser.rs | Ethernet/IP/TCP/UDP/ICMP parsing |
| `analysis/` | pattern_matcher.rs | Regex threat patterns (14 categories) |
| `encryption/` | symmetric.rs | AES-256-GCM, ChaCha20-Poly1305 |
| `compression/` | lz4.rs | LZ4-style compression |
| `storage/` | cache.rs | LRU/LFU/TTL cache |
| `threading/` | worker_pool.rs | Crossbeam channel worker pool |
| `utils/` | hash.rs | SHA-256/512, BLAKE3, constant-time compare |

### Go

| Component | Purpose |
|---|---|
| `cmd/security-server/` | HTTP API: threat analysis, WebSocket, signatures CRUD |
| `cmd/threat-scanner/` | CLI for scanning IPs/domains/networks |
| `cmd/log-analyzer/` | CLI for parsing security logs |
| `internal/security/` | Network monitor: packet capture, connection tracking, alerts |
| `internal/alerts/` | Alert manager: rules, channels, lifecycle |
| `internal/monitoring/` | System metrics collection |
| `pkg/analyzer/` | Threat analysis: behavioral, statistical, signature, ML |
| `pkg/security/` | Input validation (SQLi, XSS, injection patterns) |
| `pkg/network/` | Protocol handler (HTTP, TCP, UDP, DNS) |
| `pkg/metrics/` | Generic metrics registry |
| `pkg/utils/` | AES-GCM encryption, SHA-256 hashing |

### Python Modules

| Module | Lines | Purpose |
|---|---|---|
| `ml_models/` | 588 | TensorFlow + sklearn threat detection ensemble |
| `ai_models/` | 1,335 | BERT NLP, GNNs, LSTM, MITRE ATT&CK |
| `data_analysis/` | 734 | PCAP parsing, GeoIP, network topology |
| `security_tools/` | 777 | Port scanning, SQLi/XSS, SSL analysis |
| `blockchain_security/` | 948 | Solidity audit, DeFi checks |
| `quantum_security/` | 1,351 | Kyber, Dilithium, SPHINCS+, Shor/Grover |

### Frontend (`frontend/`)

| File | Status | Purpose |
|---|---|---|
| `App.tsx` | Built | Routing skeleton with React Query, Socket.IO, Auth |
| `DashboardPage.tsx` | Built | Dashboard layout with metrics, charts, tables |
| `components/dashboard/*` | Missing | 5+ chart/table/card components |
| `contexts/*` | Missing | AuthContext, SocketContext |
| `services/api.ts` | Missing | Axios API client |
| `pages/*` | Missing | Login, Threats, Deception, Analytics, Settings |

## Storage Layer

| Store | Purpose | Used By |
|---|---|---|
| MongoDB | Persistence (threats, users, events) | TypeScript backend |
| Redis | Caching, sessions, rate limiting, metrics | TypeScript + Go |
| InfluxDB | Time-series metrics (performance, threats) | TypeScript backend |
| PostgreSQL | Threat signatures (via GORM) | Go security server |
