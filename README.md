# High-Performance API Security Gateway

A **production-ready, high-performance API gateway** built in C++17 that consolidates authentication, authorization, rate limiting, caching, request routing, and security validation into a single, efficient binary.

## The Problem

Modern microservices architectures face critical challenges:

- **Security Sprawl** -- Every microservice implements its own auth, creating inconsistent policies and a larger attack surface
- **Performance Bottlenecks** -- Traditional gateways (Kong, AWS API Gateway) add 20-50ms latency; interpreted languages struggle under load
- **Operational Complexity** -- Managing separate services for auth, rate limiting, caching, and routing
- **Scale Limitations** -- Most gateways can't efficiently handle 10,000+ req/s on commodity hardware

## The Solution

A single C++ binary that handles the entire API gateway pipeline with sub-10ms latency:

```
Client Request
     |
     v
┌─────────────────────────────────────────────────────────┐
│                   API Security Gateway                   │
│                                                          │
│  IP Filtering ──> Security Validation ──> Rate Limiting  │
│       |                                       |          │
│       v                                       v          │
│  JWT / API Key Auth ──> Route Matching ──> Redis Cache   │
│                              |                           │
│                              v                           │
│                    Proxy + Circuit Breaker                │
│                              |                           │
│              ┌───────────────┼───────────────┐           │
│              v               v               v           │
│         Auth Service    User Service    Payment Service   │
│                                                          │
│  Prometheus Metrics ──> Grafana Dashboard                │
│  Admin API ──> Runtime Configuration                     │
└─────────────────────────────────────────────────────────┘
```

## Features

### Core Gateway
- **Pattern-based routing** with wildcard matching (`/api/users/*` -> User Service)
- **Load balancing** across multiple backend instances (round-robin)
- **Circuit breaker** with configurable failure threshold and recovery timeout
- **Background health checks** monitoring all backends periodically
- **Request proxying** with header propagation and `X-Request-ID` tracing

### Security
- **JWT authentication** -- HS256 and RS256 algorithms, RFC 7519 compliant
- **API key authentication** via `X-API-Key` header (checked before JWT)
- **IP whitelist / blacklist** filtering
- **Rate limiting** -- per-IP, per-endpoint, and global limits (token bucket)
- **Input validation** -- SQL injection, XSS, path traversal detection
- **Request size limits** -- header and body size enforcement
- **Security headers** -- X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- **CORS** with configurable origins, methods, headers
- **TLS/SSL** termination via OpenSSL

### Caching (Redis)
- **Response caching** for GET requests with configurable TTL
- **`X-Cache: HIT/MISS`** response headers
- **Distributed rate limiting** via Redis sorted sets
- **Cache stats** exposed through Admin API

### Admin API
- `GET /admin/config` -- View current gateway configuration
- `POST /admin/config` -- Update configuration at runtime
- `GET /admin/cache/stats` -- Redis cache statistics
- `POST /admin/cache/clear` -- Clear cached responses
- `POST /admin/ratelimit/reset` -- Reset rate limit for a key
- `POST /admin/reload` -- Reload configuration from disk

All admin endpoints require Bearer token authentication.

### Observability
- **Prometheus metrics** at `/metrics` -- request counts, auth success/failure, rate limit hits, backend latency, request duration, active connections
- **Grafana dashboard** with 9 pre-configured panels (request rate, status codes, latency, cache hit rate, etc.)
- **Structured JSON logging** with request IDs, client IPs, response times
- **`X-Request-ID`** propagated through the full request chain

## Quick Start

### Docker (Recommended)

```bash
# Clone the repository
git clone <repo-url>
cd High-Performance-API-Security-Gateway

# Create .env (or use the provided one)
cp .env.example .env
# Edit .env and set JWT_SECRET (minimum 32 characters)

# Start everything
docker compose up -d --build

# Verify all containers are healthy
docker compose ps
```

This starts 4 containers:
| Service | Port | Description |
|---------|------|-------------|
| `api-gateway` | 8080 | The C++ gateway |
| `redis` | 6379 | Cache + distributed rate limiting |
| `auth-service` | 3001 | Mock authentication service |
| `user-service` | 3002 | Mock user service |

Optional monitoring (add `--profile monitoring`):
| Service | Port | Description |
|---------|------|-------------|
| `prometheus` | 9091 | Metrics collection |
| `grafana` | 3000 | Dashboard visualization |

### Test It

```bash
# 1. Health check
curl http://localhost:8080/health

# 2. Prometheus metrics
curl http://localhost:8080/metrics

# 3. Login and get a JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_admin","password":"change-me-admin"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 4. Access protected endpoint (first call: X-Cache: MISS)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users

# 5. Same request again (X-Cache: HIT, served from Redis)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/users

# 6. Admin API -- view config
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8080/admin/config

# 7. Admin API -- cache stats
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8080/admin/cache/stats
```

### Build from Source

```bash
# Prerequisites: C++17 compiler, CMake 3.25+, OpenSSL, uuid-dev
./build.sh

# Run
cd build && ./api-gateway --config ../config/gateway.json --routes ../config/routes.json
```

