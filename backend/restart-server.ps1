# PHANTOM-Flow Server Restart Script
# This script kills any existing Node.js processes and restarts the server

Write-Host "🔄 Restarting PHANTOM-Flow Backend Server..." -ForegroundColor Cyan

# Kill any existing Node.js processes
Write-Host "🛑 Stopping existing Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process | Where-Object {$_.ProcessName -like "*node*"}
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "✅ Stopped $($nodeProcesses.Count) Node.js processes" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No existing Node.js processes found" -ForegroundColor Blue
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Check if port 3001 is free
Write-Host "🔍 Checking port 3001..." -ForegroundColor Yellow
$portCheck = netstat -ano | findstr :3001
if ($portCheck) {
    Write-Host "⚠️  Port 3001 still in use, attempting to free it..." -ForegroundColor Yellow
    # Extract PID from netstat output and kill it
    $pids = $portCheck | ForEach-Object { 
        $parts = $_ -split '\s+'
        if ($parts.Length -gt 4) { $parts[4] }
    } | Where-Object { $_ -and $_ -ne "0" } | Sort-Object -Unique
    
    foreach ($pid in $pids) {
        try {
            taskkill /PID $pid /F 2>$null
            Write-Host "✅ Killed process $pid" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not kill process $pid" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

# Start the server
Write-Host "🚀 Starting PHANTOM-Flow server..." -ForegroundColor Cyan
Set-Location -Path "backend"
Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Normal

# Wait for server to start
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test the server
Write-Host "🧪 Testing server health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Server is running successfully!" -ForegroundColor Green
        Write-Host "🌐 Server URL: http://localhost:3001" -ForegroundColor Cyan
        Write-Host "📊 Health Status: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "❌ Server responded with status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Server health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try running 'cd backend && npm start' manually" -ForegroundColor Yellow
}

Write-Host "`n🎯 PHANTOM-Flow Backend Server Restart Complete!" -ForegroundColor Cyan
