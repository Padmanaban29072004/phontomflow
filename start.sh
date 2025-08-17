#!/bin/bash

# PHANTOM-Flow Quick Start Script
# This script helps you quickly set up and start the PHANTOM-Flow defense system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            print_success "$service is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service failed to start within expected time"
    return 1
}

# Main script
main() {
    echo "🚀 PHANTOM-Flow Quick Start Script"
    echo "=================================="
    echo ""

    # Check prerequisites
    print_status "Checking prerequisites..."

    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js v18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    print_success "Node.js $(node --version) is installed"

    # Check npm
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    print_success "npm $(npm --version) is installed"

    # Check MongoDB
    if ! command_exists mongod; then
        print_warning "MongoDB is not installed or not in PATH. Please install MongoDB."
        print_status "You can install MongoDB from: https://www.mongodb.com/try/download/community"
        read -p "Do you want to continue without MongoDB? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "MongoDB is installed"
    fi

    # Check Redis
    if ! command_exists redis-server; then
        print_warning "Redis is not installed or not in PATH. Please install Redis."
        print_status "You can install Redis from: https://redis.io/download"
        read -p "Do you want to continue without Redis? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "Redis is installed"
    fi

    echo ""

    # Check if we're in the right directory
    if [ ! -f "package.json" ] && [ ! -d "backend" ]; then
        print_error "Please run this script from the PHANTOM-Flow root directory"
        exit 1
    fi

    # Install dependencies
    print_status "Installing dependencies..."

    # Backend dependencies
    if [ -d "backend" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
        print_success "Backend dependencies installed"
    fi

    # Frontend dependencies
    if [ -d "frontend" ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
        print_success "Frontend dependencies installed"
    fi

    echo ""

    # Setup environment files
    print_status "Setting up environment files..."

    # Backend environment
    if [ -d "backend" ] && [ ! -f "backend/.env" ]; then
        if [ -f "backend/env.example" ]; then
            cp backend/env.example backend/.env
            print_success "Backend environment file created"
            print_warning "Please edit backend/.env with your configuration"
        fi
    fi

    # Frontend environment
    if [ -d "frontend" ] && [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            cp frontend/.env.example frontend/.env
            print_success "Frontend environment file created"
        fi
    fi

    echo ""

    # Start services
    print_status "Starting services..."

    # Start MongoDB if available
    if command_exists mongod && ! port_in_use 27017; then
        print_status "Starting MongoDB..."
        mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb
        wait_for_service localhost 27017 "MongoDB"
    elif port_in_use 27017; then
        print_success "MongoDB is already running"
    fi

    # Start Redis if available
    if command_exists redis-server && ! port_in_use 6379; then
        print_status "Starting Redis..."
        redis-server --daemonize yes --logfile /tmp/redis.log
        wait_for_service localhost 6379 "Redis"
    elif port_in_use 6379; then
        print_success "Redis is already running"
    fi

    echo ""

    # Build backend
    if [ -d "backend" ]; then
        print_status "Building backend..."
        cd backend
        npm run build
        cd ..
        print_success "Backend built successfully"
    fi

    echo ""

    # Start the application
    print_status "Starting PHANTOM-Flow..."

    # Start backend in background
    if [ -d "backend" ]; then
        print_status "Starting backend server..."
        cd backend
        npm run dev &
        BACKEND_PID=$!
        cd ..
        
        # Wait for backend to start
        wait_for_service localhost 3001 "Backend server"
    fi

    # Start frontend in background
    if [ -d "frontend" ]; then
        print_status "Starting frontend development server..."
        cd frontend
        npm start &
        FRONTEND_PID=$!
        cd ..
        
        # Wait for frontend to start
        wait_for_service localhost 3000 "Frontend server"
    fi

    echo ""
    print_success "🎉 PHANTOM-Flow is now running!"
    echo ""
    echo "📊 Dashboard: http://localhost:3000"
    echo "🔧 Backend API: http://localhost:3001"
    echo "📚 API Documentation: http://localhost:3001/api/docs"
    echo ""
    echo "Press Ctrl+C to stop all services"

    # Function to cleanup on exit
    cleanup() {
        echo ""
        print_status "Stopping PHANTOM-Flow..."
        
        if [ ! -z "$BACKEND_PID" ]; then
            kill $BACKEND_PID 2>/dev/null || true
        fi
        
        if [ ! -z "$FRONTEND_PID" ]; then
            kill $FRONTEND_PID 2>/dev/null || true
        fi
        
        print_success "PHANTOM-Flow stopped"
        exit 0
    }

    # Set up signal handlers
    trap cleanup SIGINT SIGTERM

    # Keep script running
    wait
}

# Run main function
main "$@"
