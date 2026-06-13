# Multi-Perspective Analysis Engine

## Overview

PHANTOM-Flow's core innovation is combining three complementary detection perspectives into a single weighted threat score. Each perspective catches what the others might miss.

## The Three Engines

```
+-------------------+   +-------------------+   +-------------------+
|   Statistical     |   |   Behavioral      |   |   Relationship    |
|   Detection       |   |   Analysis        |   |   Intelligence    |
|                   |   |                   |   |                   |
| Traffic spikes    |   | User habits       |   | Network graphs    |
| Request anomalies |   | Login patterns    |   | IP correlations   |
| DDoS indicators   |   | Navigation flow   |   | Coordinated       |
| API abuse         |   | Session behavior  |   | attack detection  |
+--------+----------+   +--------+----------+   +--------+----------+
         |                       |                        |
         +-----------------------+------------------------+
                                 |
                                 v
                     +-----------+-----------+
                     |  Risk Scoring Engine  |
                     |  (weighted + context) |
                     +-----------+-----------+
                                 |
                                 v
                     Threat Score [0.0 - 1.0]
```

## 1. Statistical Detection Engine

**Purpose:** Identify what's unusual in traffic patterns that could indicate an attack.

### Detection Techniques

| Technique | What It Detects | Implementation |
|---|---|---|
| **Z-Score Analysis** | Outliers in request size, response time, frequency | `StatisticalAnalyzer.analyze()` |
| **EWMA (Exponential Weighted Moving Average)** | Sudden shifts in baselines (3 variants: Simple, Double, Adaptive) | `core/ewma/EWMA.ts` |
| **Count-Min Sketch** | Frequency estimation, anomaly detection (spikes, rare items, bursts) | `core/sketch/CountMinSketch.ts` |
| **HyperLogLog** | Cardinality estimation, unique visitor tracking | `core/hyperloglog/HyperLogLog.ts` |
| **Adaptive Baseline** | Concept drift detection, automatic threshold adjustment | `services/BaselineAdaptationService.ts` |

### Threat Indicators

| Indicator | Example | Score Impact |
|---|---|---|
| Traffic spike | 500 req/min -> 10,000 req/min | High |
| Request size anomaly | Avg 2KB -> 50KB payloads | Medium |
| Error rate increase | 0.1% -> 15% error rate | High |
| Unique IP surge | 100/day -> 5,000/day | Medium |
| Endpoint concentration | All traffic hits /login only | High |

### Statistical Baseline Model

```
For each metric tracked:
  - Running mean and standard deviation
  - Z-score = (observed - mean) / std
  - If |Z| > 3: anomaly detected
  - EWMA smooths baseline to adapt over time
  - Double EWMA captures trends
  - Adaptive EWMA adjusts smoothing parameter based on volatility
```

## 2. Behavioral Analysis Engine

**Purpose:** Understand who the user is and detect when their behavior deviates from established patterns. This is essentially a **UEBA (User and Entity Behavior Analytics)** system.

### What It Tracks

| Dimension | Attributes | Anomaly Signal |
|---|---|---|
| **Temporal** | Time of day, day of week, frequency | User normally active 9-5 but now active at 3 AM |
| **Geographic** | Country, city, ISP, ASN | User from India suddenly appears from Russia |
| **Navigation** | Page sequence, click patterns, time between actions | Random scanning vs. normal linear flow |
| **Session** | Duration, request count, error rate, authentication status | Short session with high error rate |
| **Device** | User agent, fingerprint, screen resolution, OS | Same credentials from different device |

### Detection Examples

**Normal pattern:**
```
User: johndoe
Hours: 9 AM - 5 PM (local time)
Location: Mumbai, India
Rate: ~50 requests/day
Paths: /dashboard -> /reports -> /settings
```

**Anomalous pattern:**
```
User: johndoe
Hours: 3 AM
Location: Moscow, Russia
Rate: 5,000 requests/hour
Paths: /api/admin, /api/users, /config.json
-> Suspicious: Score = 0.85
```

### Behavioral Types (Markov Chain States)

