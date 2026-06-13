# PHANTOM-Flow Algorithm Catalog

## Overview

This document catalogs every advanced algorithm implemented in PHANTOM-Flow, with mathematical descriptions, configuration parameters, and integration points.

---

## 1. Count-Min Sketch

**Purpose:** Memory-efficient frequency estimation for anomaly detection.

**Location:** `backend/src/core/sketch/CountMinSketch.ts`

### Theory

A Count-Min Sketch is a probabilistic data structure that uses a 2D array of counters and `d` hash functions to estimate frequencies. It's space-efficient but can over-count due to hash collisions.

```
width +----+----+----+----+----+
      | 0  | 0  | 1  | 0  | 0  |  <- hash function 1
      +----+----+----+----+----+
      | 0  | 1  | 0  | 0  | 0  |  <- hash function 2
      +----+----+----+----+----+
      | 0  | 0  | 0  | 1  | 0  |  <- hash function 3
      +----+----+----+----+----+
         depth = 3, width = 5
```

### Algorithm

```
add(item, count=1):
  for each hash function h_i:
    sketch[i][h_i(item)] += count

estimate(item):
  return min(sketch[i][h_i(item)] for i in 0..depth-1)
```

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `width` | 10000 | Number of counters per hash function |
| `depth` | 7 | Number of hash functions |
| `errorRate` | 0.001 | Desired error rate (e = e/width) |
| `confidence` | 0.999 | Desired confidence (delta = 1-confidence) |

### Anomaly Detection

The SketchAnomalyDetector identifies:

| Anomaly Type | Detection Method | Use Case |
|---|---|---|
| **Spike** | Current count > rolling average + threshold * std | Sudden traffic surge |
| **Rare Item** | Frequency < threshold but expected to be common | Unusual endpoint access |
| **Burst** | Multiple items spike simultaneously | Coordinated attack |
| **Sustained Activity** | Elevated count over long period | Slow DDoS / data exfiltration |

---

## 2. HyperLogLog

**Purpose:** Cardinality estimation for unique visitor tracking.

**Location:** `backend/src/core/hyperloglog/HyperLogLog.ts`

### Theory

HyperLogLog estimates the number of unique elements in a multiset using significantly less memory than exact counting. It works by observing the longest run of leading zeros in hashed values.

```
cardinality = alpha_m * m^2 * (sum(2^(-M[j])))^(-1)
```

Where:
- `m = 2^p` is the number of registers
- `p` is the precision parameter
- `alpha_m` is a bias correction constant
- `M[j]` is the value in register j

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `precision` | 14 | Log2 of register count (higher = more accurate) |
| `registerCount` | 16384 | Number of registers (2^precision) |

### Sparse/Dense Mode

| Mode | Switch Condition | Memory |
|---|---|---|
| **Sparse** | Cardinality < 25,000 | Stores (key, value) pairs |
| **Dense** | Cardinality >= 25,000 | Full register array |

### Visitor Tracker

The VisitorTracker uses HLL to track unique visitors across multiple dimensions:

| Dimension | What It Tracks | Key |
|---|---|---|
| IP addresses | Unique IPs | `visitors:ip:{timeframe}` |
| Sessions | Unique sessions | `visitors:session:{timeframe}` |
| User agents | Unique UAs | `visitors:ua:{timeframe}` |
| Locations | Unique locations | `visitors:location:{timeframe}` |
| Paths | Unique paths | `visitors:path:{timeframe}` |

### Bias Correction

| Cardinality Range | Correction Method |
|---|---|
| 0 - 5 * m | Linear counting (exact) |
| 5 * m - 2^32 | Standard HLL formula |
| > 2^32 | 64-bit correction |

---

## 3. Markov Chain Sequence Modeling

**Purpose:** Behavioral pattern prediction and anomalous sequence detection.

**Location:** `backend/src/core/markov/MarkovChain.ts`

### Theory

A Markov chain models sequences of events where the probability of the next event depends only on the current state (or previous N states).

**1st Order:** `P(next | current)`
**2nd Order:** `P(next | current, previous)`
**3rd Order:** `P(next | current, previous, prev_previous)`

### Algorithm

