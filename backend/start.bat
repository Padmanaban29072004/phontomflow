@echo off
chcp 65001 >nul
echo 🚀 Starting PHANTOM-Flow Backend...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2 delims=." %%a in ('node --version') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 18 (
    echo ❌ Node.js version 18+ is required. Current version: 
    node --version
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ npm version: 
npm --version

REM Check if we're in the backend directory
if not exist "package.json" (
    echo ❌ Please run this script from the backend directory
    echo Usage: cd backend ^&^& start.bat
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚙️ Creating .env file from template...
    if exist "env.example" (
        copy env.example .env >nul
        echo ✅ .env file created from template
        echo ⚠️ Please edit .env file with your configuration
    ) else (
        echo ⚠️ No env.example found, creating basic .env file...
        (
            echo # Server Configuration
            echo PORT=3001
            echo NODE_ENV=development
            echo.
            echo # Database Configuration ^(optional for development^)
            echo MONGODB_URI=mongodb://localhost:27017/phantom-flow
            echo REDIS_URL=redis://localhost:6379
            echo.
            echo # Security Configuration
            echo JWT_SECRET=your-super-secret-jwt-key-change-this
            echo SESSION_SECRET=your-session-secret-change-this
            echo.
            echo # Feature Flags
            echo HONEYPOT_ENABLED=true
            echo ADAPTIVE_LEARNING_ENABLED=true
            echo.
            echo # Machine Learning Configuration
            echo MODEL_UPDATE_INTERVAL=60
            echo MIN_DATA_POINTS=100
            echo LEARNING_RATE=0.001
            echo BATCH_SIZE=32
            echo EPOCHS=10
        ) > .env
        echo ✅ Basic .env file created
    )
)

REM Set development environment
set NODE_ENV=development

echo 🔧 Starting server in development mode...
echo 📊 Server will be available at: http://localhost:3001
echo 🏥 Health check: http://localhost:3001/health
echo 📈 Dashboard: http://localhost:3001/api/dashboard
echo.
echo 💡 Press Ctrl+C to stop the server
echo.

REM Start the development server
npm run dev