The system tracks 25+ behavioral action types:
- PAGE_VIEW, LOGIN, LOGOUT, FORM_SUBMIT, API_CALL
- FILE_DOWNLOAD, FILE_UPLOAD, ADMIN_ACCESS
- SEARCH, NAVIGATE, ERROR, TIMEOUT
- SUSPICIOUS_PATH, RAPID_FIRE, REPEATED_ACTION

### Sequence Analysis (Markov Chains)

Behavioral patterns are modeled as **Markov Chains** (configurable 1st, 2nd, or 3rd order):

```
Normal transition probability:
  LOGIN -> DASHBOARD -> SEARCH -> VIEW_PROFILE: 0.85

Anomalous transition probability:
  LOGIN -> ADMIN_PANEL -> CONFIG_ACCESS -> EXPORT_DATA: 0.02
```

Low-probability sequences are flagged as behavioral anomalies.

## 3. Relationship Intelligence Engine

**Purpose:** Instead of viewing events in isolation, build a **relationship graph** to identify coordinated threats.

### What It Builds

The relationship analyzer constructs a graph where:

```
User A -- Session 1 -- IP X -- Device Y
  |                      |
  |                      +-- IP Z (same ASN)
  |                      |
  v                      v
User B -- Session 2 -- IP W -- Device Z
```

### Attack Patterns It Identifies

| Pattern | Description | Graph Signature |
|---|---|---|
| **Botnet** | Many IPs, same behavior, same target | Star graph, many leaf nodes |
| **Credential Stuffing** | One IP, many user accounts | Bipartite, high degree |
| **Coordinated Attack** | Multiple IPs, same timing, same target | Clique or near-clique |
| **Lateral Movement** | One user, multiple internal IPs | Path graph through internal nodes |
| **Data Exfiltration** | Spike in outbound data from one node | Weighted edge, high volume |

### Graph Neural Network

The AI models directory (`ai_models/`) includes a Graph Neural Network implementation for:
- Node classification (benign vs. malicious entity)
- Link prediction (which entities will communicate next)
- Anomalous subgraph detection (coordinated attack clusters)

## 4. Risk Scoring Engine

**Purpose:** Combine all three perspectives into a single actionable score with context-aware adjustments.

### Score Calculation

```
Base Score = Behavioral × 0.25 + Statistical × 0.25 + Relationship × 0.20 + ML × 0.30

Context Score = Base Score × Context Multipliers

Final Score = clamp(Context Score, 0.0, 1.0)
```

### Context Multipliers

| Context | Factor | Multiplier |
|---|---|---|
| Off-hours request | Temporal | 1.2x |
| High-risk country | Geographic | 1.4x |
| VPN/proxy detected | Geographic | 1.3x |
| Tor exit node | Geographic | 1.8x |
| Bot-like behavior | Behavioral | 1.8x |
| Known threat IP | Network | 2.0x |
| Unauthenticated | Session | 1.2x |
| Privileged account | Session | 0.9x (lower risk) |

### Risk Levels

| Score Range | Level | Action |
|---|---|---|
| 0.00 - 0.30 | Low | Allow (no action) |
| 0.31 - 0.50 | Medium | Log and monitor |
| 0.51 - 0.70 | High | Challenge (CAPTCHA) + rate limit |
| 0.71 - 0.85 | Critical | Block and alert |
| 0.86 - 1.00 | Severe | Divert to deception environment |

### Risk Scoring Configuration

All thresholds, weights, and multipliers are configurable via environment variables:

```
ANOMALY_DETECTION_THRESHOLD=0.8
BEHAVIOR_ANALYSIS_WINDOW=300000  # 5 minutes
CONTEXT_SENSITIVITY=0.7
CONFIDENCE_THRESHOLD=0.5
```

## Engine Interaction

The engines don't operate in isolation. They share context:

1. **Statistical** detects a traffic spike from IP range `X.X.X.0/24`
2. **Behavioral** confirms those IPs all exhibit the same browsing pattern (bot behavior)
3. **Relationship** shows those IPs are all connected through the same ASN and have been seen in previous attack campaigns
4. **Risk Scoring** combines all three signals -> Critical threat score -> Divert to deception
5. **Feedback** from the deception environment improves the ML model for next time
