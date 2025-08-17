# PHANTOM-Flow Setup Guide

## 🚀 Quick Start

PHANTOM-Flow is a smart, adaptive defense system that combines multiple threat detection perspectives into a single, powerful defense engine. This guide will help you set up and run the system.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (v6 or higher)
- **Redis** (v6 or higher)
- **Git**

### Installing Prerequisites

#### Windows
```bash
# Install Node.js from https://nodejs.org/
# Install MongoDB from https://www.mongodb.com/try/download/community
# Install Redis from https://github.com/microsoftarchive/redis/releases
```

#### macOS
```bash
# Using Homebrew
brew install node
brew install mongodb-community
brew install redis
```

#### Linux (Ubuntu/Debian)
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Redis
sudo apt-get install redis-server
```

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd phantom-flow
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 4. Environment Configuration

#### Backend Environment
```bash
cd ../backend
cp env.example .env
```

Edit the `.env` file with your configuration:
```env
# Server Configuration
NODE_ENV=development
PORT=3001
HOST=localhost

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/phantom-flow
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# External APIs (Optional)
THREAT_INTELLIGENCE_API_KEY=your-threat-intelligence-api-key
GEOIP_API_KEY=your-geoip-api-key

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/phantom-flow.log

# ML Model Configuration
MODEL_UPDATE_INTERVAL=3600000
ANOMALY_DETECTION_THRESHOLD=0.8
BEHAVIOR_ANALYSIS_WINDOW=300000

# Deception Layer
HONEYPOT_ENABLED=true
DECEPTION_LEVEL=medium
ATTACK_RECORDING_ENABLED=true

# Performance Monitoring
METRICS_ENABLED=true
PERFORMANCE_MONITORING_INTERVAL=60000
```

#### Frontend Environment
```bash
cd ../frontend
cp .env.example .env
```

Edit the `.env` file:
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
REACT_APP_ENVIRONMENT=development
```

### 5. Database Setup

#### Start MongoDB
```bash
# Start MongoDB service
sudo systemctl start mongod
# or on macOS
brew services start mongodb-community
```

#### Start Redis
```bash
# Start Redis service
sudo systemctl start redis
# or on macOS
brew services start redis
```

### 6. Build the Application

#### Backend Build
```bash
cd backend
npm run build
```

#### Frontend Build (Optional for development)
```bash
cd ../frontend
npm run build
```

## 🚀 Running the Application

### Development Mode

#### Start Backend Server
```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:3001`

#### Start Frontend Development Server
```bash
cd frontend
npm start
```

The frontend will start on `http://localhost:3000`

### Production Mode

#### Build for Production
```bash
# Backend
cd backend
npm run build

# Frontend
cd ../frontend
npm run build
```

#### Start Production Server
```bash
cd backend
npm start
```

## 📊 System Architecture

```
PHANTOM-Flow/
├── backend/                 # Core defense engine
│   ├── src/
│   │   ├── core/           # Threat detection algorithms
│   │   │   ├── ThreatDetectionEngine.ts
│   │   │   ├── BehavioralAnalyzer.ts
│   │   │   ├── StatisticalAnalyzer.ts
│   │   │   └── RelationshipAnalyzer.ts
│   │   ├── services/       # Business logic services
│   │   ├── api/           # REST API endpoints
│   │   ├── models/        # Data models
│   │   └── utils/         # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # Web dashboard
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Dashboard pages
│   │   ├── services/      # API integration
│   │   └── contexts/      # React contexts
│   └── package.json
└── README.md
```

## 🔧 Core Components

### 1. Threat Detection Engine
- **Multi-perspective Analysis**: Combines behavioral, statistical, and relationship analysis
- **Machine Learning**: Neural network-based threat classification
- **Real-time Processing**: Instant threat assessment and response
- **Adaptive Learning**: Continuous improvement through feedback loops

### 2. Behavioral Analyzer
- **User Behavior Profiling**: Tracks user interaction patterns
- **Session Analysis**: Monitors session duration and patterns
- **Anomaly Detection**: Identifies suspicious behavioral patterns
- **Risk Scoring**: Calculates behavioral risk scores