## Configuration

### Gateway Configuration (`config/gateway.json`)

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "max_connections": 1000,
    "max_body_size": 10485760,
    "tls": { "enabled": false, "cert_file": "config/cert.pem", "key_file": "config/key.pem" }
  },
  "jwt": {
    "algorithm": "HS256",
    "secret": "${JWT_SECRET}",
    "issuer": "api-gateway",
    "audience": "api-clients",
    "access_token_expiry": 3600,
    "public_key_file": "",
    "private_key_file": ""
  },
  "rate_limits": {
    "global": { "requests": 10000, "window": 60 },
    "per_ip": { "requests": 100, "window": 60 },
    "per_ip_connections": 10,
    "endpoints": {
      "/api/auth/login": { "requests": 5, "window": 60 }
    }
  },
  "security": {
    "max_header_size": 8192,
    "allowed_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    "ip_whitelist": [],
    "ip_blacklist": [],
    "api_keys": {},
    "cors": {
      "enabled": true,
      "allowed_origins": ["http://localhost:3000"],
      "allowed_headers": ["Authorization", "Content-Type", "X-Request-ID"],
      "allowed_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      "max_age": 3600
    },
    "headers": {
      "x_frame_options": "DENY",
      "x_content_type_options": "nosniff",
      "x_xss_protection": "1; mode=block",
      "referrer_policy": "strict-origin-when-cross-origin"
    }
  },
  "backends": {
    "health_check_interval": 10,
    "circuit_breaker": { "failure_threshold": 5, "recovery_timeout": 60 }
  },
  "redis": {
    "enabled": false,
    "uri": "tcp://127.0.0.1:6379",
    "password": "${REDIS_PASSWORD}"
  },
  "cache": {
    "enabled": false,
    "default_ttl": 300,
    "cacheable_methods": ["GET"],
    "exclude_paths": ["/api/auth/*", "/admin/*"]
  },
  "admin": {
    "enabled": false,
    "token": "${ADMIN_TOKEN}"
  },
  "metrics": {
    "enabled": true,
    "path": "/metrics"
  }
}
```

### Route Configuration (`config/routes.json`)

```json
{
  "routes": [
    {
      "path": "/api/auth/*",
      "backend": "http://localhost:3001",
      "rewrite": "/*",
      "timeout": 5000,
      "require_auth": false,
      "strip_prefix": "/api/auth"
    },
    {
      "path": "/api/users/*",
      "backends": ["http://localhost:3002"],
      "load_balancing": "round_robin",
      "timeout": 3000,
      "require_auth": true,
      "strip_prefix": "/api"
    }
  ]
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (min 32 chars) | **Required** |
| `ADMIN_TOKEN` | Admin API bearer token | - |
| `ADMIN_ENABLED` | Enable Admin API | `false` |
| `REDIS_ENABLED` | Enable Redis integration | `false` |
| `REDIS_HOST` | Redis hostname | `127.0.0.1` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `CACHE_ENABLED` | Enable response caching | `false` |

In Docker, `REDIS_ENABLED`, `CACHE_ENABLED`, and `ADMIN_ENABLED` default to `true`.

### IP Filtering

```json
"security": {
  "ip_whitelist": ["10.0.0.1", "10.0.0.2"],
  "ip_blacklist": ["192.168.1.100"]
}
```

- **Blacklist** takes priority -- blacklisted IPs are always rejected
- **Whitelist** is only enforced if non-empty -- when set, only listed IPs are allowed

### API Key Authentication

```json
"security": {
  "api_keys": {
    "sk_live_abc123": "Production key for Service A",
    "sk_test_xyz789": "Test key for development"
  }
}
```

Clients authenticate with `X-API-Key: sk_live_abc123` header. API keys are checked before JWT.

### RS256 JWT

```json
"jwt": {
  "algorithm": "RS256",
  "public_key_file": "config/public.pem",
  "private_key_file": "config/private.pem"
}
```

## Project Structure

```
├── src/
│   ├── main.cpp                    # Entry point, wiring
│   ├── server/
│   │   ├── HttpServer.h/cpp        # HTTP server, request pipeline
│   │   └── Response.h              # Response helpers
│   ├── auth/
│   │   └── JWTManager.h/cpp        # JWT validation (HS256/RS256)
│   ├── rate_limiter/
│   │   ├── RateLimiter.h/cpp       # In-memory token bucket
│   │   └── RedisRateLimiter.h/cpp  # Distributed rate limiting
│   ├── router/
│   │   ├── Router.h/cpp            # Pattern-based routing
│   │   ├── ProxyManager.h/cpp      # Backend proxy + circuit breaker
│   │   └── WebSocketProxy.h/cpp    # WebSocket support
│   ├── security/
│   │   ├── SecurityValidator.h/cpp # Input validation, IP filtering, API keys
│   │   └── TLSManager.h/cpp       # TLS configuration
│   ├── cache/
│   │   └── RedisCache.h/cpp        # Redis response caching
│   ├── admin/
│   │   └── AdminAPI.h/cpp          # Runtime admin endpoints
│   ├── metrics/
│   │   └── SimpleMetrics.h/cpp     # Prometheus metrics
│   ├── logging/
│   │   └── Logger.h/cpp            # Async structured logging
│   └── config/
│       └── ConfigManager.h/cpp     # JSON config loading
├── tests/                          # Google Test unit tests
├── config/                         # Gateway and route configs
├── mock-services/                  # Node.js mock backends
├── monitoring/
│   ├── prometheus.yml              # Prometheus scrape config
│   └── grafana/
│       ├── dashboards/             # Pre-built Grafana dashboard
│       └── datasources/            # Prometheus datasource
├── CMakeLists.txt                  # Build configuration
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Full stack orchestration
└── .env                            # Environment variables
```

## Performance

| Metric | Value |
|--------|-------|
| Throughput | 10,000+ req/s (single core) |
| P95 Latency | < 10ms (including JWT validation) |
| Memory Usage | ~80MB under load |
| Cache Hit Latency | < 1ms (Redis) |
| Binary Size | ~15MB |
| Docker Image | ~50MB |

### Comparison

| Feature | Kong | AWS API GW | Envoy | **This Gateway** |
|---------|------|------------|-------|------------------|
| Latency (p95) | 20-50ms | 30-50ms | 5-15ms | **< 10ms** |
| Memory | 800MB | N/A | 200-300MB | **~80MB** |
| Dependencies | PostgreSQL | AWS | - | **Redis (optional)** |
| Codebase | 100K+ LOC | Closed | 500K+ LOC | **~5K LOC** |

## Monitoring

### Prometheus Metrics (`/metrics`)

```
gateway_http_requests_total{method="GET",path="/api/users",status="200"} 42
gateway_auth_success_total 38
gateway_auth_failures_total 4
gateway_rate_limit_hits_total 2
gateway_request_duration_ms{method="GET",quantile="avg"} 8.5
gateway_backend_latency_ms{backend="http://user-service:3002"} 12.3
```

### Grafana Dashboard

Start the monitoring profile:

```bash
docker compose --profile monitoring up -d
```

Access Grafana at `http://localhost:3000` (admin/admin). The pre-configured dashboard includes:
- Request rate (req/s)
- HTTP status code distribution
- Active connections
- Auth success/failure rate
- Backend latency per service
- Rate limit hits vs allowed
- Backend error rate
- Request duration distribution
- Cache hit rate percentage

### Structured Logs

```json
{
  "timestamp": "2026-02-15T06:18:28.513Z",
  "request_id": "7e0a1875-9916-4f96-885e-270b0c08997c",
  "client_ip": "192.168.65.1",
  "method": "GET",
  "path": "/api/users",
  "status": 200,
  "response_time_ms": 26,
  "user_id": "user_001",
  "backend": "http://user-service:3002"
}
```

## Testing

```bash
# Unit tests (inside Docker build)
cd build && ./gateway-tests

# Integration test (with Docker running)
curl http://localhost:8080/health                    # Health check
curl http://localhost:8080/metrics                   # Metrics
curl -X POST http://localhost:8080/api/auth/login \  # Auth
  -H "Content-Type: application/json" \
  -d '{"username":"demo_admin","password":"change-me-admin"}'

# Load test
wrk -t8 -c400 -d30s http://localhost:8080/api/users \
  -H "Authorization: Bearer $TOKEN"
```

## Production Deployment

### Security Checklist

- [ ] Set a strong `JWT_SECRET` (min 32 random characters)
- [ ] Set a strong `ADMIN_TOKEN`
- [ ] Enable TLS with valid certificates
- [ ] Remove demo credentials
- [ ] Restrict CORS origins
- [ ] Configure IP whitelist/blacklist as needed
- [ ] Set appropriate rate limits for your traffic
- [ ] Run as non-root user (Docker image does this by default)
- [ ] Mount config as read-only volumes

### Scaling

- **Horizontal**: Run multiple gateway instances behind a load balancer; Redis provides shared cache and rate limit state
- **Vertical**: Single instance handles 10K+ req/s; increase `max_connections` for more concurrent connections

## Dependencies

All fetched automatically via CMake FetchContent:

| Library | Version | Purpose |
|---------|---------|---------|
| [cpp-httplib](https://github.com/yhirose/cpp-httplib) | 0.15.3 | HTTP server |
| [jwt-cpp](https://github.com/Thalhammer/jwt-cpp) | 0.6.0 | JWT validation |
| [nlohmann/json](https://github.com/nlohmann/json) | 3.11.3 | JSON parsing |
| [spdlog](https://github.com/gabime/spdlog) | 1.13.0 | Async logging |
| [Google Test](https://github.com/google/googletest) | 1.14.0 | Unit testing |
| [hiredis](https://github.com/redis/hiredis) | 1.2.0 | Redis C client |
| [redis-plus-plus](https://github.com/sewenew/redis-plus-plus) | 1.3.10 | Redis C++ client |
| [OpenSSL](https://www.openssl.org/) | 3.x | TLS + crypto |

## License

MIT License - see [LICENSE](LICENSE) for details.
