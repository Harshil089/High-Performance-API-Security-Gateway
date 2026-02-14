# Quick Start: New Features

This guide shows you how to quickly enable and test the new features.

## 1. Enable Prometheus Metrics (5 minutes)

### Step 1: Configuration is already enabled by default

The metrics are already configured in `config/gateway.json`:

```json
{
  "metrics": {
    "enabled": true,
    "port": 9090
  }
}
```

### Step 2: Start the gateway

```bash
cd build
./api-gateway --config ../config/gateway.json
```

### Step 3: View metrics

```bash
curl http://localhost:9090/metrics
```

You should see:
```
# HELP gateway_requests_total Total number of requests
# TYPE gateway_requests_total counter
gateway_requests_total 0

# HELP gateway_auth_success_total Total successful authentications
# TYPE gateway_auth_success_total counter
gateway_auth_success_total 0
...
```

### Step 4: Generate some traffic

```bash
# Send test requests
for i in {1..10}; do
  curl http://localhost:8080/health
done

# View updated metrics
curl http://localhost:9090/metrics | grep gateway_requests_total
```

---

## 2. Enable Admin API (10 minutes)

### Step 1: Generate admin token

```bash
export ADMIN_TOKEN=$(openssl rand -hex 32)
echo "Your admin token: $ADMIN_TOKEN"
```

### Step 2: Enable admin API in config

Edit `config/gateway.json`:

```json
{
  "admin": {
    "enabled": true,
    "token": "${ADMIN_TOKEN}",
    "allowed_ips": ["127.0.0.1"]
  }
}
```

### Step 3: Restart gateway with token

```bash
export ADMIN_TOKEN="your-token-from-step-1"
cd build
./api-gateway --config ../config/gateway.json
```

### Step 4: Test admin endpoints

```bash
# View current configuration
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/config | jq .

# View cache stats
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/stats | jq .

# Clear cache
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/clear
```

---

## 3. Test WebSocket Support (15 minutes)

### Step 1: Enable WebSocket in config

Edit `config/gateway.json`:

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

### Step 2: Add WebSocket route

Edit `config/routes.json`, add:

```json
{
  "path": "/ws/*",
  "backends": ["ws://localhost:3005"],
  "load_balancing": "round_robin",
  "require_auth": false,
  "protocol": "websocket"
}
```

### Step 3: Create simple WebSocket test server

```bash
cd mock-services
npm install ws

# Create test-ws-server.js
cat > test-ws-server.js << 'EOF'
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3005 });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server listening on port 3005');
EOF

node test-ws-server.js &
```

### Step 4: Test WebSocket connection

```bash
# Install wscat for testing
npm install -g wscat

# Connect through gateway
wscat -c ws://localhost:8080/ws/test

# Type messages and see echoes
> Hello WebSocket
< Echo: Hello WebSocket
```

---

## 4. Complete Feature Test (30 minutes)

### Scenario: Complete gateway with all features

#### Step 1: Start all services

```bash
# Terminal 1: Start mock services
cd mock-services
npm install
node auth-service.js &
node user-service.js &
node test-ws-server.js &

# Terminal 2: Start gateway with all features
cd build
export JWT_SECRET=$(openssl rand -base64 32)
export ADMIN_TOKEN=$(openssl rand -hex 32)
echo "Admin token: $ADMIN_TOKEN"
./api-gateway --config ../config/gateway.json
```

#### Step 2: Test authentication flow

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_admin","password":"change-me-admin"}' \
  | jq -r '.token')

echo "JWT Token: $TOKEN"

# Access protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users
```

#### Step 3: Test rate limiting

```bash
# Send rapid requests to trigger rate limit
for i in {1..20}; do
  curl -s http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' \
  | jq -r '.message // .error'
done

# Should see "Rate limit exceeded" after 5 requests
```

#### Step 4: View metrics

```bash
# Check metrics
curl http://localhost:9090/metrics | grep -E "(requests_total|auth_|rate_limit)"
```

You should see:
```
gateway_requests_total 25
gateway_auth_success_total 1
gateway_auth_failures_total 19
gateway_rate_limit_hits_total 15
gateway_rate_limit_allowed_total 5
```

#### Step 5: Use Admin API

```bash
# View all requests stats
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/config | jq .

