# Docker Deployment Guide

Complete guide to deploying the High-Performance API Security Gateway using Docker.

## Table of Contents
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [One-Command Deployment](#one-command-deployment)
- [What Gets Deployed](#what-gets-deployed)
- [Configuration](#configuration)
- [Accessing Services](#accessing-services)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

---

## Quick Start

**TL;DR - Start everything with one command:**

```bash
# Make scripts executable
chmod +x start-gateway.sh stop-gateway.sh

# Start the gateway (will prompt for JWT secret)
./start-gateway.sh -d

# Start with monitoring (Prometheus + Grafana)
./start-gateway.sh -d --monitoring

# Stop everything
./stop-gateway.sh
```

**That's it!** The script handles everything else automatically.

---

## Prerequisites

### Required
- **Docker** (20.10+)
- **Docker Compose** (2.0+)

### Install Docker

#### macOS
```bash
brew install --cask docker
# Or download from: https://www.docker.com/products/docker-desktop
```

#### Ubuntu/Debian
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### Windows
Download Docker Desktop from: https://www.docker.com/products/docker-desktop

### Verify Installation
```bash
docker --version
docker-compose --version
# or
docker compose version
```

---

## One-Command Deployment

### What the Script Does

The `start-gateway.sh` script automates **everything**:

1. ✅ Checks Docker installation
2. ✅ Creates `.env` file with secure defaults
3. ✅ Prompts for JWT secret (or generates one)
4. ✅ Auto-generates Admin API token
5. ✅ Auto-generates Redis password
6. ✅ Creates monitoring configuration (Prometheus/Grafana)
7. ✅ Builds all Docker images
8. ✅ Starts all services with health checks
9. ✅ Displays access URLs and test commands

### Usage

```bash
./start-gateway.sh [OPTIONS]

Options:
  -d, --detach      Run in detached mode (background)
  --monitoring      Start with Prometheus and Grafana
  --rebuild         Force rebuild of Docker images

Examples:
  ./start-gateway.sh -d              # Start in background
  ./start-gateway.sh --monitoring    # Start with monitoring
  ./start-gateway.sh -d --rebuild    # Rebuild and start
```

### First Time Setup

When you run the script for the first time:

```bash
./start-gateway.sh -d
```

**You'll see:**

```
╔════════════════════════════════════════════════════════════╗
║  High-Performance API Security Gateway - Docker Setup     ║
╔════════════════════════════════════════════════════════════╗

ℹ️  Creating .env file from template...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   JWT Secret Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated JWT Secret: abc123...xyz789

Press ENTER to use the generated JWT secret, or paste your own:
```

**Options:**
- Press **ENTER** to use the auto-generated secure JWT secret
- Or **paste your own** JWT secret if you have one

**The script then:**
- Creates `.env` with your JWT secret
- Auto-generates Admin API token
- Auto-generates Redis password
- Saves all tokens to `.tokens` file
- Adds `.tokens` to `.gitignore`
- Displays all tokens for you to save securely

---

## What Gets Deployed

### Services

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| **API Gateway** | `api-gateway` | 8080 | Main gateway service |
| **Metrics** | `api-gateway` | 9090 | Prometheus metrics endpoint |
| **Redis** | `api-gateway-redis` | 6379 | Distributed cache & rate limiting |
| **Auth Service** | `api-gateway-auth` | 3001 | Mock authentication service (testing) |
| **User Service** | `api-gateway-users` | 3002 | Mock user service (testing) |
| **Prometheus** | `api-gateway-prometheus` | 9091 | Metrics collection (optional) |
| **Grafana** | `api-gateway-grafana` | 3000 | Metrics visualization (optional) |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                   (gateway-network)                      │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │              │    │              │                  │
│  │  API Gateway │───▶│    Redis     │                  │
│  │    :8080     │    │    :6379     │                  │
│  │    :9090     │    │              │                  │
│  │              │    │  (Cache +    │                  │
│  └──────┬───────┘    │ Rate Limit)  │                  │
│         │            └──────────────┘                  │
│         │                                               │
│         │  ┌──────────────┐  ┌──────────────┐         │
│         ├─▶│ Auth Service │  │ User Service │         │
│         │  │    :3001     │  │    :3002     │         │
│         │  └──────────────┘  └──────────────┘         │
│         │                                               │
│         │  ┌──────────────┐  ┌──────────────┐         │
│         └─▶│  Prometheus  │─▶│   Grafana    │         │
│            │    :9091     │  │    :3000     │         │
│            └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### Volumes

| Volume | Purpose |
|--------|---------|
| `redis-data` | Persistent Redis data |
| `prometheus-data` | Metrics history |
| `grafana-data` | Grafana dashboards and settings |
| `./logs` | Gateway logs (host-mounted) |
| `./config` | Configuration files (host-mounted, read-only) |

---

## Configuration

### Environment Variables

All configuration is in `.env` file (auto-generated by script).

**You only need to provide:**
- `JWT_SECRET` - The script will prompt you or generate one

**Everything else is auto-configured:**
- `ADMIN_TOKEN` - Auto-generated secure token
- `REDIS_PASSWORD` - Auto-generated password
- All feature flags enabled by default

### Manual Configuration

If you want to customize settings, edit `.env`:

```bash
# Edit .env file
nano .env

# Restart services to apply changes
./stop-gateway.sh
./start-gateway.sh -d
```

### Gateway Configuration Files

Configuration files in `config/` directory:

- **`config/gateway.json`** - Main gateway settings
- **`config/routes.json`** - Route definitions

These are mounted read-only into the container. To modify:

```bash
# Edit configuration
nano config/gateway.json

# Restart gateway to apply
docker-compose restart api-gateway
```

---

## Accessing Services

Once deployed, access these URLs:

### API Gateway

```bash
# Health check
curl http://localhost:8080/health

# Should return: {"status":"healthy","uptime":123}
```

### Authentication

```bash
# Login (get JWT token)
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_admin","password":"change-me-admin"}' \
  | jq -r '.token')

echo "JWT Token: $TOKEN"

# Access protected endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users
```

### Metrics

```bash
# View Prometheus metrics
curl http://localhost:9090/metrics

# View specific metrics
curl http://localhost:9090/metrics | grep gateway_requests_total
```

### Admin API

```bash
# Get admin token from .env
source .env

# View current configuration
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/config | jq .

# View cache statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/stats | jq .

# Clear cache
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/cache/clear
```

### Container Logs

```bash
# View all logs
docker-compose logs

# Follow gateway logs
docker-compose logs -f api-gateway

# Follow specific service
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100 api-gateway
```

### Container Status

```bash
# View running containers
docker-compose ps

# View container stats (CPU, memory)
docker stats

# Execute commands in container
docker-compose exec api-gateway /bin/bash
```

---

## Monitoring Setup

### Enable Monitoring

Start with Prometheus and Grafana:

```bash
./start-gateway.sh -d --monitoring
```

This deploys:
- **Prometheus** on port 9091
- **Grafana** on port 3000

### Access Monitoring

**Prometheus:**
- URL: http://localhost:9091
- Query metrics, view targets, configure alerts

**Grafana:**
- URL: http://localhost:3000
- Username: `admin`
- Password: `admin` (change after first login)

### Grafana Setup

1. **Login** to Grafana (admin/admin)
2. **Change password** when prompted
3. **Verify Prometheus datasource:**
   - Go to Configuration → Data Sources
   - Prometheus should be pre-configured
4. **Create dashboards** or import pre-built ones

### Sample Queries

In Prometheus, try these queries:

```promql
# Request rate
rate(gateway_requests_total[5m])

# Average latency
avg(gateway_request_duration_ms{quantile="avg"})

# Error rate
rate(gateway_http_requests_total{status=~"5.."}[5m])

# Rate limit hits
rate(gateway_rate_limit_hits_total[5m])

# Cache hit rate
gateway_cache_hits / (gateway_cache_hits + gateway_cache_misses)
```

---

## Troubleshooting

### Port Already in Use

**Error:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:8080: bind: address already in use
```

**Solution:**
```bash
# Find what's using the port
lsof -i :8080

# Kill the process or change port in .env
echo "GATEWAY_PORT=8081" >> .env

# Restart
./start-gateway.sh -d
```

### Container Fails to Start

**Check logs:**
```bash
docker-compose logs api-gateway
```

**Common issues:**

1. **Missing JWT_SECRET**
   ```bash
   # Set in .env
   echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
   ./start-gateway.sh -d
   ```

2. **Configuration errors**
   ```bash
   # Validate JSON
   jq . config/gateway.json
   jq . config/routes.json
   ```

3. **Health check failing**
   ```bash
   # Check if service is listening
   docker-compose exec api-gateway netstat -tlnp

   # Test health endpoint
   docker-compose exec api-gateway wget -O- http://localhost:8080/health
   ```

### Redis Connection Issues

**Check Redis is running:**
```bash
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping
# Should return: PONG
```

**View Redis data:**
```bash
docker-compose exec redis redis-cli -a $REDIS_PASSWORD

# Inside redis-cli:
> KEYS *
> GET some-key
```

### Clean Slate Reset

**Remove everything and start fresh:**

```bash
# Stop and remove all containers, networks, volumes
./stop-gateway.sh --volumes

# Remove .env and .tokens
rm .env .tokens

# Start fresh
./start-gateway.sh -d
```

---

## Production Deployment

### Security Checklist

Before deploying to production:

- [ ] **Change default passwords**
  ```bash
  # Edit .env
  DEMO_ADMIN_PASSWORD=<strong-password>
  GRAFANA_PASSWORD=<strong-password>
  ```

- [ ] **Use production-grade JWT secret**
  ```bash
  JWT_SECRET=$(openssl rand -base64 48)
  ```

- [ ] **Rotate admin token**
  ```bash
  ADMIN_TOKEN=$(openssl rand -hex 64)
  ```

- [ ] **Set NODE_ENV to production**
  ```bash
  NODE_ENV=production
  ```

- [ ] **Enable TLS/HTTPS**
  - Place certificates in `certs/` directory
  - Update `config/gateway.json` to enable TLS

- [ ] **Restrict admin API access**
  ```json
  {
    "admin": {
      "enabled": true,
      "allowed_ips": ["10.0.0.0/8"]
    }
  }
  ```

- [ ] **Set up external Redis** (for production scale)
  ```bash
  REDIS_HOST=production-redis.example.com
  REDIS_PASSWORD=<strong-password>
  ```

- [ ] **Configure log aggregation**
  - Ship logs to ELK, Splunk, or similar

- [ ] **Set resource limits** in `docker-compose.yml`
  ```yaml
  api-gateway:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
  ```

### Production Compose Override

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  api-gateway:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Deploy:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Scaling

**Scale gateway instances:**
```bash
docker-compose up -d --scale api-gateway=3
```

**Load balancer** (nginx example):
```nginx
upstream api_gateway {
    least_conn;
    server api-gateway-1:8080;
    server api-gateway-2:8080;
    server api-gateway-3:8080;
}

server {
    listen 80;
    location / {
        proxy_pass http://api_gateway;
    }
}
```

### Backups

**Backup Redis data:**
```bash
docker-compose exec redis redis-cli -a $REDIS_PASSWORD SAVE
docker cp api-gateway-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

**Backup configuration:**
```bash
tar -czf gateway-config-$(date +%Y%m%d).tar.gz config/ .env
```

---

## Quick Reference

### Essential Commands

```bash
# Start everything
./start-gateway.sh -d

# Start with monitoring
./start-gateway.sh -d --monitoring

# Stop everything
./stop-gateway.sh

# Stop and remove all data
./stop-gateway.sh --volumes

# View logs
docker-compose logs -f api-gateway

# Restart single service
docker-compose restart api-gateway

# Rebuild images
./start-gateway.sh -d --rebuild

# View container stats
docker stats

# Execute command in container
docker-compose exec api-gateway /bin/bash
```

### URLs

- Gateway: http://localhost:8080
- Metrics: http://localhost:9090/metrics
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3000

### Test Commands

```bash
# Health check
curl http://localhost:8080/health

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_admin","password":"change-me-admin"}'

# View metrics
curl http://localhost:9090/metrics

# Admin API (needs token from .env)
source .env
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/admin/config | jq .
```

---

## Next Steps

1. **Test the deployment:**
   - Run through test scenarios in [QUICKSTART-FEATURES.md](QUICKSTART-FEATURES.md)

2. **Configure for your use case:**
   - Update `config/routes.json` with your backend services
   - Adjust rate limits, caching policies

3. **Set up monitoring:**
   - Create Grafana dashboards
   - Configure Prometheus alerts

4. **Prepare for production:**
   - Follow security checklist above
   - Set up CI/CD pipeline
   - Configure backups

5. **Read more:**
   - [FEATURES.md](FEATURES.md) - Advanced feature documentation
   - [PRODUCTION.md](PRODUCTION.md) - Production deployment guide
   - [PERFORMANCE.md](PERFORMANCE.md) - Performance tuning

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- View logs: `docker-compose logs -f`
- GitHub Issues: [Report an issue](https://github.com/yourusername/api-gateway/issues)

**Happy deploying! 🚀**
