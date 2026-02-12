# API Gateway Architecture

## System Overview

The API Gateway is designed as a high-performance, security-focused reverse proxy that sits between client applications and backend microservices. It implements enterprise-grade features including authentication, rate limiting, request routing, and comprehensive logging.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                     │
│              (Web, Mobile, Desktop, APIs)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Load Balancer (Optional)                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  C++ API GATEWAY (Port 8080)                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              HTTP Server (cpp-httplib)                  │ │
│  │  - Request parsing                                      │ │
│  │  - Connection management (1000+ concurrent)             │ │
│  │  - TLS/SSL termination                                  │ │
│  └───────────────────────┬────────────────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┼────────────────────────────────┐ │
│  │         Security Validator                              │ │
│  │  - Path validation                                      │ │
│  │  - Header/body size limits                              │ │
│  │  - SQL injection detection                              │ │
│  │  - XSS prevention                                       │ │
│  │  - DoS protection                                       │ │
│  └───────────────────────┼────────────────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┼────────────────────────────────┐ │
│  │         Rate Limiter (Token Bucket)                     │ │
│  │  - Global limits                                        │ │
│  │  - Per-IP limits                                        │ │
│  │  - Per-endpoint limits                                  │ │
│  │  - Thread-safe buckets                                  │ │
│  └───────────────────────┼────────────────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┼────────────────────────────────┐ │
│  │         JWT Manager (jwt-cpp)                           │ │
│  │  - Token generation (HS256/RS256)                       │ │
│  │  - Token validation                                     │ │
│  │  - Claims extraction                                    │ │
│  │  - Expiration checking                                  │ │
│  └───────────────────────┼────────────────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┼────────────────────────────────┐ │
│  │         Router (Pattern Matching)                       │ │
│  │  - Regex-based routing                                  │ │
│  │  - Load balancing (round-robin)                         │ │
│  │  - Path rewriting                                       │ │
│  └───────────────────────┼────────────────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┼────────────────────────────────┐ │
│  │         Proxy Manager                                   │ │
│  │  - HTTP client for backends                             │ │
│  │  - Circuit breaker                                      │ │
│  │  - Health checks                                        │ │
│  │  - Timeout handling                                     │ │
│  └───────────────────────┼────────────────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┼────────────────────────────────┐ │
│  │         Logger (spdlog)                                 │ │
│  │  - Async logging                                        │ │
│  │  - JSON formatting                                      │ │
│  │  - Log rotation                                         │ │
│  │  - Sensitive data masking                               │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Auth Service │ │ User Service │ │Payment Service│
│ (Port 3001)  │ │ (Port 3002)  │ │ (Port 3004)  │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Component Details

### 1. HTTP Server

**Technology**: cpp-httplib
**Responsibility**: HTTP/HTTPS request handling

**Features**:
- Non-blocking I/O
- Connection pooling
- Keep-alive support
- TLS/SSL encryption
- CORS support

**Performance**:
- Handles 1000+ concurrent connections
- Sub-millisecond request parsing
- Memory-efficient connection management

### 2. Security Validator

**Responsibility**: Input validation and security enforcement

