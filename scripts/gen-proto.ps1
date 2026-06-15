<#
.SYNOPSIS
    Generate protobuf/gRPC stubs for all PHANTOM-Flow language services.
.DESCRIPTION
    Generates Python stubs via grpcio-tools and Go stubs via protoc.
    Rust stubs are generated at build time via build.rs (tonic-build).
    Node.js loads proto files dynamically at runtime.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ProtoDir = Join-Path -Path $RootDir -ChildPath "proto"

Write-Host "=== PHANTOM-Flow Proto Generation ===" -ForegroundColor Cyan
Write-Host "Proto dir: $ProtoDir"
Write-Host ""

# ──────────────────────────────────────────
# 1. Python — via grpcio-tools
# ──────────────────────────────────────────
Write-Host "[1/3] Generating Python stubs..." -ForegroundColor Yellow
$PyOutDir = Join-Path -Path $RootDir -ChildPath "ml_service\generated"
New-Item -ItemType Directory -Path $PyOutDir -Force | Out-Null

python -c @"
import sys, os
sys.path.insert(0, '$RootDir/ml_service')
from grpc_tools import protoc
out = '$PyOutDir'.replace('\\', '/')
protoc.main([
    'grpc_tools.protoc',
    '-I$ProtoDir',
    '--python_out=' + out,
    '--grpc_python_out=' + out,
    os.path.join('$ProtoDir', 'ml_service.proto'),
    os.path.join('$ProtoDir', 'events.proto'),
])
"@ 2>&1 | Out-Null

$initPy = Join-Path -Path $PyOutDir -ChildPath "__init__.py"
if (-not (Test-Path $initPy)) { Set-Content -Path $initPy -Value "" }

Write-Host "   Python stubs generated in ml_service/generated/"

# ──────────────────────────────────────────
# 2. Rust — via build.rs
# ──────────────────────────────────────────
Write-Host "[2/3] Rust stubs are generated at build time via build.rs" -ForegroundColor Yellow
Write-Host "       Run: cargo build"

# ──────────────────────────────────────────
# 3. Go — via protoc-gen-go (if available)
# ──────────────────────────────────────────
Write-Host "[3/3] Generating Go stubs..." -ForegroundColor Yellow
$GoOutDir = Join-Path -Path $RootDir -ChildPath "cmd\security-server"

$protoc = Get-Command "protoc" -ErrorAction SilentlyContinue
$protocGo = Get-Command "protoc-gen-go" -ErrorAction SilentlyContinue

if ($protoc -and $protocGo) {
    & protoc -I "$ProtoDir" `
        --go_out="$GoOutDir" --go_opt=paths=source_relative `
        --go-grpc_out="$GoOutDir" --go-grpc_opt=paths=source_relative `
        "$ProtoDir/threat_service.proto" 2>&1 | Out-Null
    Write-Host "   Go stubs generated in cmd/security-server/"
} else {
    Write-Host "   WARNING: protoc or protoc-gen-go not installed — Go stubs skipped" -ForegroundColor DarkYellow
    Write-Host "   Install: go install google.golang.org/protobuf/cmd/protoc-gen-go@latest" -ForegroundColor DarkYellow
    Write-Host "   Install: go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "=== Generation complete ===" -ForegroundColor Cyan
