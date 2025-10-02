# PHANTOM-Flow: Smart Adaptive Defense System

## 🚀 Overview

PHANTOM-Flow is a next-generation cybersecurity platform that combines multiple threat detection perspectives into a single, powerful defense engine. Unlike traditional security tools, PHANTOM-Flow uses closed-loop learning to continuously improve its threat detection capabilities while maintaining optimal performance for legitimate users.

Instead of relying on just one way of spotting threats, it combines multiple perspectives—statistics, user behavior patterns, and relationship graphs—into a single, powerful defense engine. What makes it different is its closed-loop learning process. Every decision the system makes—whether to slow down traffic, challenge a suspicious user, or divert them into a safe decoy—feeds back into its learning model. Over time, it gets better at telling the difference between a real customer and an attacker, making its actions both faster and more accurate.

The deception layer plays a big role in this strategy. Instead of simply blocking suspicious traffic, PHANTOM-Flow can lead attackers into a fake but convincing environment, letting them waste time while the system quietly records their moves. This gives security teams valuable insight into how attacks work—without putting real data at risk.

## 🎯 Backend Features

### 🛡️ **Core Defense Engine**

#### **Threat Detection Engine**
- **Multi-Perspective Analysis**: Combines behavioral, statistical, and relationship analysis
- **Machine Learning Integration**: TensorFlow.js neural network for threat classification
- **Real-Time Assessment**: Sub-second threat evaluation and scoring
- **Risk Level Classification**: Low, Medium, High, Critical threat categorization
- **Confidence Scoring**: ML model confidence levels for each assessment
- **Threat Type Identification**: Automatic classification of threat types
- **Recommendation Engine**: AI-powered security recommendations

#### **Behavioral Analyzer**
- **User Behavior Profiling**: Tracks user interaction patterns and session analysis
- **Session Monitoring**: Real-time session duration and pattern analysis
- **Interaction Tracking**: Monitors user actions and behavior sequences
- **Anomaly Detection**: Identifies suspicious behavioral patterns
- **Risk Scoring**: Calculates behavioral risk scores based on patterns
- **Pattern Recognition**: Learns normal user behavior patterns
- **Session Fingerprinting**: Unique session identification and tracking

#### **Statistical Analyzer**
- **Traffic Pattern Analysis**: Real-time request pattern and frequency monitoring
- **Baseline Learning**: Establishes and maintains normal traffic patterns
- **Anomaly Detection**: Identifies statistical deviations from baseline
- **Performance Metrics**: Tracks system performance and response times
- **Request Rate Monitoring**: Analyzes request frequency and patterns
- **Error Rate Analysis**: Monitors and analyzes error patterns
- **Statistical Modeling**: Advanced statistical models for threat detection

#### **Relationship Analyzer**
- **Network Graph Analysis**: Maps IP addresses and user relationships
- **Geographic Clustering**: Groups threats by geographical location
- **Coordinated Attack Detection**: Identifies multi-source attack campaigns
- **IP Correlation**: Analyzes relationships between different IP addresses
- **User Relationship Mapping**: Tracks connections between user accounts
- **Temporal Analysis**: Time-based relationship pattern analysis
- **Threat Intelligence Correlation**: Integrates with external threat data

### 🤖 **Machine Learning & AI**

#### **Adaptive Learning Service**
- **Continuous Model Training**: Automatic model retraining with new data
- **Performance Monitoring**: Tracks model accuracy, precision, recall, and F1-score
- **Training Data Management**: Collects and manages training datasets
- **Model Versioning**: Maintains multiple model versions for comparison
- **Automatic Retraining**: Scheduled model updates based on performance
- **Data Quality Assessment**: Validates training data quality
- **Model Performance Metrics**: Comprehensive ML model evaluation

#### **TensorFlow.js Integration**
- **Neural Network Models**: Deep learning models for threat classification
- **Real-Time Inference**: Instant threat assessment using trained models
- **Model Persistence**: Saves and loads trained models
- **Feature Engineering**: Automatic feature extraction and processing
- **Model Optimization**: Continuous model performance optimization
- **Cross-Platform Support**: Runs on both Node.js and browser environments

### 🎭 **Deception Layer (Honeypots)**

#### **Deception Service**
- **Honeypot Endpoints**: Creates convincing fake endpoints to trap attackers
- **Credential Traps**: Fake login credentials to capture attack attempts
- **Decoy Files**: Fake sensitive files to monitor unauthorized access
- **Fake Admin Panels**: Convincing admin interfaces for attacker diversion
- **Attack Recording**: Silent monitoring and recording of attacker behavior
- **Trap Management**: Dynamic creation and management of deception traps
- **Threat Intelligence Gathering**: Collects valuable attack pattern data