**Checks**:
- Path traversal prevention (`../`, `./`, `\`)
- Header size limits (max 8KB)
- Body size limits (max 10MB)
- Method validation
- SQL injection patterns
- XSS patterns
- Null byte detection
- Connection limits per IP

**Patterns Detected**:
- SQL: `' OR '1'='1`, `UNION SELECT`, `DROP TABLE`, etc.
- XSS: `<script>`, `javascript:`, `onerror=`, etc.

### 3. Rate Limiter

**Algorithm**: Token Bucket
**Responsibility**: Request rate limiting

**Levels**:
1. **Global**: Total requests across all clients
2. **Per-IP**: Requests per client IP
3. **Per-Endpoint**: Requests per specific endpoint

**Implementation**:
```cpp
struct TokenBucket {
    int capacity;        // Max tokens
    double tokens;       // Current tokens
    int refill_rate;     // Tokens per second
    time_point last_refill;
    mutex mtx;           // Thread safety
};
```

**Refill Logic**:
- Tokens refill continuously based on elapsed time
- Rate = requests / window_seconds
- Thread-safe with per-bucket mutexes

### 4. JWT Manager

**Technology**: jwt-cpp + OpenSSL
**Responsibility**: Authentication token management

**Algorithms Supported**:
- HS256 (HMAC with SHA-256)
- RS256 (RSA Signature - future)

**Token Structure**:
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user123",
    "iss": "api-gateway",
    "aud": "api-clients",
    "iat": 1634567890,
    "exp": 1634571490,
    "role": "admin"
  },
  "signature": "..."
}
```

**Validation Steps**:
1. Decode token
2. Verify signature
3. Check expiration
4. Validate issuer/audience
5. Extract claims

### 5. Router

**Responsibility**: Request routing and load balancing

**Route Matching**:
- Converts wildcard patterns to regex
- First match wins
- Supports `*` wildcard

**Load Balancing**:
- Round-robin (default)
- Random
- Future: Least connections

**Path Rewriting**:
- Strip prefix: `/api/users/123` → `/users/123`
- Configurable per route

### 6. Proxy Manager

**Responsibility**: Backend communication

**Features**:
- HTTP client for forwarding requests
- Connection pooling
- Timeout enforcement
- Circuit breaker pattern
- Health checking

**Circuit Breaker States**:
```
CLOSED ──(5 failures)──> OPEN ──(60s timeout)──> HALF_OPEN
  ▲                                                    │
  └────────────────(success)──────────────────────────┘
```

**State Machine**:
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Failing backend, reject requests immediately
- **HALF_OPEN**: Testing recovery, allow 1-3 requests

### 7. Logger

**Technology**: spdlog
**Responsibility**: Structured logging

**Log Levels**: DEBUG, INFO, WARN, ERROR

**Log Format** (JSON):
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "client_ip": "192.168.1.100",
  "method": "POST",
  "path": "/api/users",
  "status": 201,
  "response_time_ms": 45,
  "user_id": "user_12345",
  "backend": "http://localhost:3002"
}
```

**Features**:
- Async logging (non-blocking)
- Log rotation (100MB per file, 10 files max)
- Sensitive data masking
- Dual output (file + console)

## Request Flow

### 1. Unauthenticated Request

```
Client → Gateway
  ↓
  1. HTTP Server parses request
  2. Security Validator checks path/headers/body
  3. Rate Limiter checks IP + endpoint limits
  4. Router matches route
  5. If route.require_auth = false, skip JWT validation
  6. Proxy Manager forwards to backend
  7. Response returned to client
  8. Logger records request
```

### 2. Authenticated Request

```
Client → Gateway (with JWT)
  ↓
  1. HTTP Server parses request
  2. Security Validator checks input
  3. Rate Limiter checks limits
  4. Router matches route
  5. If route.require_auth = true:
     - Extract Authorization header
     - JWT Manager validates token
     - Extract user_id from claims
  6. Proxy Manager forwards to backend
  7. Response returned
  8. Logger records with user_id
```

### 3. Rate Limited Request

```
Client → Gateway
  ↓
  1. HTTP Server parses request
  2. Security Validator checks input
  3. Rate Limiter checks:
     - Global bucket → OK
     - Per-IP bucket → FAIL (no tokens)
     - Return HTTP 429 + Retry-After header
  4. Response returned immediately
  5. Logger records rate limit event
```

### 4. Circuit Breaker Open

```
Client → Gateway
  ↓
  1-4. Normal validation/routing
  5. Proxy Manager checks backend health
     - Circuit state = OPEN
     - Check if recovery timeout passed
     - If not, return HTTP 503 immediately
  6. Response returned
  7. Logger records circuit breaker event
```

## Data Flow

### Configuration Loading

```
main.cpp
  ↓
  ConfigManager::loadConfig("gateway.json")
  ↓
  Expand environment variables (${JWT_SECRET})
  ↓
  Initialize components with config values
