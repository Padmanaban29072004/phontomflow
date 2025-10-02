# 🛡️ PHANTOM-Flow Backend

> **Smart Adaptive Defense System** - A next-generation cybersecurity platform that combines machine learning, behavioral analysis, and deception technology to protect modern applications.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active%20Development-brightgreen.svg)]()
[![Implementation](https://img.shields.io/badge/Implementation-72%25%20Complete-blue.svg)]()
[![MongoDB](https://img.shields.io/badge/MongoDB-Optional-yellow.svg)]()
[![Redis](https://img.shields.io/badge/Redis-Optional-yellow.svg)]()

## 🚀 Quick Start

> **✨ New!** The backend now runs perfectly in development mode without MongoDB or Redis! Perfect for immediate testing and development.

### Prerequisites

**Required:**
- **Node.js** 18.0.0 or higher
- **npm** or **yarn** package manager
- **Git** for version control

**Optional (for full features):**
- **MongoDB** 6.0+ (for persistent data storage)
- **Redis** 6.0+ (for caching and session management)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd phantom-flow/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

5. **Access the API**
   - **Health Check**: http://localhost:3001/health
   - **Dashboard**: http://localhost:3001/api/dashboard
   - **API Documentation**: http://localhost:3001/api/docs

## 🎯 Backend Features

### 🛡️ **Core Defense Engine**

#### **Threat Detection Engine** (`ThreatDetectionEngine.ts`)
- **Multi-Perspective Analysis**: Combines behavioral, statistical, and relationship analysis
- **Machine Learning Integration**: TensorFlow.js neural network for threat classification
- **Real-Time Assessment**: Sub-second threat evaluation and scoring
- **Risk Level Classification**: Low, Medium, High, Critical threat categorization
- **Confidence Scoring**: ML model confidence levels for each assessment
- **Threat Type Identification**: Automatic classification of threat types
- **Recommendation Engine**: AI-powered security recommendations
- **Model Persistence**: Saves and loads trained ML models
- **Feature Engineering**: Automatic feature extraction and processing

#### **Behavioral Analyzer** (`BehavioralAnalyzer.ts`)
- **User Behavior Profiling**: Tracks user interaction patterns and session analysis
- **Session Monitoring**: Real-time session duration and pattern analysis
- **Interaction Tracking**: Monitors user actions and behavior sequences
- **Anomaly Detection**: Identifies suspicious behavioral patterns
- **Risk Scoring**: Calculates behavioral risk scores based on patterns
- **Pattern Recognition**: Learns normal user behavior patterns
- **Session Fingerprinting**: Unique session identification and tracking
- **Behavioral Baseline**: Establishes normal user behavior baselines
- **Real-Time Analysis**: Instant behavioral pattern analysis

#### **Statistical Analyzer** (`StatisticalAnalyzer.ts`)
- **Traffic Pattern Analysis**: Real-time request pattern and frequency monitoring
- **Baseline Learning**: Establishes and maintains normal traffic patterns
- **Anomaly Detection**: Identifies statistical deviations from baseline
- **Performance Metrics**: Tracks system performance and response times
- **Request Rate Monitoring**: Analyzes request frequency and patterns
- **Error Rate Analysis**: Monitors and analyzes error patterns
- **Statistical Modeling**: Advanced statistical models for threat detection
- **Real-Time Statistics**: Live statistical analysis and reporting
- **Threshold Management**: Configurable anomaly detection thresholds

#### **Relationship Analyzer** (`RelationshipAnalyzer.ts`)
- **Network Graph Analysis**: Maps IP addresses and user relationships
- **Geographic Clustering**: Groups threats by geographical location
- **Coordinated Attack Detection**: Identifies multi-source attack campaigns
- **IP Correlation**: Analyzes relationships between different IP addresses
- **User Relationship Mapping**: Tracks connections between user accounts
- **Temporal Analysis**: Time-based relationship pattern analysis
- **Threat Intelligence Correlation**: Integrates with external threat data
- **Graph Database Support**: Advanced graph-based relationship analysis
- **Real-Time Correlation**: Live relationship pattern detection

### 🤖 **Machine Learning & AI**

#### **Adaptive Learning Service** (`AdaptiveLearningService.ts`)
- **Continuous Model Training**: Automatic model retraining with new data
- **Performance Monitoring**: Tracks model accuracy, precision, recall, and F1-score
- **Training Data Management**: Collects and manages training datasets
- **Model Versioning**: Maintains multiple model versions for comparison
- **Automatic Retraining**: Scheduled model updates based on performance
- **Data Quality Assessment**: Validates training data quality
- **Model Performance Metrics**: Comprehensive ML model evaluation
- **Training Data Persistence**: Stores training data in Redis with TTL
- **Model Performance Tracking**: Historical model performance analysis
- **Retraining Triggers**: Configurable retraining conditions

#### **TensorFlow.js Integration**
- **Neural Network Models**: Deep learning models for threat classification
- **Real-Time Inference**: Instant threat assessment using trained models
- **Model Persistence**: Saves and loads trained models
- **Feature Engineering**: Automatic feature extraction and processing
- **Model Optimization**: Continuous model performance optimization
- **Cross-Platform Support**: Runs on both Node.js and browser environments
- **Model Architecture**: Configurable neural network architectures
- **Training Optimization**: Adam optimizer with binary crossentropy loss
- **Model Validation**: Comprehensive model validation and testing

### 🎭 **Deception Layer (Honeypots)**

#### **Deception Service** (`DeceptionService.ts`)
- **Honeypot Endpoints**: Creates convincing fake endpoints to trap attackers
- **Credential Traps**: Fake login credentials to capture attack attempts
- **Decoy Files**: Fake sensitive files to monitor unauthorized access
- **Fake Admin Panels**: Convincing admin interfaces for attacker diversion
- **Attack Recording**: Silent monitoring and recording of attacker behavior
- **Trap Management**: Dynamic creation and management of deception traps
- **Threat Intelligence Gathering**: Collects valuable attack pattern data
- **Configurable Traps**: Customizable honeypot configurations
- **Real-Time Monitoring**: Live tracking of deception trap access
- **Attack Pattern Analysis**: Analyzes attacker behavior patterns
- **Geographic Tracking**: Maps attacker locations and patterns
- **Temporal Analysis**: Time-based attack pattern analysis
- **Threat Level Assessment**: Evaluates threat levels from deception events

### ⚡ **Real-Time Processing**

#### **Socket.IO Integration**
- **Real-Time Communication**: WebSocket-based live data transmission
- **Live Threat Alerts**: Instant notification of detected threats
- **Dashboard Updates**: Real-time dashboard data updates
- **Event Broadcasting**: Live event broadcasting to connected clients
- **Room Management**: Organized communication channels
- **Connection Management**: Robust connection handling and recovery
- **Real-Time Metrics**: Live system metrics broadcasting
- **Threat Event Streaming**: Real-time threat event streaming
- **Client-Server Communication**: Bidirectional real-time communication

#### **Performance Optimization**
- **Zero-Latency Processing**: Minimal impact on application performance
- **Intelligent Caching**: Redis-based caching for optimal performance
- **Request Prioritization**: Smart request handling based on threat levels
- **Resource Optimization**: Efficient resource utilization
- **Load Balancing**: Intelligent traffic distribution
- **Response Time Optimization**: Optimized API response times
- **Memory Management**: Efficient memory usage and garbage collection
- **Connection Pooling**: Optimized database and Redis connections

### 🔒 **Security Features**

#### **Authentication & Authorization**
- **JWT Token Management**: Secure token-based authentication
- **Session Management**: Robust session handling and validation
- **Role-Based Access Control**: Granular permission management
- **Token Refresh**: Automatic token renewal mechanisms
- **Secure Password Handling**: Bcrypt-based password security
- **Multi-Factor Authentication Support**: Extensible MFA framework
- **Token Validation**: Comprehensive JWT token validation
- **Session Persistence**: Redis-based session storage
- **Access Control**: Fine-grained access control mechanisms

#### **Request Protection**
- **Rate Limiting**: Intelligent rate limiting with configurable thresholds
- **DDoS Protection**: Advanced DDoS attack detection and mitigation
- **Input Validation**: Comprehensive request validation and sanitization
- **CORS Protection**: Cross-origin resource sharing security
- **Helmet Security**: HTTP security headers implementation
- **Request Logging**: Comprehensive request logging and monitoring
- **Request Sanitization**: Input sanitization and validation
- **Security Headers**: Comprehensive security header implementation
- **Request Filtering**: Advanced request filtering and blocking

### 📊 **API Endpoints**

#### **Authentication Routes** (`auth.ts`)
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/verify` - Token validation
- `GET /api/auth/profile` - User profile management

#### **Threat Management** (`threats.ts`)
- `GET /api/threats` - List all detected threats
- `GET /api/threats/:id` - Get specific threat details
- `POST /api/threats` - Create new threat record
- `PUT /api/threats/:id` - Update threat information
- `DELETE /api/threats/:id` - Remove threat record
- `GET /api/threats/stats/summary` - Threat statistics

#### **Dashboard & Analytics** (`dashboard.ts`)
- `GET /api/dashboard/overview` - System overview and summary
- `GET /api/dashboard/analytics` - Detailed analytics data
- `GET /api/dashboard/recent-activity` - Recent activity feed
- `GET /api/dashboard/system-status` - System health status

#### **Deception Layer** (`deception.ts`)
- `GET /api/deception/events` - Deception event history
- `GET /api/deception/stats` - Deception statistics
- `GET /api/deception/traps` - Active deception traps
- `POST /api/deception/traps` - Create new deception trap
- `PUT /api/deception/traps/:id` - Update deception trap
- `DELETE /api/deception/traps/:id` - Remove deception trap
- `POST /api/deception/trigger` - Manual trap triggering

#### **Metrics & Monitoring** (`metrics.ts`)
- `GET /api/metrics/performance` - System performance metrics
- `GET /api/metrics/threats` - Threat detection metrics
- `GET /api/metrics/analytics` - Analytics metrics
- `GET /api/metrics/ml` - Machine learning metrics
- `GET /api/metrics/real-time` - Real-time system metrics
- `POST /api/metrics/export` - Export metrics data

#### **System Health**
- `GET /health` - Server health check and status

### 🗄️ **Data Management**

#### **Database Service** (`DatabaseService.ts`)
- **MongoDB Integration**: Robust document database for data persistence
- **Connection Management**: Intelligent database connection handling
- **Health Monitoring**: Database health and performance monitoring
- **Data Validation**: Comprehensive data validation and integrity checks
- **Backup Support**: Database backup and recovery capabilities
- **Query Optimization**: Optimized database queries for performance
- **Connection Pooling**: Efficient database connection management
- **Error Handling**: Robust database error handling and recovery
- **Health Checks**: Comprehensive database health monitoring

#### **Redis Service** (`RedisService.ts`)
- **Caching Layer**: High-performance caching for frequently accessed data
- **Session Storage**: Secure session data storage
- **Real-Time Data**: Fast access to real-time system data
- **Data Persistence**: Persistent storage with TTL support
- **Memory Optimization**: Efficient memory usage and management
- **Connection Pooling**: Optimized connection management
- **Data Structures**: Support for strings, hashes, lists, sets, sorted sets
- **TTL Management**: Automatic data expiration management
- **Error Recovery**: Graceful error handling and recovery
- **Performance Monitoring**: Redis performance metrics tracking

### 📈 **Monitoring & Analytics**

#### **Comprehensive Logging**
- **Structured Logging**: Winston-based structured logging system
- **Log Levels**: Configurable log levels (debug, info, warn, error)
- **Log Rotation**: Automatic log rotation and management
- **Performance Logging**: Detailed performance metrics logging
- **Security Logging**: Comprehensive security event logging
- **Audit Trails**: Complete audit trail for all system activities
- **Log Formatting**: Structured JSON log formatting
- **Log Persistence**: Persistent log storage and management
- **Error Tracking**: Comprehensive error tracking and reporting

#### **Real-Time Monitoring**
- **System Metrics**: CPU, memory, disk, and network monitoring
- **Application Metrics**: Response times, throughput, error rates
- **Threat Metrics**: Threat detection accuracy and performance
- **ML Model Metrics**: Machine learning model performance tracking
- **Custom Metrics**: User-defined custom metrics support
- **Performance Tracking**: Real-time performance monitoring
- **Resource Monitoring**: System resource utilization tracking
- **Alert Management**: Configurable alert thresholds and notifications

### 🔧 **Development & Operations**

#### **Development Features**
- **TypeScript Support**: Full TypeScript implementation for type safety
- **Hot Reloading**: Development server with automatic reloading
- **Environment Configuration**: Flexible environment-based configuration
- **Error Handling**: Comprehensive error handling and recovery
- **Debugging Support**: Advanced debugging and logging capabilities
- **Testing Framework**: Built-in testing framework support
- **Code Quality**: ESLint and TypeScript compiler integration
- **Path Aliases**: TypeScript path alias support for clean imports
- **Development Tools**: Nodemon and ts-node for development

#### **Production Features**
- **Process Management**: PM2-based process management
- **Load Balancing**: Built-in load balancing capabilities
- **Health Checks**: Comprehensive health check endpoints
- **Graceful Shutdown**: Proper application shutdown handling
- **Performance Monitoring**: Production performance monitoring
- **Security Hardening**: Production-ready security configurations
- **Environment Management**: Production environment configuration
- **Deployment Support**: Docker and containerization support

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PHANTOM-Flow Backend                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Express   │  │  Socket.IO  │  │   Winston   │         │
│  │   Server    │  │   Real-time │  │   Logging   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Core Defense Engine                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Behavioral │  │ Statistical │  │Relationship │         │
│  │  Analyzer   │  │  Analyzer   │  │  Analyzer   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                  Machine Learning Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │TensorFlow.js│  │   Adaptive  │  │   Threat    │         │
│  │    Model    │  │  Learning   │  │ Detection   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   MongoDB   │  │    Redis    │  │ Deception   │         │
│  │   Service   │  │   Service   │  │  Service    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── api/                 # API routes and controllers
│   │   ├── auth.ts         # Authentication routes
│   │   ├── threats.ts      # Threat management
│   │   ├── dashboard.ts     # Dashboard data
│   │   ├── deception.ts     # Deception layer
│   │   ├── metrics.ts       # System metrics
│   │   └── docs.ts         # API documentation
│   ├── core/               # Core defense engine
│   │   ├── ThreatDetectionEngine.ts
│   │   ├── BehavioralAnalyzer.ts
│   │   ├── StatisticalAnalyzer.ts
│   │   └── RelationshipAnalyzer.ts
│   ├── services/           # Service layer
│   │   ├── DatabaseService.ts
│   │   ├── RedisService.ts
│   │   ├── DeceptionService.ts
│   │   └── AdaptiveLearningService.ts
│   ├── models/             # Data models
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── index.ts            # Main application entry point
├── logs/                   # Application logs
├── dist/                   # Compiled JavaScript (production)
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── nodemon.json            # Development server configuration
└── env.example             # Environment variables template
```

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Check code quality |
| `npm run lint:fix` | Fix code quality issues |

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/phantom-flow
REDIS_URL=redis://localhost:6379

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret

# Feature Flags
HONEYPOT_ENABLED=true
ADAPTIVE_LEARNING_ENABLED=true

# Machine Learning Configuration
MODEL_UPDATE_INTERVAL=60
MIN_DATA_POINTS=100
LEARNING_RATE=0.001
BATCH_SIZE=32
EPOCHS=10
```

### Development Mode

The backend can run in **development mode** without external databases:

```bash
# Set environment to development
export NODE_ENV=development

# Start the server
npm run dev
```

In development mode:
- ✅ Server starts without MongoDB/Redis (with optimized timeouts)
- ✅ All features work with fallback values
- ✅ Perfect for development and testing
- ✅ Graceful database connection failure handling
- ✅ Reduced connection retry attempts for faster startup
- ⚠️ Some persistent features are limited

**Recent Improvements (October 2024):**
- 🔧 Fixed database connection timeout issues
- 🔧 Improved Redis connection retry logic for development
- 🔧 Enhanced error handling and graceful fallbacks
- 🔧 Better development mode messaging

## 🔌 API Endpoints

### Health & Status
- `GET /health` - Server health check
- `GET /api/status` - System status and metrics

### Threat Detection
- `POST /api/threat/analyze` - Analyze request for threats
- `GET /api/threat/history` - Get threat history
- `GET /api/threat/stats` - Get threat statistics

### Dashboard
- `GET /api/dashboard` - Main dashboard interface
- `GET /api/dashboard/metrics` - Real-time metrics
- `GET /api/dashboard/alerts` - Security alerts

### Deception Layer
- `GET /admin` - Honeypot endpoint
- `GET /api/admin` - Fake admin panel
- `GET /internal` - Decoy internal system

## 🧪 Testing

### Manual Testing

1. **Health Check**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Threat Analysis**
   ```bash
   curl -X POST http://localhost:3001/api/threat/analyze \
     -H "Content-Type: application/json" \
     -d '{"ip": "192.168.1.1", "userAgent": "Mozilla/5.0..."}'
   ```

3. **Dashboard Access**
   ```bash
   curl http://localhost:3001/api/dashboard
   ```

### Automated Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testNamePattern="ThreatDetection"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Port Already in Use**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3001
kill -9 <PID>
```

#### 2. **Database Connection Timeout**
```bash
# The server now handles database failures gracefully in development mode
# You'll see warnings but the server will continue running:
# "⚠️ MongoDB not available - running in development mode without database"
# "⚠️ Redis not available - running in development mode without cache"
```

#### 3. **TypeScript Compilation Errors**
```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

#### 4. **Database Connection Issues**
```bash
# Check if MongoDB is running
mongod --version

# Check if Redis is running
redis-server --version
```

#### 5. **Permission Issues**
```bash
# Fix npm permissions
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP ~/.config
```

### Development Mode

If you don't have MongoDB or Redis installed:

```bash
# The server will run in development mode automatically
export NODE_ENV=development
npm run dev
```

You'll see warnings about missing databases, but the server will continue running with limited functionality.

## 📊 Monitoring & Logs

### Log Files
- **Application Logs**: `logs/app.log`
- **Error Logs**: `logs/error.log`
- **Access Logs**: `logs/access.log`

### Real-time Monitoring
- **Dashboard**: http://localhost:3001/api/dashboard
- **Health Check**: http://localhost:3001/health
- **Metrics**: http://localhost:3001/api/metrics

## 🔧 Development

### Code Style
```bash
# Check code quality
npm run lint

# Fix code quality issues
npm run lint:fix
```

### Adding New Features
1. Create feature branch: `git checkout -b feature/new-feature`
2. Implement changes in `src/` directory
3. Add tests in `__tests__/` directory
4. Run tests: `npm test`
5. Submit pull request

### Debugging
```bash
# Enable debug logging
DEBUG=* npm run dev

# Use Node.js debugger
node --inspect-brk dist/index.js
```

## 📈 Performance

### Optimization Tips
- Use Redis for caching frequently accessed data
- Implement database connection pooling
- Enable compression middleware
- Use PM2 for production process management

### Monitoring
- Monitor memory usage
- Track response times
- Monitor threat detection accuracy
- Watch for false positives

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Report security issues privately

---

**Built with ❤️ by the PHANTOM-Flow Team**

*Protecting the digital world, one request at a time.*

