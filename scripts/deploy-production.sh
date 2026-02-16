#!/usr/bin/env bash
# =============================================================================
# Production Deployment Script - API Security Gateway
#
# Usage:
#   ./scripts/deploy-production.sh [--skip-checks] [--build-only]
#
# This script:
#   1. Validates environment configuration
#   2. Checks TLS certificates
#   3. Builds Docker images
#   4. Deploys the production stack
#   5. Runs health checks
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_CHECKS=false
BUILD_ONLY=false
ERRORS=0

for arg in "$@"; do
  case $arg in
    --skip-checks) SKIP_CHECKS=true ;;
    --build-only) BUILD_ONLY=true ;;
    --help|-h)
      echo "Usage: $0 [--skip-checks] [--build-only]"
      echo ""
      echo "Options:"
      echo "  --skip-checks  Skip pre-deployment validation"
      echo "  --build-only   Build images without deploying"
      echo "  --help         Show this help message"
      exit 0
      ;;
  esac
done

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; ERRORS=$((ERRORS + 1)); }

echo ""
echo "=========================================="
echo "  API Security Gateway - Production Deploy"
echo "=========================================="
echo ""

# =============================================================================
# Phase 1: Pre-flight Checks
# =============================================================================
if [ "$SKIP_CHECKS" = false ]; then
  log_info "Phase 1: Pre-flight checks..."
  echo ""

  # Check Docker
  if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    log_ok "Docker installed: v${DOCKER_VERSION}"
  else
    log_error "Docker is not installed"
  fi

  # Check Docker Compose
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
    log_ok "Docker Compose installed: v${COMPOSE_VERSION}"
  else
    log_error "Docker Compose is not available"
  fi

  # Check env file
  if [ -f "${ENV_FILE}" ]; then
    log_ok "Environment file found: ${ENV_FILE}"
  else
    log_error "Environment file not found: ${ENV_FILE}"
    log_info "  Copy .env.production and fill in values: cp .env.production .env.production.local"
  fi

  # Validate required env vars
  if [ -f "${ENV_FILE}" ]; then
    source "${ENV_FILE}" 2>/dev/null || true

    REQUIRED_VARS=(JWT_SECRET REDIS_PASSWORD ADMIN_TOKEN GRAFANA_PASSWORD)
    for var in "${REQUIRED_VARS[@]}"; do
      val="${!var:-}"
      if [ -z "$val" ] || [[ "$val" == *"CHANGE_ME"* ]]; then
        log_error "Environment variable ${var} is not set or uses placeholder value"
      else
        log_ok "Environment variable ${var} is configured"
      fi
    done
  fi

  # Check TLS certificates
  CERTS_DIR="${PROJECT_DIR}/certs"
  if [ -f "${CERTS_DIR}/fullchain.pem" ] && [ -f "${CERTS_DIR}/server.key" ]; then
    # Check certificate expiry
    EXPIRY=$(openssl x509 -enddate -noout -in "${CERTS_DIR}/fullchain.pem" 2>/dev/null | cut -d= -f2)
    EXPIRY_EPOCH=$(date -j -f "%b %d %H:%M:%S %Y %Z" "${EXPIRY}" +%s 2>/dev/null || date -d "${EXPIRY}" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

    if [ "${DAYS_LEFT}" -gt 30 ]; then
      log_ok "TLS certificate valid (${DAYS_LEFT} days remaining, expires: ${EXPIRY})"
    elif [ "${DAYS_LEFT}" -gt 0 ]; then
      log_warn "TLS certificate expiring soon (${DAYS_LEFT} days remaining)"
    else
      log_error "TLS certificate has expired!"
    fi
  else
    log_error "TLS certificates not found in ${CERTS_DIR}/"
    log_info "  Generate dev certs: ./scripts/generate-dev-certs.sh"
    log_info "  Or production certs: sudo ./scripts/setup-letsencrypt.sh yourdomain.com"
  fi

  # Check compose file
  if [ -f "${COMPOSE_FILE}" ]; then
    log_ok "Compose file found: ${COMPOSE_FILE}"
  else
    log_error "Compose file not found: ${COMPOSE_FILE}"
  fi

  # Check config files
  for cfg in gateway.production.json routes.production.json; do
    if [ -f "${PROJECT_DIR}/config/${cfg}" ]; then
      # Validate JSON
      if python3 -c "import json; json.load(open('${PROJECT_DIR}/config/${cfg}'))" 2>/dev/null; then
        log_ok "Config valid: config/${cfg}"
      else
        log_error "Config invalid JSON: config/${cfg}"
      fi
    else
      log_error "Config file missing: config/${cfg}"
    fi
  done

  echo ""
  if [ "$ERRORS" -gt 0 ]; then
    log_error "Pre-flight checks failed with ${ERRORS} error(s)"
    echo ""
    echo "Fix the errors above before deploying. Use --skip-checks to bypass."
    exit 1
  else
    log_ok "All pre-flight checks passed!"
  fi
  echo ""
fi

# =============================================================================
# Phase 2: Build Images
# =============================================================================
log_info "Phase 2: Building Docker images..."
echo ""

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build --parallel

log_ok "Docker images built successfully"
echo ""

if [ "$BUILD_ONLY" = true ]; then
  log_info "Build-only mode. Skipping deployment."
  exit 0
fi

# =============================================================================
# Phase 3: Deploy Stack
# =============================================================================
log_info "Phase 3: Deploying production stack..."
echo ""

# Pull latest base images
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull --ignore-buildable 2>/dev/null || true

# Start services
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

echo ""
log_ok "Stack deployed. Waiting for services to become healthy..."
echo ""

# =============================================================================
# Phase 4: Health Checks
# =============================================================================
log_info "Phase 4: Running health checks..."
echo ""

MAX_RETRIES=30
RETRY_INTERVAL=5

check_health() {
  local name="$1"
  local url="$2"
  local insecure="${3:-false}"

  for i in $(seq 1 ${MAX_RETRIES}); do
    CURL_OPTS="-s -o /dev/null -w %{http_code} --connect-timeout 3"
    if [ "$insecure" = "true" ]; then
      CURL_OPTS="${CURL_OPTS} --insecure"
    fi

    STATUS=$(curl ${CURL_OPTS} "${url}" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
      log_ok "${name} is healthy (HTTP ${STATUS})"
      return 0
    fi
    sleep "${RETRY_INTERVAL}"
  done

  log_error "${name} did not become healthy after $((MAX_RETRIES * RETRY_INTERVAL))s"
  return 1
}

check_health "API Gateway" "https://localhost:443/health" "true" || true
check_health "Admin UI" "http://localhost:3001" || true
check_health "Prometheus" "http://localhost:9090/-/healthy" || true
check_health "Grafana" "http://localhost:3000/api/health" || true

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "=========================================="
echo "  Deployment Complete"
echo "=========================================="
echo ""
echo "  Services:"
echo "    API Gateway:  https://localhost:443"
echo "    Admin UI:     http://localhost:3001"
echo "    Prometheus:   http://localhost:9090"
echo "    Grafana:      http://localhost:3000"
echo "    Alertmanager: http://localhost:9093"
echo ""
echo "  Logs:"
echo "    docker compose -f docker-compose.production.yml logs -f api-gateway"
echo ""
echo "  Stop:"
echo "    docker compose -f docker-compose.production.yml down"
echo ""

if [ "$ERRORS" -gt 0 ]; then
  log_warn "Deployment completed with ${ERRORS} warning(s). Check logs above."
  exit 1
fi

log_ok "All services healthy. Production deployment successful!"