```

### Request Processing

```
HTTP Request
  ↓
  HttpServer::handleRequest()
  ↓
  Security checks → Rate limiting → Routing → Auth → Proxying
  ↓
  HTTP Response + Logging
```

## Thread Safety

**Concurrent Components**:
- **Rate Limiter**: Per-bucket mutexes
- **Proxy Manager**: Health status mutexes
- **Security Validator**: Connection tracking mutex
- **Logger**: Async queue (lock-free)

**Lock-Free Components**:
- Router (read-only after initialization)
- JWT Manager (stateless validation)

## Performance Optimizations

1. **Connection Pooling**: Reuse backend connections
2. **Async I/O**: Non-blocking operations
3. **Thread Pooling**: Reuse threads for request handling
4. **Memory Pools**: Pre-allocated token buckets
5. **Efficient Parsing**: Zero-copy where possible
6. **Regex Caching**: Pre-compiled route patterns

## Scalability

### Vertical Scaling
- Increase worker threads
- Increase connection pool size
- Increase rate limit buckets

### Horizontal Scaling
- Deploy multiple gateway instances
- Use load balancer (nginx, HAProxy)
- Shared rate limiting via Redis
- Shared session storage

## Security Architecture

**Defense in Depth**:
1. Network: TLS/SSL encryption
2. Application: Input validation
3. Authentication: JWT tokens
4. Authorization: Per-route auth requirements
5. Rate Limiting: DoS prevention
6. Logging: Audit trail

**Security Headers**:
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Content-Security-Policy` (future)

## Monitoring & Observability

**Metrics** (Future Integration):
- Request count
- Response time (p50, p95, p99)
- Error rate
- Rate limit hits
- Circuit breaker trips
- Backend health status

**Logging**:
- Structured JSON logs
- Request/response logging
- Error logging
- Security event logging

**Tracing** (Future):
- Distributed tracing with OpenTelemetry
- Request ID propagation
- Span creation for each component

## Failure Handling

**Timeouts**:
- Connection timeout: 30s
- Request timeout: 30s
- Backend timeout: 5s (configurable per route)

**Retries**:
- Circuit breaker handles backend failures
- No automatic retries (client responsibility)

**Graceful Degradation**:
- Circuit breaker prevents cascade failures
- Rate limiting prevents overload
- Health checks detect failing backends

## Configuration Management

**Configuration Sources**:
1. JSON files (`gateway.json`, `routes.json`)
2. Environment variables (e.g., `JWT_SECRET`)
3. Command-line arguments

**Hot Reload** (Future):
- Watch config files for changes
- Reload routes without restart
- Graceful configuration updates

## Deployment

**Containerization**:
```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    build-essential cmake libssl-dev
COPY . /app
WORKDIR /app
RUN ./build.sh
EXPOSE 8080
CMD ["./build/api-gateway"]
```

**Systemd Service**:
```ini
[Unit]
Description=API Gateway
After=network.target

[Service]
Type=simple
User=gateway
ExecStart=/opt/gateway/api-gateway
Restart=always

[Install]
WantedBy=multi-user.target
```

## Future Enhancements

1. **WebSocket Support**: Proxy WebSocket connections
2. **GraphQL Gateway**: Aggregate GraphQL APIs
3. **Response Caching**: Redis-backed cache
4. **API Versioning**: Route based on version header
5. **Request Transformation**: Modify requests/responses
6. **Plugin System**: Loadable modules for custom logic
7. **Metrics Export**: Prometheus endpoint
8. **Admin Dashboard**: Web UI for monitoring
9. **Distributed Tracing**: OpenTelemetry integration
10. **Machine Learning**: Anomaly detection

## References

- [cpp-httplib Documentation](https://github.com/yhirose/cpp-httplib)
- [jwt-cpp Documentation](https://github.com/Thalhammer/jwt-cpp)
- [spdlog Documentation](https://github.com/gabime/spdlog)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
