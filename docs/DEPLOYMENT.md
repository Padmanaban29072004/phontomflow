# PHANTOM-Flow Deployment Guide

## Prerequisites

### Core Requirements
- **Node.js** v18 or higher
- **npm** or **yarn**
- **MongoDB** v6 or higher (optional for development)
- **Redis** v6 or higher (optional for development)

### Optional (for multi-language features)
- **Python** v3.8 or higher
- **Go** v1.19 or higher
- **Rust** v1.70 or higher
- **InfluxDB** v1.8 or higher (for time-series metrics)

## Quick Start (Development)

### 1. Clone and Install

```bash
cd phantom-flow

# Backend (required)
cd backend
npm install
cd ..

# Frontend (optional - for web dashboard)
cd frontend
npm install
cd ..

# Python dependencies (optional)
pip install -r requirements.txt

# Go dependencies (optional)
go mod tidy

# Rust dependencies (optional)
cargo build --release
```

### 2. Environment Configuration

```bash
cd backend
cp env.example .env
```

Edit `.env`:

```env
# Server
NODE_ENV=development
PORT=3001
HOST=localhost

# Database (optional in dev)
MONGODB_URI=mongodb://localhost:27017/phantom-flow
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ML Model
MODEL_UPDATE_INTERVAL=3600000
ANOMALY_DETECTION_THRESHOLD=0.8
BEHAVIOR_ANALYSIS_WINDOW=300000

# Deception Layer
HONEYPOT_ENABLED=true
DECEPTION_LEVEL=medium
ATTACK_RECORDING_ENABLED=true

# Performance
METRICS_ENABLED=true
PERFORMANCE_MONITORING_INTERVAL=60000
```

### 3. Run

```bash
# Development mode (backend)
cd backend
npm run dev

# Development mode (frontend)
cd frontend
npm start
```

**Access Points:**
- Backend API: `http://localhost:3001`
- Dashboard: `http://localhost:3001/api/dashboard`
- Frontend: `http://localhost:3000`

## Development Mode Features

When `NODE_ENV=development`, the server:
- Runs without MongoDB/Redis if not available (graceful fallback)
- Uses shorter connection timeouts (2s instead of 10s)
- Logs warnings about missing databases
- Shows error details in responses

## Production Deployment

### Build

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Start

```bash
# Production
cd backend
npm start

# Or with PM2 (recommended)
pm2 start dist/index.js --name phantom-flow
pm2 save
pm2 startup
```

## Docker Deployment

### Dockerfile (Backend)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/dist ./dist
COPY backend/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/phantom-flow
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped

  mongodb:
    image: mongo:7
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
```

## Kubernetes Deployment

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: phantom-flow-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: phantom-flow-backend
  template:
    metadata:
      labels:
        app: phantom-flow-backend
    spec:
      containers:
      - name: backend
        image: phantom-flow-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: phantom-flow-secrets
              key: mongodb-uri
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: phantom-flow-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: phantom-flow-backend
spec:
  selector:
    app: phantom-flow-backend
  ports:
  - port: 3001
    targetPort: 3001
```

## Environment Variables Reference

### Server Configuration
| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | Server port |
| `HOST` | `localhost` | Server host |

### Database Configuration
| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/phantom-flow` | MongoDB connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |

### Authentication
| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | - | JWT signing key |
| `JWT_EXPIRES_IN` | `24h` | Token expiration |
| `BCRYPT_ROUNDS` | `12` | Password hash rounds |

### Rate Limiting
| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

### ML Model
| Variable | Default | Description |
|---|---|---|
| `MODEL_UPDATE_INTERVAL` | `3600000` | Retraining interval (1 hour) |
| `ANOMALY_DETECTION_THRESHOLD` | `0.8` | Anomaly threshold |
| `BEHAVIOR_ANALYSIS_WINDOW` | `300000` | Behavior window (5 min) |

### Deception Layer
| Variable | Default | Description |
|---|---|---|
| `HONEYPOT_ENABLED` | `true` | Enable deception |
| `DECEPTION_LEVEL` | `medium` | Deception intensity |
| `ATTACK_RECORDING_ENABLED` | `true` | Record attacker behavior |

### Metrics
| Variable | Default | Description |
|---|---|---|
| `METRICS_ENABLED` | `true` | Enable metrics collection |
| `PERFORMANCE_MONITORING_INTERVAL` | `60000` | Metrics interval (1 min) |
| `INFLUXDB_URL` | - | InfluxDB connection |
| `INFLUXDB_TOKEN` | - | InfluxDB auth token |
| `INFLUXDB_ORG` | `phantom-flow` | InfluxDB organization |
| `INFLUXDB_BUCKET` | `phantom-flow` | InfluxDB bucket |

## Monitoring

### Health Check
```
GET /health
Response: { "status": "healthy", "timestamp": "...", "version": "1.0.0" }
```

### Logs
- Backend logs: `backend/logs/`
- Error logs: `backend/logs/error.log`
- Combined logs: `backend/logs/combined.log`

## Troubleshooting

### Backend Won't Start
1. Check if MongoDB/Redis are running
2. Verify environment variables in `.env`
3. Check logs: `backend/logs/error.log`
4. Try `NODE_ENV=development` mode (works without databases)

### Frontend Connection Issues
1. Verify backend is running on correct port
2. Check CORS configuration
3. Verify `REACT_APP_API_URL` environment variable

### Database Connection Issues
1. Verify MongoDB/Redis services are running
2. Check connection strings in `.env`
3. Verify network connectivity