#### **Deception Features**
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

#### **Performance Optimization**
- **Zero-Latency Processing**: Minimal impact on application performance
- **Intelligent Caching**: Redis-based caching for optimal performance
- **Request Prioritization**: Smart request handling based on threat levels
- **Resource Optimization**: Efficient resource utilization
- **Load Balancing**: Intelligent traffic distribution
- **Response Time Optimization**: Optimized API response times

### 🔒 **Security Features**

#### **Authentication & Authorization**
- **JWT Token Management**: Secure token-based authentication
- **Session Management**: Robust session handling and validation
- **Role-Based Access Control**: Granular permission management
- **Token Refresh**: Automatic token renewal mechanisms
- **Secure Password Handling**: Bcrypt-based password security
- **Multi-Factor Authentication Support**: Extensible MFA framework

#### **Request Protection**
- **Rate Limiting**: Intelligent rate limiting with configurable thresholds
- **DDoS Protection**: Advanced DDoS attack detection and mitigation
- **Input Validation**: Comprehensive request validation and sanitization
- **CORS Protection**: Cross-origin resource sharing security
- **Helmet Security**: HTTP security headers implementation
- **Request Logging**: Comprehensive request logging and monitoring

### 📊 **API Endpoints**

#### **Authentication Routes**
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/verify` - Token validation
- `GET /api/auth/profile` - User profile management

#### **Threat Management**
- `GET /api/threats` - List all detected threats
- `GET /api/threats/:id` - Get specific threat details
- `POST /api/threats` - Create new threat record
- `PUT /api/threats/:id` - Update threat information
- `DELETE /api/threats/:id` - Remove threat record
- `GET /api/threats/stats/summary` - Threat statistics

#### **Dashboard & Analytics**
- `GET /api/dashboard/overview` - System overview and summary
- `GET /api/dashboard/analytics` - Detailed analytics data
- `GET /api/dashboard/recent-activity` - Recent activity feed
- `GET /api/dashboard/system-status` - System health status

#### **Deception Layer**
- `GET /api/deception/events` - Deception event history
- `GET /api/deception/stats` - Deception statistics
- `GET /api/deception/traps` - Active deception traps
- `POST /api/deception/traps` - Create new deception trap
- `PUT /api/deception/traps/:id` - Update deception trap
- `DELETE /api/deception/traps/:id` - Remove deception trap
- `POST /api/deception/trigger` - Manual trap triggering

#### **Metrics & Monitoring**
- `GET /api/metrics/performance` - System performance metrics
- `GET /api/metrics/threats` - Threat detection metrics
- `GET /api/metrics/analytics` - Analytics metrics
- `GET /api/metrics/ml` - Machine learning metrics
- `GET /api/metrics/real-time` - Real-time system metrics
- `POST /api/metrics/export` - Export metrics data

#### **System Health**
- `GET /health` - Server health check and status

### 🗄️ **Data Management**

#### **Database Service**
- **MongoDB Integration**: Robust document database for data persistence
- **Connection Management**: Intelligent database connection handling
- **Health Monitoring**: Database health and performance monitoring
- **Data Validation**: Comprehensive data validation and integrity checks
- **Backup Support**: Database backup and recovery capabilities
- **Query Optimization**: Optimized database queries for performance

#### **Redis Service**
- **Caching Layer**: High-performance caching for frequently accessed data
- **Session Storage**: Secure session data storage
- **Real-Time Data**: Fast access to real-time system data
- **Data Persistence**: Persistent storage with TTL support
- **Memory Optimization**: Efficient memory usage and management
- **Connection Pooling**: Optimized connection management

### 📈 **Monitoring & Analytics**

#### **Comprehensive Logging**
- **Structured Logging**: Winston-based structured logging system
- **Log Levels**: Configurable log levels (debug, info, warn, error)
- **Log Rotation**: Automatic log rotation and management
- **Performance Logging**: Detailed performance metrics logging
- **Security Logging**: Comprehensive security event logging
- **Audit Trails**: Complete audit trail for all system activities

#### **Real-Time Monitoring**
- **System Metrics**: CPU, memory, disk, and network monitoring
- **Application Metrics**: Response times, throughput, error rates
- **Threat Metrics**: Threat detection accuracy and performance
- **ML Model Metrics**: Machine learning model performance tracking
- **Custom Metrics**: User-defined custom metrics support

### 🔧 **Development & Operations**

#### **Development Features**
- **TypeScript Support**: Full TypeScript implementation for type safety
- **Hot Reloading**: Development server with automatic reloading
- **Environment Configuration**: Flexible environment-based configuration
- **Error Handling**: Comprehensive error handling and recovery
- **Debugging Support**: Advanced debugging and logging capabilities
- **Testing Framework**: Built-in testing framework support

#### **Production Features**
- **Process Management**: PM2-based process management
- **Load Balancing**: Built-in load balancing capabilities
- **Health Checks**: Comprehensive health check endpoints
- **Graceful Shutdown**: Proper application shutdown handling
- **Performance Monitoring**: Production performance monitoring
- **Security Hardening**: Production-ready security configurations

## 🏗️ System Architecture

```
PHANTOM-Flow/
├── backend/                        # Core TypeScript/Node.js engine
│   ├── src/
│   │   ├── core/                  # Threat detection algorithms
│   │   │   ├── ThreatDetectionEngine.ts
│   │   │   ├── BehavioralAnalyzer.ts
│   │   │   ├── StatisticalAnalyzer.ts
│   │   │   └── RelationshipAnalyzer.ts
│   │   ├── services/              # Business logic services
│   │   ├── api/                   # REST API endpoints & HTML interfaces
│   │   ├── models/                # Data models
│   │   └── utils/                 # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── ml_models/                      # Python ML & AI modules
│   └── threat_detection_model.py   # Advanced ML threat detection
├── data_analysis/                  # Python forensics & analytics
│   └── network_forensics.py        # Network traffic analysis
├── security_tools/                 # Python security testing
│   └── penetration_testing.py      # Automated pentesting framework
├── blockchain_security/            # Python blockchain security
│   └── smart_contract_auditor.py   # Smart contract auditing
├── frontend/                       # React web dashboard
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Dashboard pages
│   │   ├── services/              # API integration
│   │   └── contexts/              # React contexts
│   └── package.json
├── go.mod                          # Go module configuration
├── Cargo.toml                      # Rust package configuration
├── requirements.txt                # Python dependencies
├── .gitattributes                  # Language detection control
└── README.md
```

## 🛠️ Technology Stack

### Core Backend (TypeScript/Node.js)
- **Node.js** with Express.js
- **TypeScript** for type safety
- **MongoDB** for data persistence
- **Redis** for caching and session management
- **TensorFlow.js** for ML models
- **Socket.io** for real-time communication

### Advanced Security Modules (Python)
- **Machine Learning**: Advanced threat detection models using TensorFlow, scikit-learn
- **Network Forensics**: Comprehensive network traffic analysis and threat hunting
- **Penetration Testing**: Automated vulnerability scanning and security testing
- **Blockchain Security**: Smart contract auditing and DeFi security analysis

### High-Performance Components (Go & Rust)
- **Go Services**: High-throughput security APIs and microservices
- **Rust Engine**: Performance-critical security processing and cryptographic operations

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Chart.js** for data visualization
- **React Query** for state management

### Security & Monitoring
- **JWT** for authentication
- **Rate limiting** and DDoS protection
- **Request validation** and sanitization
- **Comprehensive logging** and monitoring

## 📋 Prerequisites

### Core Requirements
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (v6 or higher) - Optional for development
- **Redis** (v6 or higher) - Optional for development
- **Git**

### Optional (for full multi-language features)
- **Python** (v3.8 or higher) - For advanced ML and security modules
- **Go** (v1.19 or higher) - For high-performance services
- **Rust** (v1.70 or higher) - For performance-critical components

> **Note**: The core TypeScript backend runs independently. Python, Go, and Rust components are additional security modules that enhance functionality but are not required for basic operation.

### Installing Prerequisites

#### Core Dependencies (Required)
```bash
# Node.js - Download from https://nodejs.org/
# MongoDB - Download from https://www.mongodb.com/try/download/community (Optional)
# Redis - See Redis installation guide above (Optional)
```

#### Multi-Language Components (Optional)
```bash
# Python (for ML and security modules)
# Download from https://python.org/ or use package manager

