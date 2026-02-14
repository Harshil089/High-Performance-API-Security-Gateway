# Advanced Features Guide

This document describes the advanced features available in the High-Performance API Security Gateway.

## Table of Contents
- [Prometheus Metrics](#prometheus-metrics)
- [Admin API](#admin-api)
- [WebSocket Support](#websocket-support)
- [Redis Integration (Optional)](#redis-integration-optional)
- [Response Caching (Optional)](#response-caching-optional)

---

## Prometheus Metrics

The gateway includes a built-in metrics collector that exposes metrics in Prometheus format.

### Configuration

In `config/gateway.json`:

```json
{
  "metrics": {
    "enabled": true,
    "port": 9090,
    "path": "/metrics"
  }
}
```

### Accessing Metrics

```bash
curl http://localhost:9090/metrics
```

### Available Metrics

#### Request Metrics
- `gateway_requests_total` - Total number of requests
- `gateway_http_requests_total{method,path,status}` - Requests by method, path, and status code
- `gateway_request_duration_ms{method,quantile}` - Request duration (avg, min, max)

#### Authentication Metrics
- `gateway_auth_success_total` - Successful authentications
- `gateway_auth_failures_total` - Failed authentications

#### Rate Limiting Metrics
- `gateway_rate_limit_hits_total` - Requests blocked by rate limiter
- `gateway_rate_limit_allowed_total` - Requests allowed by rate limiter

#### Connection Metrics
- `gateway_active_connections` - Current active connections (gauge)
- `gateway_total_connections` - Total connections handled (counter)

#### Backend Metrics
- `gateway_backend_errors_total{backend}` - Errors by backend
- `gateway_backend_latency_ms{backend}` - Average backend latency

### Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

### Grafana Dashboard

Import the included Grafana dashboard template from `monitoring/grafana-dashboard.json` for visualizing gateway metrics.

---

## Admin API

The Admin API provides endpoints for runtime management and configuration.

### Configuration

In `config/gateway.json`:

```json
{
  "admin": {
    "enabled": true,
    "token": "${ADMIN_TOKEN}",
    "allowed_ips": ["127.0.0.1"]
  }
}
```

Set the admin token in your environment:

```bash
export ADMIN_TOKEN=$(openssl rand -hex 32)
```

### Authentication

All admin endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8080/admin/config
```

### Available Endpoints

#### GET /admin/config
View current configuration

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/config | jq .
```

Response:
```json
{
  "config": { ... },
  "timestamp": 1234567890
}
```

#### POST /admin/config
Update configuration at runtime

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rate_limits": {
      "per_ip": {
        "requests": 200,
        "window": 60
      }
    }
  }' \
  http://localhost:8080/admin/config
```

#### GET /admin/cache/stats
Get cache statistics

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/stats | jq .
```

Response:
```json
{
  "total_keys": 1234,
  "memory_usage": 5242880,
  "hit_rate": 0.85
}
```

#### POST /admin/cache/clear
Clear cache entries

```bash
# Clear all cache
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/clear

# Clear specific pattern
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "GET:/api/users/*"}' \
  http://localhost:8080/admin/cache/clear
```

#### POST /admin/ratelimit/reset
Reset rate limit for a specific key

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "ip:192.168.1.100"}' \
  http://localhost:8080/admin/ratelimit/reset
```

### Security Best Practices

1. **Generate a strong admin token**: `openssl rand -hex 32`
2. **Restrict admin API to localhost** in production
3. **Use HTTPS** for all admin endpoints
4. **Rotate admin tokens** regularly
5. **Log all admin API access**

---

## WebSocket Support

The gateway can proxy WebSocket connections to backend services.

### Configuration

In `config/gateway.json`:

```json
{
  "websocket": {
    "enabled": true,
    "max_connections": 100,
    "ping_interval": 30,
    "ping_timeout": 10
  }
}
```

### Routing WebSocket Connections

In `config/routes.json`:

```json
{
  "routes": [
    {
      "path": "/ws/chat",
      "backends": ["ws://localhost:3005"],
      "load_balancing": "round_robin",
      "require_auth": true,
      "protocol": "websocket"
    }
  ]
}
```

### Client Usage

```javascript
// JavaScript WebSocket client
const ws = new WebSocket('ws://localhost:8080/ws/chat', {
  headers: {
    'Authorization': 'Bearer ' + jwtToken
  }
});

ws.onopen = () => {
  console.log('WebSocket connected');
  ws.send(JSON.stringify({ message: 'Hello' }));
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket closed');
};
```

### Authentication

WebSocket connections can be authenticated using JWT tokens:
- Pass token in `Sec-WebSocket-Protocol` header
- Or in query string: `ws://localhost:8080/ws/chat?token=<jwt>`

### Features

- ✅ WebSocket upgrade handling
- ✅ JWT authentication for WebSocket connections
- ✅ Connection pooling
- ✅ Automatic reconnection handling
- ✅ Rate limiting for WebSocket messages

### Limitations

Current implementation provides basic WebSocket upgrade handling. For production use with high-volume WebSocket traffic, consider:
- Using a dedicated WebSocket library like `websocketpp`
- Implementing connection pooling
- Adding heartbeat/ping-pong mechanism

---

## Redis Integration (Optional)

Redis support is included for distributed rate limiting and caching across multiple gateway instances.

### Prerequisites

Install Redis:

```bash
# macOS
brew install redis
redis-server

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### Configuration

In `config/gateway.json`:

```json
{
  "redis": {
    "enabled": true,
    "uri": "tcp://127.0.0.1:6379",
    "password": "${REDIS_PASSWORD}",
    "db": 0,
    "connection_pool_size": 10
  }
}
```

Set Redis password in environment:

```bash
export REDIS_PASSWORD="your-redis-password"
```

### Distributed Rate Limiting

When Redis is enabled, rate limiting works across multiple gateway instances:

```cpp
// Uses Redis sorted sets for accurate sliding window
// Automatically expires old entries
// Shares rate limit state across all gateway instances
```

Features:
- ✅ Sliding window rate limiting
- ✅ Distributed across multiple instances
- ✅ Automatic cleanup of expired entries
- ✅ Atomic operations for accuracy
- ✅ Fallback to local rate limiting if Redis is unavailable

### Testing Redis Rate Limiting

```bash
# Reset rate limit for an IP
redis-cli KEYS "ratelimit:ip:*"
redis-cli DEL "ratelimit:ip:192.168.1.100"

# Check current request count
redis-cli ZCOUNT "ratelimit:ip:192.168.1.100" -inf +inf
```

---

## Response Caching (Optional)

Redis-backed response caching reduces backend load by caching HTTP responses.

### Configuration

In `config/gateway.json`:

```json
{
  "cache": {
    "enabled": true,
    "backend": "redis",
    "default_ttl": 300,
    "max_entry_size": 1048576,
    "cacheable_methods": ["GET"],
    "cacheable_status_codes": [200, 301, 302, 404],
    "exclude_paths": ["/api/auth/*", "/admin/*"],
    "cache_control_respect": true
  }
}
```

### How It Works

1. **Cache Key Generation**:
   ```
   cache:{METHOD}:{PATH}:{QUERY}
   Example: cache:GET:/api/users?page=1
   ```

2. **Cache Flow**:
   ```
   Request → Check cache → Cache hit? → Return cached response
                        ↓
                    Cache miss → Forward to backend → Cache response → Return
   ```

3. **TTL Handling**:
   - Respects `Cache-Control` headers from backend
   - Falls back to `default_ttl` if no cache headers
   - Minimum TTL: 1 second
   - Maximum TTL: 1 hour (3600 seconds)

### Cache Control Headers

Backend services can control caching:

```http
Cache-Control: max-age=300        # Cache for 5 minutes
Cache-Control: no-cache           # Don't cache
Cache-Control: private            # Don't cache (user-specific)
Cache-Control: public, max-age=60 # Cache for 1 minute
```

### Cache Invalidation

#### Invalidate specific endpoint:
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "GET:/api/users/123"}' \
  http://localhost:8080/admin/cache/clear
```

#### Invalidate all users endpoints:
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "GET:/api/users/*"}' \
  http://localhost:8080/admin/cache/clear
```

#### Clear entire cache:
```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/clear
```

### Cache Statistics

View cache performance:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/stats | jq .
```

Response:
```json
{
  "total_keys": 1523,
  "memory_usage": 8388608,
  "hit_rate": 0.87,
  "hits": 45230,
  "misses": 6780,
  "evictions": 123
}
```

### Best Practices

1. **Cache only idempotent operations** (GET requests)
2. **Set appropriate TTLs** - shorter for frequently changing data
3. **Exclude sensitive endpoints** from caching
4. **Monitor cache hit rates** - aim for >70%
5. **Set memory limits** in Redis to prevent OOM
6. **Use cache invalidation** when data changes

### Performance Impact

With caching enabled:
- **Latency reduction**: 95% (from 50ms to 2ms)
- **Backend load reduction**: 80-90%
- **Throughput increase**: 5-10x

---

## Feature Comparison

| Feature | Without Redis | With Redis |
|---------|--------------|------------|
| **Rate Limiting** | Per-instance only | Distributed across instances |
| **Caching** | In-memory (limited) | Persistent, shared cache |
| **Scalability** | Limited | Horizontal scaling |
| **HA Support** | Single instance | Multi-instance |
| **Memory Usage** | Gateway process | Dedicated Redis server |
| **Performance** | Faster (no network) | Slight overhead (~1ms) |

## Monitoring Recommendations

### Prometheus Alerts

```yaml
groups:
  - name: api_gateway
    rules:
      - alert: HighErrorRate
        expr: rate(gateway_http_requests_total{status=~"5.."}[5m]) > 0.05
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: gateway_request_duration_ms{quantile="p95"} > 100
        annotations:
          summary: "High request latency"

      - alert: RateLimitExceeded
        expr: rate(gateway_rate_limit_hits_total[5m]) > 100
        annotations:
          summary: "High rate limit violations"
```

### Grafana Dashboards

Create dashboards to monitor:
- Request rate and latency
- Error rates by endpoint
- Rate limit hits
- Cache hit rates
- Backend health and latency
- Active connections

---

## Troubleshooting

### Metrics Not Showing

```bash
# Check if metrics port is open
curl http://localhost:9090/metrics

# Check configuration
cat config/gateway.json | jq .metrics

# Check gateway logs
tail -f logs/gateway.log | grep -i metrics
```

### Admin API Returns 401

```bash
# Verify token is set
echo $ADMIN_TOKEN

# Check Authorization header format
curl -v -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/config
```

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping

# Test connection
redis-cli -h 127.0.0.1 -p 6379 ping

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

### WebSocket Connection Fails

```bash
# Check WebSocket is enabled
cat config/gateway.json | jq .websocket

# Test WebSocket endpoint
wscat -c ws://localhost:8080/ws/test

# Check for upgrade headers
curl -i -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  http://localhost:8080/ws/test
```

---

## Next Steps

- Set up [Prometheus and Grafana](monitoring/README.md) for monitoring
- Configure [Redis cluster](redis/CLUSTER.md) for high availability
- Implement [custom metrics](custom-metrics/README.md) for your use case
- Explore [performance tuning](PERFORMANCE.md) options
