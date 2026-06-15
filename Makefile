.PHONY: all build push dev test clean deploy k8s help

SERVICES = backend frontend go-server rust-engine ml-service nginx
REGISTRY ?= ghcr.io/phantom-flow
TAG ?= latest

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

all: build ## Build all services

build: ## Build all Docker images
	@for service in $(SERVICES); do \
		echo "Building $$service..."; \
		docker build -t $(REGISTRY)/$$service:$(TAG) -f Dockerfile.$$service .; \
	done

push: ## Push all Docker images to registry
	@for service in $(SERVICES); do \
		echo "Pushing $$service..."; \
		docker push $(REGISTRY)/$$service:$(TAG); \
	done

dev: ## Start full development stack with docker compose
	docker compose up --build -d

dev-logs: ## Follow logs from all services
	docker compose logs -f

dev-stop: ## Stop development stack
	docker compose down

test-backend: ## Run backend tests
	cd backend && npm test -- --ci

test-go: ## Run Go tests
	go test ./... -v -race

test-rust: ## Run Rust tests
	cargo test --verbose

test: test-backend test-go test-rust ## Run all tests

lint-backend: ## Lint backend
	cd backend && npm run lint

lint-rust: ## Lint Rust
	cargo clippy -- -D warnings

lint: lint-backend lint-rust ## Run all linters

k8s-apply: ## Deploy to Kubernetes
	cd k8s && kustomize build . | kubectl apply -f -

k8s-delete: ## Delete from Kubernetes
	cd k8s && kustomize build . | kubectl delete -f -

k8s-status: ## Show K8s deployment status
	kubectl get all -n phantom-flow

k8s-logs: ## Follow backend logs in K8s
	kubectl logs -n phantom-flow deployment/backend -f

k8s-restart: ## Restart all deployments
	kubectl rollout restart deployment -n phantom-flow

clean: ## Clean build artifacts
	rm -rf backend/dist frontend/dist
	cargo clean
	@for service in $(SERVICES); do \
		docker rmi $(REGISTRY)/$$service:$(TAG) 2>/dev/null || true; \
	done

prune: clean ## Full cleanup
	docker system prune -f