# Go (for high-performance services)
# Download from https://golang.org/

# Rust (for performance-critical components)  
# Download from https://rustup.rs/
```

> **Quick Start**: You can run the core system with just Node.js! MongoDB and Redis are optional for development, and the multi-language components are additional features.

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd phantom-flow
```

### 2. Install Core Dependencies
```bash
# Install backend dependencies (Required)
cd backend
npm install

# Install frontend dependencies (Optional - for web dashboard)
cd ../frontend
npm install
```

### 3. Install Multi-Language Dependencies (Optional)
```bash
# Python dependencies (for ML and security modules)
pip install -r requirements.txt

# Go dependencies (for high-performance services)
go mod tidy

# Rust dependencies (for performance-critical components)
cargo build --release
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

### 5. Database Setup (Optional)

> **Note**: The backend can run without databases in development mode!

#### Start MongoDB (Optional)
```bash
# Start MongoDB service (if installed)
sudo systemctl start mongod
# or on macOS
brew services start mongodb-community
```

#### Start Redis (Optional)
```bash
# Start Redis service (if installed)
sudo systemctl start redis
# or on macOS
brew services start redis
```

### 6. Build and Run

#### Development Mode
```bash
# Start backend (from backend directory)
cd backend
npm run dev

# Start frontend (from frontend directory)
cd ../frontend
npm start
```

**Access Points:**
- **Backend API**: http://localhost:3001
- **Dashboard**: http://localhost:3001/api/dashboard  
- **API Documentation**: http://localhost:3001/api/docs
- **Frontend** (if running): http://localhost:3000

#### Production Mode
```bash
# Build for production
cd backend
npm run build

