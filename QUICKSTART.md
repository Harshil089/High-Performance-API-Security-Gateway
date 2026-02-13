# Quick Start Guide

Get the API Gateway running in 5 minutes!

## Prerequisites

- C++17 compatible compiler
- CMake 3.25+
- OpenSSL
- Node.js 14+ (for mock services)

## Installation

### 1. Clone and Build

```bash
git clone https://github.com/yourusername/api-gateway.git
cd api-gateway
./build.sh
```

### 2. Set JWT Secret

```bash
export JWT_SECRET="your-super-secret-key-min-32-characters-long"
```

### 3. Install Mock Services

```bash
cd mock-services
npm install
cd ..
```

### 4. Start Everything

```bash
./run.sh
```

The gateway will start on port 8080 with three mock backend services.

## Test It Out

### Health Check

```bash
curl http://localhost:8080/health
```

Expected response:

```json
{"status":"healthy","service":"api-gateway"}
```

### Login and Get JWT Token

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'
```

Response:

```json
{
  "token": "eyJhbGc...",
  "user_id": "user_001",
  "role": "admin",
  "expires_in": 3600
}
```

### Access Protected Endpoint

```bash
# Capture the token automatically from the login response
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# List all users
curl http://localhost:8080/api/users \
  -H "Authorization: Bearer $TOKEN"

# Get a specific user
curl http://localhost:8080/api/users/1 \
  -H "Authorization: Bearer $TOKEN"
```

Response (list all users):

```json
{
  "users": [
    {"id": 1, "name": "Alice Johnson", "email": "alice@example.com"},
    {"id": 2, "name": "Bob Smith", "email": "bob@example.com"}
  ],
  "total": 4,
  "page": 1,
  "limit": 10
}
```

### Test Rate Limiting

```bash
# Send 10 rapid requests to trigger rate limit
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"secret"}'
  echo ""
done
```

After 5 requests, you'll see:

```json
{
  "error": "Rate limit exceeded"
}
```

## Run Tests

```bash
./test.sh
```

## Run Benchmarks

```bash
# Requires wrk: brew install wrk (macOS) or apt-get install wrk (Linux)
./benchmarks/load_test.sh
```

## Configuration

Edit `config/gateway.json` and `config/routes.json` to customize:

- Server host/port
- JWT settings
- Rate limits
- Routes and backends
- Logging configuration
- Security settings

## Next Steps

- Read [Architecture Documentation](docs/architecture.md)
- Check [API Documentation](docs/api-documentation.md)
- Review [Deployment Guide](docs/deployment-guide.md)
- Explore the codebase in `src/`

## Troubleshooting

### Port 8080 Already in Use

```bash
# Find what's using the port
lsof -i :8080

# Kill the process or change port in config/gateway.json
```

### Build Errors

Make sure you have all dependencies:

```bash
# macOS
brew install cmake openssl ossp-uuid

# Ubuntu
sudo apt-get install build-essential cmake libssl-dev uuid-dev
```

### JWT_SECRET Not Set

```bash
export JWT_SECRET="your-secret-key-min-32-chars"
# Add to ~/.bashrc or ~/.zshrc for persistence
```

## Default Credentials

For mock services:

- Username: `admin`
- Password: `secret`

**Warning**: These are for development only! Change for production.

## Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Tests: Run `./test.sh`

## Features Demonstrated

✅ JWT Authentication
✅ Rate Limiting (Token Bucket)
✅ Request Routing
✅ Load Balancing
✅ Input Validation
✅ Security Checks
✅ Async Logging
✅ Circuit Breaker
✅ Health Checks
✅ CORS Support

Enjoy using the API Gateway! 🚀
