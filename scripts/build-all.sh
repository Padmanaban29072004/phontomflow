#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/phantom-flow}"
TAG="${TAG:-latest}"
SERVICES=("backend" "frontend" "go-server" "rust-engine" "ml-service" "nginx")

echo "Building all PHANTOM-Flow services..."
echo "Registry: $REGISTRY"
echo "Tag: $TAG"

for service in "${SERVICES[@]}"; do
    echo ""
    echo "=== Building $service ==="
    docker build \
        --tag "$REGISTRY/$service:$TAG" \
        --file "Dockerfile.$service" \
        --cache-from "type=gha" \
        --cache-to "type=gha,mode=max" \
        .
    echo "=== $service built ==="
done

echo ""
echo "All services built successfully!"
echo ""
echo "To push:"
echo "  export TAG=$TAG"
echo "  docker push $REGISTRY/backend:$TAG"
echo "  docker push $REGISTRY/frontend:$TAG"
echo "  docker push $REGISTRY/go-server:$TAG"
echo "  docker push $REGISTRY/rust-engine:$TAG"
echo "  docker push $REGISTRY/ml-service:$TAG"
echo "  docker push $REGISTRY/nginx:$TAG"
