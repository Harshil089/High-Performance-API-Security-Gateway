# Build & Run Reference

All build, test, and deployment commands in one place.
Use the automated script for daily workflows; refer to the manual commands section when you need granular control.

---

## Automated Script (recommended)

```bash
# Make executable once
chmod +x scripts/build-and-run.sh
```

| What you want | Command |
|---|---|
| Build & run locally (native binary) | `./scripts/build-and-run.sh local` |
| Build & run full dev stack (Docker) | `./scripts/build-and-run.sh docker` |
| Build & run full dev stack (background) | `./scripts/build-and-run.sh docker --detach` |
| Build & run production stack (background) | `./scripts/build-and-run.sh production --detach` |
| Production + Prometheus/Grafana | `./scripts/build-and-run.sh production --detach --monitoring` |
| Run all unit tests | `./scripts/build-and-run.sh test` |
| Rebuild Docker images from scratch | `./scripts/build-and-run.sh docker --no-cache` |
| Stop everything & wipe volumes | `./scripts/build-and-run.sh clean` |

> The script auto-creates `.env` / `.env.production` from a template on first run.
> Edit the generated file before deploying to production.

---

## Manual Commands

### Prerequisites

```bash
# macOS
brew install cmake openssl hiredis redis node

# Ubuntu / Debian
sudo apt-get install -y build-essential cmake libssl-dev uuid-dev libhiredis-dev
```

---

### Local Build (native binary)

```bash
# 1. Create and enter build directory
mkdir -p build && cd build

# 2. Configure (Release)
cmake .. -DCMAKE_BUILD_TYPE=Release

# 3. Compile using all CPU cores
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)

# 4. Run
JWT_SECRET="your-256-bit-secret" ./api-gateway ../config/gateway.json
```

Optional Debug build (includes AddressSanitizer):

```bash
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu)
```

---

### Unit Tests

```bash
# Inside the build/ directory
ctest --timeout 30 --output-on-failure

# Run a single test suite by name
./gateway-tests --gtest_filter="RateLimiterTest.*"
```

---

### Docker — Development Stack

Starts: `api-gateway`, `redis`, `auth-service`, `user-service`, `payment-service`, `gateway-ui`.

```bash
# 1. Create env file (edit before first use)
cp .env.example .env   # or let the script generate one

# 2. Build images
docker compose -f docker-compose.yml --env-file .env build

# 3. Start (foreground — logs visible)
docker compose -f docker-compose.yml --env-file .env up

# 3a. Start in background
docker compose -f docker-compose.yml --env-file .env up -d

# 4. Rebuild a single service (e.g. after code changes)
docker compose -f docker-compose.yml --env-file .env up --build api-gateway

# 5. View logs
docker compose logs -f api-gateway

# 6. Stop and remove containers (keeps volumes)
docker compose down

# 7. Stop and wipe all data volumes
docker compose down -v
```

With optional Prometheus + Grafana monitoring:

```bash
docker compose -f docker-compose.yml --env-file .env --profile monitoring up -d
```

---

### Docker — Production Stack

Starts: `api-gateway`, `redis`, `gateway-ui` (hardened, no mock services).

```bash
# 1. Create production env file
cp .env.example .env.production
# Edit .env.production — set JWT_SECRET, ADMIN_TOKEN, REDIS_PASSWORD to real values

# 2. (Optional) Generate TLS certs if you don't have them yet
bash scripts/generate-dev-certs.sh
# For real production, use Let's Encrypt:
# bash scripts/setup-letsencrypt.sh your-domain.com

# 3. Build
docker compose -f docker-compose.production.yml --env-file .env.production build

# 4. Start in background
docker compose -f docker-compose.production.yml --env-file .env.production up -d

# 5. Start with monitoring stack
docker compose -f docker-compose.production.yml --env-file .env.production \
  --profile monitoring up -d

# 6. View logs
docker compose -f docker-compose.production.yml logs -f

# 7. Stop
docker compose -f docker-compose.production.yml down
```

---

### Useful Docker Commands

```bash
# Check running containers and health status
docker compose ps

# Enter the gateway container for debugging
docker exec -it api-gateway bash

# Check gateway health endpoint
curl http://localhost:8080/health

# Check metrics
curl http://localhost:8080/metrics
```

---

## Service URLs (development defaults)

| Service | URL |
|---|---|
| API Gateway | http://localhost:8080 |
| Admin UI | http://localhost:3000 |
| Metrics (Prometheus scrape) | http://localhost:8080/metrics |
| Auth mock service | http://localhost:3001 |
| User mock service | http://localhost:3002 |
| Payment mock service | http://localhost:3004 |
| Prometheus | http://localhost:9091 |
| Grafana | http://localhost:3000 *(monitoring profile)* |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | — | HS256 signing secret, min 32 chars |
| `ADMIN_TOKEN` | **Yes** | — | Bearer token for `/admin/*` endpoints |
| `REDIS_PASSWORD` | **Yes** | `gateway-redis-pass` | Redis auth password |
| `GATEWAY_PORT` | No | `8080` | Port the gateway listens on |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `REDIS_ENABLED` | No | `true` | Enable distributed rate limiting & cache |
| `CACHE_DEFAULT_TTL` | No | `300` | Response cache TTL in seconds |
| `TLS_ENABLED` | No | `false` (dev) | Enable TLS termination |

Generate secure values:

```bash
# JWT secret (64-char hex)
openssl rand -hex 32

# Admin token (32-char hex)
openssl rand -hex 16
```
