# PHANTOM-Flow API Reference

## Base URL

Production: `http://localhost:3001/api`

## Authentication

### POST /api/auth/login
Authenticate a user and receive a JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "secure_password"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "username": "admin",
    "role": "admin"
  }
}
```

### POST /api/auth/logout
Invalidate the current session.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### GET /api/auth/verify
Verify token validity.

**Response (200):**
```json
{
  "valid": true,
  "user": { "id": "user_123", "username": "admin" }
}
```

### GET /api/auth/profile
Get authenticated user profile.

**Response (200):**
```json
{
  "id": "user_123",
  "username": "admin",
  "email": "admin@phantom-flow.com",
  "role": "admin",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## Threat Management

### GET /api/threats
List all detected threats.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `riskLevel` (string: low | medium | high | critical)
- `status` (string: active | resolved | investigating)
- `startDate` (ISO date string)
- `endDate` (ISO date string)

**Response (200):**
```json
{
  "threats": [
    {
      "id": "threat_001",
      "threatScore": 0.92,
      "confidence": 0.95,
      "riskLevel": "critical",
      "threatType": ["malicious_behavior", "suspicious_pattern"],
      "ipAddress": "203.0.113.42",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2024-01-15T03:22:10Z",
      "status": "active"
    }
  ],
  "total": 156,
  "page": 1,
  "totalPages": 4
}
```

### GET /api/threats/recent
Get recent threats for dashboard display.

**Response (200):**
```json
[
  {
    "id": "threat_001",
    "threatScore": 0.92,
    "riskLevel": "critical",
    "ipAddress": "203.0.113.42",
    "timestamp": "2024-01-15T03:22:10Z",
    "threatType": ["malicious_behavior"],
    "status": "active"
  }
]
```

### GET /api/threats/stats/summary
Get threat statistics.

**Response (200):**
```json
{
  "totalThreats": 1250,
  "criticalCount": 45,
  "highCount": 230,
  "mediumCount": 520,
  "lowCount": 455,
  "activeCount": 67,
  "resolvedCount": 1183,
  "topThreatTypes": [
    {"type": "suspicious_pattern", "count": 450},
    {"type": "malicious_behavior", "count": 320}
  ]
}
```

### GET /api/threats/:id
Get specific threat details.

**Response (200):**
```json
{
  "id": "threat_001",
  "threatScore": 0.92,
  "confidence": 0.95,
  "riskLevel": "critical",
  "threatType": ["malicious_behavior", "suspicious_pattern"],
  "recommendations": ["Immediate blocking recommended"],
  "ipAddress": "203.0.113.42",
  "userAgent": "Mozilla/5.0...",
  "requestPath": "/api/admin",
  "requestMethod": "POST",
  "timestamp": "2024-01-15T03:22:10Z",
  "status": "active",
  "scoringBreakdown": {
    "behavioral": 0.85,
    "statistical": 0.78,
    "relationship": 0.92,
    "contextualAdjustment": 0.05
  }
}
```

---

## Dashboard & Analytics

### GET /api/dashboard/metrics
Get current dashboard metrics.

**Response (200):**
```json
{
  "totalRequests": 1584320,
  "threatsDetected": 1250,
  "falsePositives": 63,
  "averageResponseTime": 2.3,
  "accuracy": 94.8,
  "activeThreats": 67,
  "blockedAttacks": 892,
  "systemHealth": 97
}
```

### GET /api/dashboard/status
Get system status information.

**Response (200):**
```json
{
  "status": "healthy",
  "uptime": 3600000,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "connected",
    "redis": "connected",
    "mlModel": "active",
    "deceptionLayer": "enabled"
  }
}
```

### GET /api/dashboard/alerts
Get system alerts.

**Response (200):**
```json
[
  {
    "id": "alert_001",
    "type": "threat",
    "severity": "critical",
    "message": "Coordinated attack detected from 3 IPs",
    "timestamp": "2024-01-15T03:22:10Z",
    "acknowledged": false
  }
]
```

### GET /api/dashboard/recent-activity
Get recent activity feed.

**Response (200):**
```json
[
  {
    "type": "threat_detected",
    "description": "Critical threat from 203.0.113.42",
    "timestamp": "2024-01-15T03:22:10Z"
  }
]
```

---

## Deception Layer

### GET /api/deception/events
Get deception event history.

**Response (200):**
```json
[
  {
    "id": "deception_001",
    "type": "honeypot_access",
    "endpoint": "/admin",
    "ipAddress": "203.0.113.42",
    "timestamp": "2024-01-15T03:22:10Z",
    "duration": 45000,
    "actions": ["probe_endpoint", "upload_file"],
    "threatScore": 0.92
  }
]
```

### GET /api/deception/stats
Get deception statistics.

**Response (200):**
```json
{
  "totalEvents": 89,
  "activeTraps": 12,
  "attackersTracked": 45,
  "ttpRecorded": 234,
  "mostTargetedEndpoint": "/admin"
}
```

### GET /api/deception/traps
List active deception traps.

**Response (200):**
```json
{
  "traps": [
    {
      "id": "trap_001",
      "type": "honeypot",
      "endpoint": "/admin",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "timesAccessed": 23
    }
  ]
}
```

### POST /api/deception/traps
Create a new deception trap.

**Request:**
```json
{
  "type": "honeypot",
  "endpoint": "/api/internal",
  "config": {
    "fakeData": true,
    "credentialTrap": true
  }
}
```

**Response (201):**
```json
{
  "id": "trap_002",
  "status": "active",
  "createdAt": "2024-01-15T04:00:00Z"
}
```

---

## Metrics & Monitoring

### GET /api/metrics/performance
Get system performance metrics.

**Response (200):**
```json
{
  "cpuUsage": 45.2,
  "memoryUsage": 1024,
  "requestRate": 250,
  "averageLatency": 2.3,
  "errorRate": 0.02
}
```

### GET /api/metrics/threats
Get threat detection metrics.

**Response (200):**
```json
{
  "detectionAccuracy": 94.8,
  "falsePositiveRate": 5.2,
  "averageResponseTime": 2.3,
  "threatsPerMinute": 12,
  "mlModelAccuracy": 96.2
}
```

### GET /api/metrics/real-time
Get real-time metrics stream.

**Response (200):**
```json
{
  "currentRequestsPerSecond": 45,
  "activeSessions": 1230,
  "threatsThisMinute": 3,
  "averageLatency": 2.1
}
```

---

## System Health

### GET /health
Server health check.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T04:00:00Z",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## WebSocket Events

### Connection
`ws://localhost:3001`

### Client Events

| Event | Payload | Description |
|---|---|---|
| `join-dashboard` | `{}` | Join dashboard room for updates |

### Server Events

| Event | Payload | Description |
|---|---|---|
| `threat-update` | `ThreatAlert` | New threat detected |
| `metrics-update` | `DashboardMetrics` | Periodic metrics refresh |
| `deception-update` | `{ type: string }` | Deception event occurred |

### ThreatAlert Payload
```json
{
  "id": "threat_001",
  "threatScore": 0.92,
  "riskLevel": "critical",
  "ipAddress": "203.0.113.42",
  "threatType": ["malicious_behavior"],
  "status": "active",
  "timestamp": "2024-01-15T03:22:10Z"
}
```
