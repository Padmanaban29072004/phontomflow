#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-phantom-flow}"
ENVIRONMENT="${1:-staging}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Usage: $0 [staging|production]"
    exit 1
fi

echo "=== Deploying PHANTOM-Flow to $ENVIRONMENT ==="

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required"; exit 1; }
command -v kustomize >/dev/null 2>&1 || { echo "kustomize is required"; exit 1; }

if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "!!! PRODUCTION DEPLOYMENT !!!"
    read -rp "Continue? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Create namespace if not exists
kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"

# Apply secrets (from CI env or local files)
if [[ -f "k8s/secrets.env" ]]; then
    kubectl create secret generic backend-secrets \
        --namespace "$NAMESPACE" \
        --from-env-file=k8s/secrets.env \
        --dry-run=client -o yaml | kubectl apply -f -
fi

# Apply all manifests
cd k8s
kustomize build . | kubectl apply -f -

# Wait for rollouts
echo "=== Waiting for deployments to roll out ==="
for deploy in backend frontend go-server rust-engine ml-service nginx; do
    kubectl rollout status "deployment/$deploy" -n "$NAMESPACE" --timeout=300s || true
done

# Health check
echo "=== Running health checks ==="
sleep 10
if kubectl get pods -n "$NAMESPACE" | grep -q "CrashLoopBackOff\|Error"; then
    echo "WARNING: Some pods are unhealthy"
    kubectl get pods -n "$NAMESPACE" | grep -E "CrashLoopBackOff|Error"
else
    echo "All pods healthy"
fi

echo "=== Deployment to $ENVIRONMENT complete ==="
