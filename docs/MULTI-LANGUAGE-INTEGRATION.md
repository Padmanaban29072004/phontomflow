# Multi-Language Integration Architecture

## Current State

PHANTOM-Flow's four language components currently operate **independently** — there is no runtime integration between them. This document describes the **intended** integration architecture.

## Intended Communication Model

```
+-------------------+         +-------------------+
|   TypeScript      |  HTTP   |   Go Services     |
|   Backend         | <-----> |   (port 8080)     |
|   (port 3001)     |  REST   |                   |
+--------+----------+         +-------------------+
         |                              |
   HTTP  |  (planned)              HTTP | (planned)
         v                              v
+-------------------+         +-------------------+
|   Python Modules  |         |   Rust Engine     |
|   (port 5000+)    |         |   (port 9000)     |
+-------------------+         +-------------------+
```

## Integration Protocol

### Option 1: HTTP REST (Recommended for most services)

Each language component runs as a standalone HTTP server exposing a uniform API:

| Service | Language | Port | Endpoints |
|---|---|---|---|
| Core Backend | TypeScript | 3001 | All API routes |
| Security Server | Go | 8080 | Threat analysis, signatures |
| Rust Engine | Rust | 9000 | Packet analysis, crypto |
| ML Threat Detection | Python | 5000 | ML inference |
| Network Forensics | Python | 5001 | PCAP analysis |
| Penetration Testing | Python | 5002 | Vulnerability scanning |
| Smart Contract Audit | Python | 5003 | Contract analysis |
| Quantum Security | Python | 5004 | Quantum threat assessment |

### Option 2: Message Queue (For high-throughput scenarios)

For real-time packet processing, a message queue provides lower latency:

```
Rust (Packet Capture)
  |
  v
NATS / RabbitMQ
  |
  +--> Go (Threat Analysis)
  +--> TypeScript (Alerting)
  +--> Python (ML Inference)
```

### Option 3: gRPC (For performance-critical paths)

For sub-millisecond communication between Rust and Go:

```
Rust Engine  <--gRPC-->  Go Network Monitor  <--gRPC-->  TypeScript Backend
```

## API Contracts

### Standard Request Format (All Languages)

```json
{
  "requestId": "uuid",
  "timestamp": "ISO8601",
  "source": "language_component_name",
  "data": { }
}
```

### Standard Response Format

```json
{
  "requestId": "uuid",
  "success": true,
  "processingTime": 2.3,
  "result": { },
  "error": null
}
```

### Shared Data Types

**ThreatAnalysisRequest:**
```json
{
  "ipAddress": "string",
  "userAgent": "string",
  "requestPath": "string",
  "method": "string",
  "headers": {},
  "payload": "string",
  "sessionId": "string",
  "geolocation": {
    "country": "string",
    "region": "string",
    "city": "string"
  }
}
```

**ThreatAnalysisResponse:**
```json
{
  "threatScore": 0.0 - 1.0,
  "confidence": 0.0 - 1.0,
  "riskLevel": "low|medium|high|critical",
  "threatTypes": ["string"],
  "recommendations": ["string"],
  "processingTime": 2.3
}
```

## Component-Specific Integration Points

### TypeScript <-> Rust

The Rust engine exposes a shared library via FFI (Foreign Function Interface) or a sidecar HTTP server:

```typescript
// TypeScript calls Rust for crypto analysis
const cryptoResult = await rustClient.analyzeCrypto(payload);

// Rust function signature (if FFI):
// analyze_crypto(data: &[u8]) -> Result<CryptoAnalysis, CryptoError>
```

### TypeScript <-> Python

Python modules run as microservices with REST endpoints:

```typescript
// TypeScript calls Python ML model
const mlScore = await pythonClient.post('http://localhost:5000/predict', features);

// Python Flask/FastAPI endpoint
// @app.post('/predict')
// async def predict(features: Features) -> MLScore
```

### TypeScript <-> Go

Go security server provides a RESTful API for threat analysis:

```typescript
// TypeScript calls Go for additional analysis
const goAnalysis = await goClient.post('http://localhost:8080/api/v1/analyze', request);

// Go Gin handler
// POST /api/v1/analyze -> handleThreatAnalysis
```

## Deployment Topology

### Development Setup (Single Machine)

```
+-------------------------------+
|  localhost                     |
|                               |
|  :3001  TypeScript Backend    |
|  :8080  Go Security Server    |
|  :9000  Rust Engine           |
|  :5000  Python ML Service     |
|  :27017 MongoDB               |
|  :6379  Redis                 |
|  :8086  InfluxDB              |
+-------------------------------+
```

### Production Setup (Distributed)

```
+------------------+   +------------------+
|  Load Balancer    |   |  Load Balancer   |
+--------+---------+   +--------+---------+
         |                       |
+--------v---------+   +--------v---------+
| TypeScript Pods  |   | Go Service Pods  |
| (Kubernetes)     |   | (Kubernetes)     |
+--------+---------+   +--------+---------+
         |                       |
         v                       v
+--------+---------+   +--------+---------+
| MongoDB + Redis   |   | PostgreSQL       |
+------------------+   +------------------+

+------------------+   +------------------+
| Rust Engine Pods |   | Python ML Pods   |
| (Kubernetes)     |   | (Kubernetes)     |
+------------------+   +------------------+
```

## Configuration

Environment variables control which integration paths are active:

```
# Enable/Disable multi-language integration
ENABLE_RUST_ENGINE=false
ENABLE_GO_SERVICES=false
ENABLE_PYTHON_MODULES=false

# Service URLs
RUST_ENGINE_URL=http://localhost:9000
GO_SERVER_URL=http://localhost:8080
PYTHON_ML_URL=http://localhost:5000

# Timeouts
INTEGRATION_TIMEOUT_MS=5000
```

## Security Considerations

1. **All inter-service communication must use TLS** in production
2. **API keys or JWT tokens** for service authentication
3. **Rate limiting** on integration endpoints to prevent cascading failures
4. **Circuit breakers** for each integration point (fail-open or fail-closed)
5. **Timeouts** to prevent one slow service from blocking the pipeline
6. **Input validation** at every service boundary
