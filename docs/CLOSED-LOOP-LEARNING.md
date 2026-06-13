# Closed-Loop Learning & ML Pipeline

## Core Concept

The closed-loop learning process is what transforms PHANTOM-Flow from a static security tool into an **adaptive defense system**. Every decision feeds back into the model, making future decisions better.

## The Learning Loop

```
       +---------------------------------------------------+
       |                                                   |
       v                                                   |
+-------------+     +-------------+     +-------------+    |
|  Observe    | --> |  Analyze    | --> |  Decide     |    |
|  (Request)  |     |  (Engines)  |     |  (Action)   |    |
+-------------+     +-------------+     +-------------+    |
                                             |             |
                                             v             |
                                       +-------------+     |
                                       |  Respond    |     |
                                       |  (Execute)  |     |
                                       +-------------+     |
                                             |             |
                                             v             |
                                       +-------------+     |
                                       |  Observe    |     |
                                       |  Outcome    |     |
                                       +-------------+     |
                                             |             |
                                             v             |
                                       +-------------+     |
                                       |  Update     | ----+
                                       |  Model      |
                                       +-------------+
```

## Feedback Examples

### Example 1: CAPTCHA Challenge

```
1. User makes request with suspicious pattern (score: 0.65)
2. System challenges with CAPTCHA
3a. User passes CAPTCHA
    -> Model learns: "Likely legitimate, pattern was coincidence"
    -> User's behavioral baseline updated
3b. User fails CAPTCHA (or bypasses)
    -> Model learns: "Suspicious pattern confirmed"
    -> User's risk score increases permanently
```

### Example 2: Deception Diversion

```
1. User scores 0.88 on threat detection (critical)
2. System diverts to honeypot environment
3. User immediately:
   3a. Leaves the honeypot -> "False positive, no attack"
   3b. Starts probing for vulnerabilities
       -> Records: commands, tools, target patterns
       -> Model learns: "Confirmed attacker, TTPs logged"
       -> Signature database updated with new patterns
       -> Training data enriched with real attack data
```

### Example 3: Rate Limiting Feedback

```
1. IP X exceeds rate limit threshold
2. Rate limited to 10 req/min
3a. Traffic drops to normal -> "Was likely a burst, no threat"
3b. Traffic continues at limit with same pattern
    -> "Bot-like behavior confirmed"
    -> Rate limit policy tightened for this IP
```

## Machine Learning Architecture

### TensorFlow.js Neural Network

```typescript
Model Architecture:
  Input: 20 features
    - Behavioral score (3 features)
    - Statistical score (3 features)
    - Relationship score (3 features)
    - Context features (11 features: temporal, geographic, session, device)

  Layers:
    - Dense(64, ReLU) + Dropout(0.3)
    - Dense(32, ReLU) + Dropout(0.2)
    - Dense(16, ReLU)
    - Dense(1, Sigmoid)

  Output: Threat probability [0.0 - 1.0]

  Training:
    - Optimizer: Adam (lr=0.001)
    - Loss: BinaryCrossentropy
    - Metrics: Accuracy
    - Batch size: 32
    - Epochs: 10
```

### Model States

| State | Description |
|---|---|
| **Untrained** | Initial model with random weights |
| **Training** | Actively being trained on collected data |
| **Active** | Loaded and used for inference |
| **Stale** | Performance below threshold, needs retraining |
| **Archived** | Previous version kept for comparison |

### Retraining Triggers

| Trigger | Condition | Action |
|---|---|---|
| Periodic | Every MODULE_UPDATE_INTERVAL (default: 1 hour) | Retrain on recent data |
| Performance drop | Accuracy < 90% | Immediate retraining |
| New attack data | Deception recording completed | Incremental update |
| Manual | Admin request | On-demand retraining |

## Performance Monitoring

The system tracks ML model performance continuously:

| Metric | Target | Warning | Critical |
|---|---|---|---|
| Accuracy | > 95% | < 90% | < 80% |
| Precision | > 90% | < 85% | < 75% |
| Recall | > 90% | < 85% | < 70% |
| F1 Score | > 0.92 | < 0.87 | < 0.75 |
| False Positive Rate | < 5% | > 10% | > 20% |

Metrics are stored in InfluxDB for historical analysis and trend detection.

## Adaptive Learning Service

The `AdaptiveLearningService` orchestrates the entire learning pipeline:

```
class AdaptiveLearningService:
  - start()                # Begin periodic retraining
  - stop()                 # Graceful shutdown
  - retrainModels()        # Execute retraining cycle
  - collectTrainingData()  # Gather feedback from all sources
  - evaluateModel()        # Check performance against targets
  - updateModel()          # Deploy new model version
  - getMetrics()           # Return current performance stats
```

## Data Sources for Training

| Source | Data Type | Volume |
|---|---|---|
| Threat detection results | Scores, features, outcomes | Per-request |
| CAPTCHA challenges | Pass/fail, user behavior | Per-challenge |
| Deception recordings | Attack patterns, TTPs | Per-diversion |
| Rate limit violations | IP patterns, timing | Per-violation |
| Manual feedback | Admin-labeled true/false positives | Per-review |

## Model Versioning

Models are versioned and persisted to disk:

```
models/
  threat-detection-model/
    v1/
      model.json
      weights.bin
      metadata.json   # Training date, accuracy, data count
    v2/
      ...
    current/          # Symlink to active version
      -> v2/
```

## Benefits of Closed-Loop Learning

1. **Improves over time** — The more the system runs, the better it gets
2. **Adapts to new threats** — Novel attack patterns get learned
3. **Reduces false positives** — Legitimate patterns get recognized
4. **Self-healing** — If accuracy drops, retraining triggers automatically
5. **No manual tuning needed** — Baselines and thresholds adapt continuously