```
train(sequence):
  for each state transition (s1, s2):
    transition_count[s1][s2] += 1
    total_count[s1] += 1

predict(current_state):
  return argmax(transition_count[current_state] / total_count[current_state])

anomaly_score(sequence):
  probability = product(P(step_i | context) for each step)
  return 1.0 - probability  // Lower probability = higher anomaly
```

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `order` | 2 | Markov chain order (1, 2, or 3) |
| `smoothing` | 0.01 | Laplace/Lidstone smoothing for unseen transitions |
| `minObservations` | 5 | Minimum observations before prediction |

### Behavioral States (25+ action types)

| Category | Actions |
|---|---|
| Navigation | `PAGE_VIEW`, `SEARCH`, `NAVIGATE`, `SCROLL` |
| Auth | `LOGIN`, `LOGOUT`, `REGISTER`, `PASSWORD_RESET` |
| Data | `FORM_SUBMIT`, `FILE_UPLOAD`, `FILE_DOWNLOAD`, `EXPORT` |
| Suspicious | `SUSPICIOUS_PATH`, `RAPID_FIRE`, `REPEATED_ACTION` |
| Admin | `ADMIN_ACCESS`, `CONFIG_CHANGE`, `USER_MANAGEMENT` |

### Analytics

The MarkovAnalytics engine provides:
- Transition probability matrices (interpretable as heatmaps)
- Most/least likely sequences
- Pattern drift detection
- User journey clustering
- Abandonment analysis

---

## 4. EWMA (Exponential Weighted Moving Average)

**Purpose:** Baseline adaptation with trend detection.

**Location:** `backend/src/core/ewma/EWMA.ts`

### Theory

EWMA gives more weight to recent observations, allowing the baseline to adapt to changes while smoothing noise.

### Simple EWMA

```
baseline(t) = alpha * observation(t) + (1 - alpha) * baseline(t-1)
```

### Double EWMA (Holt's Method)

```
level(t) = alpha * observation(t) + (1 - alpha) * (level(t-1) + trend(t-1))
trend(t) = beta * (level(t) - level(t-1)) + (1 - beta) * trend(t-1)
forecast(h) = level(t) + h * trend(t)
```

### Adaptive EWMA

```
alpha(t) = 1 / (1 + (observation(t) - baseline(t-1))^2 / variance(t))
```

Adaptive EWMA automatically adjusts the smoothing parameter based on prediction error — it smooths more during stable periods and reacts faster during volatile periods.

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `alpha` | 0.3 | Smoothing factor (Simple EWMA) |
| `beta` | 0.1 | Trend smoothing factor (Double EWMA) |
| `minSamples` | 30 | Minimum samples before reliable |
| `windows` | [1, 5, 15, 60] | Multi-window analysis (minutes) |

### Multi-Window Analysis

```
Running EWMA at 1-minute, 5-minute, 15-minute, and 60-minute windows
Consensus anomaly = majority vote across windows
```

### Statistical Models

| Model | Method | Use Case |
|---|---|---|
| Z-Score | (observed - mean) / std | Outlier detection |
| IQR | Q3 - Q1, outliers beyond 1.5*IQR | Robust anomaly |
| Volatility | Rolling standard deviation | Regime change detection |
| Spike Detection | Threshold based on EWMA forecast error | Sudden jumps |

---

## 5. Adaptive Rate Limiting

**Purpose:** Dynamic rate limiting that adapts to threat context.

**Location:** `backend/src/core/rateLimit/`

### Algorithms

| Algorithm | File | Description |
|---|---|---|
| Token Bucket | RateLimitPolicies.ts | Fixed rate with burst allowance |
| Sliding Window | RateLimitPolicies.ts | Smooth window-based counting |
| Adaptive Hybrid | AdaptiveRateLimiter.ts | Switches between algorithms based on load |

### Rate Limit Dimensions

| Dimension | What It Limits | Configuration |
|---|---|---|
| **Global** | All traffic | `GLOBAL_RATE_LIMIT` |
| **Per-IP** | Individual source IPs | `IP_RATE_LIMIT` |
| **Per-User** | Authenticated users | `USER_RATE_LIMIT` |
| **Geographic** | By country/region | `GEO_RATE_LIMITS` |
| **Temporal** | By time of day/week | `TEMPORAL_RATE_LIMITS` |
| **Endpoint** | By API endpoint | `ENDPOINT_RATE_LIMITS` |

