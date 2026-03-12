#!/usr/bin/env bash
# =============================================================================
# build-and-run.sh — One-shot build + run for High-Performance API Gateway
#
# Usage:
#   ./scripts/build-and-run.sh [mode] [options]
#
# Modes:
#   local       Build C++ binary locally and run natively (default)
#   docker      Build & run full stack via Docker Compose (dev)
#   production  Build & run full stack via Docker Compose (prod)
#   test        Build locally and run all unit tests
#   clean       Remove all build artifacts and Docker volumes
#
# Options:
#   --no-cache    Rebuild Docker images from scratch
#   --monitoring  Include Prometheus + Grafana stack (docker/production modes)
#   --detach      Run Docker containers in background (docker/production modes)
#
# Examples:
#   ./scripts/build-and-run.sh local
#   ./scripts/build-and-run.sh docker --detach
#   ./scripts/build-and-run.sh production --detach --monitoring
#   ./scripts/build-and-run.sh test
#   ./scripts/build-and-run.sh clean
# =============================================================================

set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()  { echo -e "${CYAN}${BOLD}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}${BOLD}[OK]${RESET}    $*"; }
warn()  { echo -e "${YELLOW}${BOLD}[WARN]${RESET}  $*"; }
fail()  { echo -e "${RED}${BOLD}[FAIL]${RESET}  $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${SCRIPT_DIR}/.."
BUILD_DIR="${ROOT}/build"

MODE="${1:-local}"
shift || true

NO_CACHE=""
MONITORING=""
DETACH=""

for arg in "$@"; do
  case "$arg" in
    --no-cache)    NO_CACHE="--no-cache" ;;
    --monitoring)  MONITORING="--profile monitoring" ;;
    --detach)      DETACH="-d" ;;
    *) warn "Unknown option: $arg" ;;
  esac
done

# ── helpers ───────────────────────────────────────────────────────────────────
require_cmd() {
  command -v "$1" &>/dev/null || fail "'$1' is not installed or not on PATH."
}

cpu_count() {
  nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4
}

ensure_env_file() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    warn "$env_file not found — creating from template."
    cat > "$env_file" <<'EOF'
# ── Required ──────────────────────────────────────────────
# Must be at least 32 characters long for HS256
JWT_SECRET=change-me-super-secret-jwt-key-minimum-32-chars

# Random 32-char hex token:  openssl rand -hex 16
ADMIN_TOKEN=change-me-admin-token

# ── Redis ─────────────────────────────────────────────────
REDIS_PASSWORD=gateway-redis-pass

# ── Optional ──────────────────────────────────────────────
JWT_ISSUER=api-gateway
JWT_AUDIENCE=api-clients
GATEWAY_PORT=8080
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS=http://localhost:3000
REDIS_ENABLED=true
ADMIN_ENABLED=true
METRICS_ENABLED=true
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300
WEBSOCKET_ENABLED=true
WEBSOCKET_MAX_CONNECTIONS=100
DEMO_ADMIN_PASSWORD=change-me-admin
DEMO_USER_PASSWORD=change-me-user
NODE_ENV=development
EOF
    warn "Edit $env_file before running in production!"
  fi
}

# ── mode: test ────────────────────────────────────────────────────────────────
run_tests() {
  info "Mode: test — building locally and running all unit tests"
  require_cmd cmake
  require_cmd make

  mkdir -p "$BUILD_DIR"
  pushd "$BUILD_DIR" > /dev/null
    info "Configuring CMake (Debug)…"
    cmake "$ROOT" -DCMAKE_BUILD_TYPE=Debug -DBUILD_TESTS=ON

    info "Building ($(cpu_count) cores)…"
    make -j"$(cpu_count)"

    info "Running unit tests…"
    ctest --timeout 30 --output-on-failure

    ok "All tests passed."
  popd > /dev/null
}

# ── mode: local ───────────────────────────────────────────────────────────────
run_local() {
  info "Mode: local — building and running natively"
  require_cmd cmake
  require_cmd make

  # Warn if JWT_SECRET unset
  if [[ -z "${JWT_SECRET:-}" ]]; then
    warn "JWT_SECRET not set — using insecure default (for dev only)."
    export JWT_SECRET="dev-only-insecure-secret-key-32ch"
  fi

  mkdir -p "$BUILD_DIR"
  pushd "$BUILD_DIR" > /dev/null
    info "Configuring CMake (Release)…"
    cmake "$ROOT" -DCMAKE_BUILD_TYPE=Release

    info "Building ($(cpu_count) cores)…"
    make -j"$(cpu_count)"
  popd > /dev/null

  ok "Build complete — starting gateway…"
  echo ""
  "${BUILD_DIR}/api-gateway" "$ROOT/config/gateway.json"
}