### 3. Statistical Analyzer
- **Traffic Pattern Analysis**: Monitors request patterns and frequencies
- **Anomaly Detection**: Identifies statistical anomalies
- **Baseline Learning**: Establishes normal traffic patterns
- **Performance Metrics**: Tracks system performance

### 4. Relationship Analyzer
- **Network Graph Analysis**: Maps IP and user relationships
- **Geographic Clustering**: Groups threats by location
- **Coordinated Attack Detection**: Identifies multi-source attacks
- **Threat Intelligence**: Correlates with external threat data

### 5. Deception Framework
- **Honeypot Environments**: Creates convincing fake environments
- **Attack Recording**: Monitors attacker behavior
- **Threat Intelligence**: Gathers valuable attack insights
- **Safe Isolation**: Protects real systems from threats

## 🎯 Key Features

### Smart Threat Detection
- **Zero-Latency for Legitimate Users**: Minimal impact on application performance
- **High Detection Accuracy**: Advanced algorithms reduce false positives
- **Real-Time Processing**: Instant threat assessment and response
- **Multi-Perspective Analysis**: Combines multiple detection methods

### Adaptive Learning
- **Closed-Loop Learning**: Every decision feeds back into the learning model
- **Continuous Improvement**: System gets better over time
- **Performance Optimization**: Maintains optimal performance
- **Model Retraining**: Automatic model updates

### Deception Layer
- **Dynamic Honeypots**: Convincing fake environments
- **Attack Pattern Recording**: Silent monitoring of attacker behavior
- **Threat Intelligence**: Valuable insights without risking real data
- **Safe Environment Isolation**: Protects real systems

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Session management
- Secure password handling

### Rate Limiting & DDoS Protection
- Intelligent rate limiting
- DDoS attack detection
- Request prioritization
- Resource allocation optimization

### Data Protection
- Request validation and sanitization
- Input/output filtering
- Secure data transmission
- Privacy compliance

## 📈 Monitoring & Analytics

### Real-Time Dashboard
- Live threat monitoring
- System performance metrics
- Geographic threat visualization
- Attack pattern analysis

### Performance Metrics
- Response time monitoring
- Throughput analysis
- Error rate tracking
- Resource utilization

### Threat Intelligence
- Attack pattern correlation
- Geographic threat mapping
- Temporal analysis
- Risk assessment scoring

## 🛠️ Configuration Options

### Threat Detection Sensitivity
```env
ANOMALY_DETECTION_THRESHOLD=0.8
BEHAVIOR_ANALYSIS_WINDOW=300000
```

### Performance Tuning
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
PERFORMANCE_MONITORING_INTERVAL=60000
```

### Deception Settings
```env
HONEYPOT_ENABLED=true
DECEPTION_LEVEL=medium
ATTACK_RECORDING_ENABLED=true
```

## 🔍 Troubleshooting

### Common Issues

#### Backend Won't Start
1. Check if MongoDB is running
2. Verify Redis connection
3. Check environment variables
4. Review log files

#### Frontend Connection Issues
1. Verify backend is running on correct port
2. Check CORS configuration
3. Verify API endpoints
4. Check browser console for errors

#### Database Connection Issues
1. Verify MongoDB service is running
2. Check connection string
3. Verify database permissions
4. Check network connectivity

### Log Files
- Backend logs: `backend/logs/`
- Error logs: `backend/logs/error.log`
- Combined logs: `backend/logs/combined.log`

### Performance Optimization
1. Monitor system resources
2. Adjust rate limiting settings
3. Optimize database queries
4. Tune ML model parameters

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Threat Detection Endpoints
- `GET /api/threats/recent` - Get recent threats
- `GET /api/threats/statistics` - Get threat statistics
- `POST /api/threats/analyze` - Analyze specific request

### Dashboard Endpoints
- `GET /api/dashboard/metrics` - Get dashboard metrics
- `GET /api/dashboard/status` - Get system status
- `GET /api/dashboard/alerts` - Get system alerts

### Deception Endpoints
- `POST /api/deception/create` - Create deception environment
- `GET /api/deception/events` - Get deception events
- `POST /api/deception/record` - Record attack behavior

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the troubleshooting guide
- Contact the development team

---

**PHANTOM-Flow**: Turning cybersecurity from reactive catch-up into proactive, intelligence-driven defense.
