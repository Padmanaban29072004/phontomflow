#!/bin/bash

# 🛡️ PHANTOM-Flow Backend Startup Script
# This script sets up and starts the PHANTOM-Flow backend server

echo "🚀 Starting PHANTOM-Flow Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node -v)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm version: $(npm -v)${NC}"

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the backend directory${NC}"
    echo "Usage: cd backend && ./start.sh"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚙️ Creating .env file from template...${NC}"
    if [ -f "env.example" ]; then
        cp env.example .env
        echo -e "${GREEN}✅ .env file created from template${NC}"
        echo -e "${YELLOW}⚠️ Please edit .env file with your configuration${NC}"
    else
        echo -e "${YELLOW}⚠️ No env.example found, creating basic .env file...${NC}"
        cat > .env << EOF
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration (optional for development)
MONGODB_URI=mongodb://localhost:27017/phantom-flow
REDIS_URL=redis://localhost:6379

# Security Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
SESSION_SECRET=your-session-secret-change-this

# Feature Flags
HONEYPOT_ENABLED=true
ADAPTIVE_LEARNING_ENABLED=true

# Machine Learning Configuration
MODEL_UPDATE_INTERVAL=60
MIN_DATA_POINTS=100
LEARNING_RATE=0.001
BATCH_SIZE=32
EPOCHS=10
EOF
        echo -e "${GREEN}✅ Basic .env file created${NC}"
    fi
fi

# Set development environment
export NODE_ENV=development

echo -e "${BLUE}🔧 Starting server in development mode...${NC}"
echo -e "${BLUE}📊 Server will be available at: http://localhost:3001${NC}"
echo -e "${BLUE}🏥 Health check: http://localhost:3001/health${NC}"
echo -e "${BLUE}📈 Dashboard: http://localhost:3001/api/dashboard${NC}"
echo ""
echo -e "${YELLOW}💡 Press Ctrl+C to stop the server${NC}"
echo ""

# Start the development server
npm run dev