# ── mode: docker ──────────────────────────────────────────────────────────────
run_docker() {
  info "Mode: docker — starting full dev stack via Docker Compose"
  require_cmd docker

  ensure_env_file "${ROOT}/.env"

  pushd "$ROOT" > /dev/null
    info "Building images…"
    # shellcheck disable=SC2086
    docker compose \
      -f docker-compose.yml \
      --env-file .env \
      ${MONITORING} \
      build ${NO_CACHE}

    info "Starting containers…"
    # shellcheck disable=SC2086
    docker compose \
      -f docker-compose.yml \
      --env-file .env \
      ${MONITORING} \
      up ${DETACH}
  popd > /dev/null

  if [[ -n "$DETACH" ]]; then
    ok "Stack running in background. Useful commands:"
    echo "  docker compose logs -f"
    echo "  docker compose ps"
    echo "  docker compose down -v"
  fi
}

# ── mode: production ──────────────────────────────────────────────────────────
run_production() {
  info "Mode: production — starting full prod stack via Docker Compose"
  require_cmd docker

  local env_file="${ROOT}/.env.production"
  ensure_env_file "$env_file"

  # Safety check: refuse obviously unchanged secrets
  if grep -qE "change-me" "$env_file"; then
    fail "Detected placeholder values in $env_file. Update JWT_SECRET, ADMIN_TOKEN, and REDIS_PASSWORD before deploying to production."
  fi

  # Generate TLS certs if not present
  if [[ ! -f "${ROOT}/certs/server.crt" ]]; then
    warn "No TLS certificates found in certs/. Generating self-signed certs for now."
    warn "Replace with real certs (Let's Encrypt) before going live."
    bash "${SCRIPT_DIR}/generate-dev-certs.sh" 2>/dev/null || \
      (mkdir -p "${ROOT}/certs" && \
       openssl req -x509 -newkey rsa:4096 -keyout "${ROOT}/certs/server.key" \
         -out "${ROOT}/certs/server.crt" -days 365 -nodes \
         -subj "/C=US/ST=CA/L=SF/O=API Gateway/CN=localhost" 2>/dev/null)
    ok "Self-signed certs generated."
  fi

  pushd "$ROOT" > /dev/null
    info "Building production images (this may take a few minutes)…"
    # shellcheck disable=SC2086
    docker compose \
      -f docker-compose.production.yml \
      --env-file "$env_file" \
      ${MONITORING} \
      build ${NO_CACHE}

    info "Starting production stack…"
    # shellcheck disable=SC2086
    docker compose \
      -f docker-compose.production.yml \
      --env-file "$env_file" \
      ${MONITORING} \
      up ${DETACH}
  popd > /dev/null

  if [[ -n "$DETACH" ]]; then
    ok "Production stack running. Useful commands:"
    echo "  docker compose -f docker-compose.production.yml logs -f"
    echo "  docker compose -f docker-compose.production.yml ps"
    echo "  docker compose -f docker-compose.production.yml down"
  fi
}

# ── mode: clean ───────────────────────────────────────────────────────────────
run_clean() {
  info "Mode: clean — removing local build dir and Docker volumes"
  require_cmd docker

  if [[ -d "$BUILD_DIR" ]]; then
    info "Removing $BUILD_DIR…"
    rm -rf "$BUILD_DIR"
    ok "Build directory removed."
  fi

  pushd "$ROOT" > /dev/null
    info "Stopping and removing Docker containers + volumes…"
    docker compose -f docker-compose.yml down -v --remove-orphans 2>/dev/null || true
    docker compose -f docker-compose.production.yml down -v --remove-orphans 2>/dev/null || true
  popd > /dev/null

  ok "Clean complete."
}

# ── dispatch ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  High-Performance API Security Gateway — build-and-run.sh${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

case "$MODE" in
  local)       run_local ;;
  docker)      run_docker ;;
  production)  run_production ;;
  test)        run_tests ;;
  clean)       run_clean ;;
  *)
    fail "Unknown mode '$MODE'. Valid modes: local | docker | production | test | clean"
    ;;
esac