# Reset rate limit for your IP
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "ip:127.0.0.1"}' \
  http://localhost:8080/admin/ratelimit/reset
```

#### Step 6: Test WebSocket

```bash
# Connect WebSocket client
wscat -c ws://localhost:8080/ws/test

# Send messages
> {"type": "ping"}
< Echo: {"type": "ping"}

> {"type": "message", "data": "Hello from client"}
< Echo: {"type": "message", "data": "Hello from client"}
```

---

## 5. Monitor with Prometheus & Grafana (Optional)

### Install Prometheus

```bash
# macOS
brew install prometheus

# Configure prometheus.yml
cat > /opt/homebrew/etc/prometheus.yml << EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:9090']
EOF

# Start Prometheus
prometheus --config.file=/opt/homebrew/etc/prometheus.yml
```

Access Prometheus UI: http://localhost:9090

### Install Grafana

```bash
# macOS
brew install grafana

# Start Grafana
brew services start grafana
```

Access Grafana: http://localhost:3000 (admin/admin)

### Import Gateway Dashboard

1. Login to Grafana
2. Add Prometheus data source: http://localhost:9090
3. Import dashboard with ID: 12345 (if published) or create custom

---

## Testing Checklist

Use this checklist to verify all features work:

### Core Features
- [ ] Gateway starts successfully
- [ ] Health check returns 200: `curl http://localhost:8080/health`
- [ ] JWT authentication works
- [ ] Protected endpoints require auth
- [ ] Rate limiting blocks excess requests

### New Features
- [ ] Metrics endpoint responds: `curl http://localhost:9090/metrics`
- [ ] Metrics show request counts
- [ ] Admin API requires token
- [ ] Admin API can view config
- [ ] Admin API can reset rate limits
- [ ] WebSocket upgrade works
- [ ] WebSocket messages are proxied

### Load Testing
- [ ] Handle 1000 concurrent requests
- [ ] Latency stays under 50ms
- [ ] Memory usage stays under 100MB
- [ ] No crashes under load

---

## Common Issues & Solutions

### Issue: Metrics port already in use

```bash
# Find process using port 9090
lsof -i :9090

# Kill it or change metrics port in config
```

### Issue: Admin API returns 401

```bash
# Verify token matches
echo $ADMIN_TOKEN

# Check Authorization header format
# Should be: Authorization: Bearer <token>
```

### Issue: WebSocket connection refused

```bash
# Check WebSocket is enabled in config
cat config/gateway.json | jq .websocket.enabled

# Verify backend WebSocket server is running
nc -zv localhost 3005
```

### Issue: High memory usage

```bash
# Check active connections
curl http://localhost:9090/metrics | grep active_connections

# Review cache settings
cat config/gateway.json | jq .cache

# Restart gateway to clear memory
```

---

## Next Steps

Now that you have all features working:

1. **Production Deployment**: See [PRODUCTION.md](PRODUCTION.md)
2. **Advanced Configuration**: See [FEATURES.md](FEATURES.md)
3. **Performance Tuning**: See [PERFORMANCE.md](PERFORMANCE.md) (if exists)
4. **Redis Integration**: See "Redis Integration" in [FEATURES.md](FEATURES.md)

---

## Quick Commands Reference

```bash
# Start everything
export JWT_SECRET=$(openssl rand -base64 32)
export ADMIN_TOKEN=$(openssl rand -hex 32)
cd mock-services && node auth-service.js & node user-service.js &
cd ../build && ./api-gateway --config ../config/gateway.json

# Test auth
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_admin","password":"change-me-admin"}' | jq -r '.token')

# View metrics
curl http://localhost:9090/metrics

# Admin API
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8080/admin/config | jq .

# Test WebSocket
wscat -c ws://localhost:8080/ws/test

# Stop everything
pkill -f "node.*service" && pkill -f api-gateway
```
