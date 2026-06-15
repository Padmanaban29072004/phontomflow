#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$ROOT_DIR/proto"

echo "=== PHANTOM-Flow Proto Generation ==="
echo "Proto dir: $PROTO_DIR"
echo ""

# ──────────────────────────────────────────
# 1. Python — via grpcio-tools
# ──────────────────────────────────────────
echo "[1/3] Generating Python stubs..."
python -c "
import sys, os
sys.path.insert(0, '$ROOT_DIR/ml_service')
from gen_proto import main
from grpc_tools import protoc
OUT_DIR = os.path.join('$ROOT_DIR/ml_service', 'generated')
os.makedirs(OUT_DIR, exist_ok=True)
protoc.main([
    'grpc_tools.protoc',
    '-I$PROTO_DIR',
    '--python_out=' + OUT_DIR,
    '--grpc_python_out=' + OUT_DIR,
    os.path.join('$PROTO_DIR', 'ml_service.proto'),
    os.path.join('$PROTO_DIR', 'events.proto'),
])
with open(os.path.join(OUT_DIR, '__init__.py'), 'w') as f:
    f.write('')
print('Python stubs generated in ml_service/generated/')
"

# ──────────────────────────────────────────
# 2. Rust — via build.rs (cargo build handles it)
# ──────────────────────────────────────────
echo "[2/3] Rust stubs are generated at build time via build.rs"
echo "      Run: cargo build"

# ──────────────────────────────────────────
# 3. Go — via protoc-gen-go
# ──────────────────────────────────────────
echo "[3/3] Generating Go stubs..."
GO_OUT_DIR="$ROOT_DIR/cmd/security-server"
protoc -I "$PROTO_DIR" \
  --go_out="$GO_OUT_DIR" --go_opt=paths=source_relative \
  --go-grpc_out="$GO_OUT_DIR" --go-grpc_opt=paths=source_relative \
  "$PROTO_DIR/threat_service.proto" 2>/dev/null && \
  echo "Go stubs generated in cmd/security-server/" || \
  echo "WARNING: Go stub generation skipped (protoc-gen-go not installed)"

echo ""
echo "=== Generation complete ==="
