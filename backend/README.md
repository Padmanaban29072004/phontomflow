# 🛡️ PHANTOM-Flow Backend

> **Smart Adaptive Defense System** - A next-generation cybersecurity platform that combines machine learning, behavioral analysis, and deception technology to protect modern applications.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Development-orange.svg)]()

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn** package manager
- **Git** for version control

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

## 🎯 Key Features

### 🧠 **Multi-Perspective Threat Detection**
- **Behavioral Analysis**: User behavior pattern recognition
- **Statistical Analysis**: Real-time traffic pattern analysis
- **Relationship Analysis**: Network and user relationship mapping

### 🤖 **Machine Learning Engine**
- **TensorFlow.js Integration**: Real-time threat classification
- **Adaptive Learning**: Continuous model improvement
- **Anomaly Detection**: Advanced pattern recognition

### 🎭 **Deception Layer (Honeypots)**
- **Fake Endpoints**: Convincing decoy environments
- **Trap Mechanisms**: Intelligent attacker diversion
- **Intelligence Gathering**: Attack pattern analysis

### ⚡ **Real-time Processing**
- **Instant Assessment**: Sub-second threat evaluation
- **Live Alerts**: Real-time security notifications
- **Socket.IO Integration**: WebSocket-based communication

### 🔒 **Security Features**
- **Rate Limiting**: DDoS protection
- **JWT Authentication**: Secure API access
- **CORS Protection**: Cross-origin security
- **Helmet Security**: HTTP security headers

## 📁 Project Structure

```
backend/
├── src/
│   ├── api/                 # API routes and controllers
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
- ✅ Server starts without MongoDB/Redis
- ✅ All features work with fallback values
- ✅ Perfect for development and testing
- ⚠️ Some persistent features are limited

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
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

#### 2. **TypeScript Compilation Errors**
```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

#### 3. **Database Connection Issues**
```bash
# Check if MongoDB is running
mongod --version

# Check if Redis is running
redis-server --version
```

#### 4. **Permission Issues**
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