### Dynamic Adjustment

Based on threat score, rate limits are automatically reduced:

| Threat Level | Rate Reduction |
|---|---|
| None (score < 0.3) | 0% (normal) |
| Low (0.3-0.5) | 25% |
| Medium (0.5-0.7) | 50% |
| High (0.7-0.85) | 75% |
| Critical (> 0.85) | 90% |

### User Trust Scoring

Rate limits vary per user based on trust score:

| User Type | Trust | Rate Multiplier |
|---|---|---|
| New | 0.3 | 0.5x |
| Returning | 0.6 | 1.0x |
| Verified | 0.8 | 1.5x |
| Trusted | 0.95 | 2.0x |

---

## 6. Graduated Response Tiers

**Purpose:** Automated threat response with escalation.

**Location:** `backend/src/core/response/`

### Response Tiers

| Tier | Name | Actions |
|---|---|---|
| 1 | Monitor | Log, track, no user-facing action |
| 2 | Warn | Log, notify user, CAPTCHA |
| 3 | Restrict | Rate limit, limit endpoint access |
| 4 | Block | Block request, alert admin |
| 5 | Isolate | Divert to deception environment |

### Response Actions

| Action | Description | When |
|---|---|---|
| `log` | Record the event | Always |
| `rate-limit` | Reduce request rate | Tier 3+ |
| `challenge` | CAPTCHA or MFA challenge | Tier 2+ |
| `block` | Return 403, block IP temporarily | Tier 4 |
| `redirect` | Send to deception environment | Tier 5 |
| `alert` | Notify security team | Tier 3+ |

### Escalation Logic

```
exposure = threat_score * (1 + repeat_violations * escalation_rate)
if exposure > tier_threshold:
    escalate to next tier
```

---

## 7. Risk Scoring Engine

**Purpose:** Context-aware threat scoring with explainable contributions.

**Location:** `backend/src/core/RiskScoringEngine.ts`

### Score Formula

```
base_score = behavioral * w_behavior + statistical * w_stat + relationship * w_rel

contextual_score = base_score * product(context_multipliers)

final_score = clamp(contextual_score, 0.0, 1.0)
```

### Context Multiplier Categories

| Category | Factors | Range |
|---|---|---|
| Temporal | off-hours, weekend, high-frequency, nighttime, peak hours | 0.8x - 1.5x |
| Geographic | high-risk country, VPN, proxy, Tor, known location | 0.9x - 1.8x |
| Behavioral | new user, suspicious, bot-like, rapid nav, inconsistent device | 0.8x - 1.8x |
| Session | unauthenticated, short session, high error, privileged, anonymous | 0.9x - 1.4x |
| Network | known threat, datacenter origin, poor reputation, new infra | 0.8x - 2.0x |

### Contributing Factors

Each risk assessment returns an ordered list of factors that contributed to the score, enabling explainable decisions:

```json
{
  "factor": "geographic:high_risk_country",
  "weight": 0.3,
  "impact": 0.15,
  "description": "Request originated from a high-risk country (Russia)"
}
```

---

## 8. Machine Learning Model

**Purpose:** Neural network threat classification.

**Location:** `backend/src/core/ThreatDetectionEngine.ts`

### Architecture

```typescript
Input(20) -> Dense(64, ReLU) -> Dropout(0.3) -> Dense(32, ReLU) -> Dropout(0.2) -> Dense(16, ReLU) -> Dense(1, Sigmoid)
```

### Features (20 total)

| Group | Features |
|---|---|
| Behavioral (3) | behavioral_score, user_type, navigation_anomaly |
| Statistical (3) | statistical_score, z_score, deviation_from_baseline |
| Relationship (3) | relationship_score, ip_correlation, coordinated_attack_prob |
| Context (11) | time_of_day, day_of_week, geographic_risk, vpn_detected, session_age, auth_status, error_rate, request_frequency, device_consistency, ip_reputation, threat_intel_match |

### Training

| Parameter | Value |
|---|---|
| Optimizer | Adam (lr=0.001) |
| Loss | Binary Crossentropy |
| Batch Size | 32 |
| Epochs | 10 |
| Validation Split | 0.2 |
