import os
import sys
from grpc_tools import protoc

PROTO_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'proto'))
OUT_DIR = os.path.join(os.path.dirname(__file__), 'generated')

os.makedirs(OUT_DIR, exist_ok=True)

proto_files = [
    os.path.join(PROTO_DIR, 'ml_service.proto'),
    os.path.join(PROTO_DIR, 'events.proto'),
]

for f in proto_files:
    if not os.path.exists(f):
        print(f"Proto file not found: {f}")
        sys.exit(1)

print(f"Generating Python gRPC stubs from {PROTO_DIR}")
protoc.main([
    'grpc_tools.protoc',
    f'-I{PROTO_DIR}',
    f'--python_out={OUT_DIR}',
    f'--grpc_python_out={OUT_DIR}',
] + proto_files)

with open(os.path.join(OUT_DIR, '__init__.py'), 'w') as f:
    f.write('')

print("Python gRPC stubs generated successfully")