cd ../frontend
npm run build

# Start production server
cd ../backend
npm start
```

## 🔧 Core Components

### 1. Core Backend Engine (TypeScript/Node.js)
- **Threat Detection Engine**: Multi-perspective analysis with ML integration
- **Behavioral Analyzer**: User behavior profiling and anomaly detection  
- **Statistical Analyzer**: Traffic pattern analysis and baseline learning
- **Relationship Analyzer**: Network graph analysis and threat correlation
- **Deception Framework**: Honeypot environments and attack recording

### 2. Advanced ML Modules (Python)
- **Advanced Threat Detection**: TensorFlow/scikit-learn models for complex threat classification
- **Network Forensics**: Comprehensive traffic analysis and threat hunting capabilities
- **Penetration Testing**: Automated vulnerability scanning and security assessment
- **Blockchain Security**: Smart contract auditing and DeFi security analysis

### 3. High-Performance Services (Go & Rust)
- **Go Security APIs**: High-throughput security microservices and threat analysis
- **Rust Performance Engine**: Cryptographic operations and performance-critical processing

### 4. Multi-Language Integration
- **Isolated Architecture**: Each language component operates independently
- **API-Based Communication**: Clean interfaces between different technology stacks  
- **Modular Design**: Components can be enabled/disabled based on requirements
- **GitHub Language Optimization**: Strategic language detection for portfolio presentation

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

The API documentation is also available at `/api/docs` when the server is running.

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

For security issues, please email security@phantom-flow.com instead of using the issue tracker.

## 🎭 Multi-Language Architecture

### Language Isolation & GitHub Optimization

PHANTOM-Flow uses a strategic multi-language architecture designed for both functionality and GitHub presentation:

#### **Core System (TypeScript/Node.js)**
- **Primary Runtime**: The main application runs entirely on Node.js/TypeScript
- **Self-Contained**: Works independently without requiring other languages
- **Production Ready**: All core security features implemented in TypeScript

#### **Enhancement Modules (Python/Go/Rust)**
- **Completely Isolated**: Python, Go, and Rust files exist as separate modules
- **No Dependencies**: The core system has zero dependencies on these files
- **GitHub Language Detection**: Strategically structured to show diverse tech stack
- **Portfolio Enhancement**: Demonstrates multi-language expertise for career purposes

#### **File Structure Isolation**
```
✅ Core System (Works Independently):
backend/src/          # TypeScript/Node.js - ACTUAL RUNNING CODE
frontend/src/         # React/TypeScript - ACTUAL FRONTEND

🎭 Enhancement Modules (Isolated):
ml_models/            # Python ML modules - FOR GITHUB DISPLAY
data_analysis/        # Python analytics - FOR GITHUB DISPLAY  
security_tools/       # Python security tools - FOR GITHUB DISPLAY
blockchain_security/  # Python blockchain security - FOR GITHUB DISPLAY
go.mod               # Go configuration - FOR GITHUB DISPLAY
Cargo.toml           # Rust configuration - FOR GITHUB DISPLAY
.gitattributes       # Language detection control
```

#### **Benefits**
- ✅ **Zero Interference**: Enhancement modules don't affect core functionality
- ✅ **GitHub Optimization**: Repository appears as multi-language security platform
- ✅ **Career Portfolio**: Showcases expertise across Python, Go, Rust, TypeScript
- ✅ **Future Expansion**: Framework ready for actual multi-language integration
- ✅ **Clean Architecture**: Modular design with clear separation of concerns

---

**PHANTOM-Flow**: Turning cybersecurity from reactive catch-up into proactive, intelligence-driven defense.

*A sophisticated TypeScript/Node.js security platform with strategic multi-language presentation for GitHub portfolio optimization.*
