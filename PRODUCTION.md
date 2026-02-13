# Production Deployment Guide

This guide covers production deployment best practices for the High-Performance API Gateway.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Security Checklist](#security-checklist)
- [Environment Configuration](#environment-configuration)
- [TLS/SSL Setup](#tlsssl-setup)
- [Deployment Options](#deployment-options)
- [Monitoring & Operations](#monitoring--operations)
- [Scaling](#scaling)

## Prerequisites

### System Requirements
- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB+ recommended
- **Storage**: 50GB minimum for logs and temporary files
- **OS**: Ubuntu 22.04 LTS (recommended) or similar Linux distribution
- **CMake**: 3.25 or higher
- **OpenSSL**: 3.x
- **Network**: Static IP or load balancer

### Required Tools
```bash
# Build tools
sudo apt-get update
sudo apt-get install -y build-essential cmake git libssl-dev uuid-dev pkg-config

# Monitoring tools
sudo apt-get install -y curl jq htop

# Optional: Docker for containerized deployment
sudo apt-get install -y docker.io docker-compose
```

## Security Checklist

Before deploying to production, complete this security checklist:

### Critical (P0)
- [ ] **Generate a strong JWT secret** (minimum 32 characters, random)
  ```bash
  openssl rand -base64 32
  ```
- [ ] **Enable TLS/HTTPS** with valid certificates
- [ ] **Remove all test/demo credentials** from configuration
- [ ] **Set secure CORS origins** (no wildcards)
- [ ] **Configure firewall rules** (only expose necessary ports)
- [ ] **Set proper file permissions** (config files 0600, binaries 0755)
- [ ] **Run as non-root user** (create dedicated service account)
- [ ] **Enable security headers** (HSTS, X-Frame-Options, CSP)

### Important (P1)
- [ ] Set up log rotation and monitoring
- [ ] Configure rate limiting appropriately for your traffic
- [ ] Set up automated backups for configuration
- [ ] Implement health check monitoring
- [ ] Configure fail2ban or similar for brute force protection
- [ ] Set up alerting for errors and security events
- [ ] Document incident response procedures

### Recommended (P2)
- [ ] Enable audit logging
- [ ] Set up distributed tracing
- [ ] Configure metrics collection (Prometheus)
- [ ] Implement automated security scanning
- [ ] Set up disaster recovery procedures
- [ ] Create runbooks for common operations

## Environment Configuration

### 1. Copy and Configure Environment File

```bash
# Copy example environment file
cp .env.example .env

# Edit with secure values
nano .env
```

### 2. Required Environment Variables

```bash
# JWT Secret - MUST be changed for production
# Generate with: openssl rand -base64 32
JWT_SECRET=your-cryptographically-secure-random-secret-here

# JWT Configuration
JWT_ISSUER=your-company-api-gateway
JWT_AUDIENCE=your-company-api-clients

# CORS Origins - Specific domains only
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com

# Environment
NODE_ENV=production
```

### 3. Production Configuration

Use the production configuration template:

```bash
# Copy production config
cp config/gateway.production.json config/gateway.json

# Edit for your environment
nano config/gateway.json
```

Key settings to review:
- **Port**: Change from 8080 if needed
- **TLS**: Enable and configure certificate paths
- **Rate Limits**: Adjust for your traffic patterns
- **Logging**: Set appropriate log levels and retention
- **Backend Health Checks**: Configure for your backends

## TLS/SSL Setup

### Option 1: Let's Encrypt (Recommended for Public APIs)

```bash
# Install certbot
sudo apt-get install -y certbot

# Generate certificate
sudo certbot certonly --standalone \
  -d api.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos

# Copy certificates to gateway directory
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem config/cert.pem
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem config/key.pem

# Set permissions
sudo chown gateway:gateway config/*.pem
sudo chmod 600 config/*.pem
```

### Option 2: Self-Signed (Development/Internal Use)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout config/key.pem \
  -out config/cert.pem \
  -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Company/CN=api.yourdomain.com"

# Set permissions
chmod 600 config/*.pem
```

### Enable TLS in Configuration

Edit `config/gateway.json`:
```json
{
  "server": {
    "tls": {
      "enabled": true,
      "cert_file": "config/cert.pem",
      "key_file": "config/key.pem"
    }
  }
}
```

## Deployment Options

### Option 1: Docker Deployment (Recommended)

```bash
# 1. Build the image
docker-compose build

# 2. Set environment variables
export JWT_SECRET=$(openssl rand -base64 32)
export CORS_ALLOWED_ORIGINS=https://yourdomain.com

# 3. Start services
docker-compose up -d

# 4. Check logs
docker-compose logs -f api-gateway

# 5. Verify health
curl -k https://localhost:8080/health
```

### Option 2: Systemd Service

```bash
# 1. Build the gateway
./build.sh

# 2. Create service user
sudo useradd -r -s /bin/false gateway

# 3. Install binary
sudo cp build/api-gateway /usr/local/bin/
sudo chown root:root /usr/local/bin/api-gateway
sudo chmod 755 /usr/local/bin/api-gateway

# 4. Create directories
sudo mkdir -p /etc/api-gateway /var/log/api-gateway
sudo chown gateway:gateway /var/log/api-gateway

# 5. Copy configuration
sudo cp config/*.json /etc/api-gateway/
sudo chown gateway:gateway /etc/api-gateway/*.json
sudo chmod 600 /etc/api-gateway/*.json

# 6. Create systemd service
sudo nano /etc/systemd/system/api-gateway.service
```

**Service file content:**
```ini
[Unit]
Description=High-Performance API Gateway
After=network.target

[Service]
Type=simple
User=gateway
Group=gateway
WorkingDirectory=/usr/local/bin
Environment="JWT_SECRET=your-secret-here"
Environment="JWT_ISSUER=api-gateway"
Environment="JWT_AUDIENCE=api-clients"
ExecStart=/usr/local/bin/api-gateway \
    --config /etc/api-gateway/gateway.json \
    --routes /etc/api-gateway/routes.json
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=api-gateway

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/api-gateway

[Install]
WantedBy=multi-user.target
```

```bash
# 7. Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable api-gateway
sudo systemctl start api-gateway

# 8. Check status
sudo systemctl status api-gateway
sudo journalctl -u api-gateway -f
```

### Option 3: Kubernetes Deployment

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: your-registry/api-gateway:latest
        ports:
        - containerPort: 8080
          name: https
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-gateway-secrets
              key: jwt-secret
        - name: JWT_ISSUER
          value: "api-gateway"
        - name: JWT_AUDIENCE
          value: "api-clients"
        volumeMounts:
        - name: config
          mountPath: /etc/api-gateway
          readOnly: true
        - name: certs
          mountPath: /etc/api-gateway/certs
          readOnly: true
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
            scheme: HTTPS
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
            scheme: HTTPS
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: api-gateway-config
      - name: certs
        secret:
          secretName: api-gateway-tls
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: production
spec:
  selector:
    app: api-gateway
  ports:
  - port: 443
    targetPort: 8080
    name: https
  type: LoadBalancer
```

## Monitoring & Operations

### Health Checks

```bash
# Basic health check
curl -k https://localhost:8080/health | jq .

# Expected output:
{
  "status": "healthy",
  "service": "api-gateway",
  "version": "1.0.0",
  "timestamp": 1234567890,
  "components": {
    "jwt_manager": "healthy",
    "rate_limiter": "healthy",
    "router": "healthy",
    "logger": "healthy"
  }
}
```

### Log Management

```bash
# View real-time logs
tail -f /var/log/api-gateway/gateway.log | jq .

# Search for errors
grep "error" /var/log/api-gateway/gateway.log | jq .

# Monitor specific endpoint
grep "/api/payment" /var/log/api-gateway/gateway.log | jq .
```

### Log Rotation

Create `/etc/logrotate.d/api-gateway`:
```
/var/log/api-gateway/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 gateway gateway
    sharedscripts
    postrotate
        systemctl reload api-gateway > /dev/null 2>&1 || true
    endscript
}
```

### Metrics to Monitor

- **Request Rate**: Requests per second
- **Response Time**: P50, P95, P99 latencies
- **Error Rate**: 4xx and 5xx responses
- **JWT Validation Failures**: Authentication errors
- **Rate Limit Hits**: Requests blocked by rate limiting
- **Backend Health**: Circuit breaker states
- **Resource Usage**: CPU, memory, connections

## Scaling

### Horizontal Scaling

The gateway is stateless and can be scaled horizontally:

```bash
# Docker Compose
docker-compose up --scale api-gateway=3

# Kubernetes
kubectl scale deployment api-gateway --replicas=5
```

### Load Balancing

Use Nginx or HAProxy as a load balancer:

```nginx
# /etc/nginx/sites-available/api-gateway
upstream api_gateway {
    least_conn;
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass https://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Rate Limiter Considerations

The current in-memory rate limiter doesn't share state across instances. For multi-instance deployments:

1. Use sticky sessions in load balancer
2. Implement Redis-backed rate limiting (future enhancement)
3. Use external rate limiting (e.g., Nginx rate limiting)

## Troubleshooting

### Gateway Won't Start

```bash
# Check configuration syntax
./api-gateway --config config/gateway.json --help

# Check JWT secret length
echo -n "$JWT_SECRET" | wc -c  # Should be >= 32

# Verify file permissions
ls -la config/

# Check port availability
sudo netstat -tlnp | grep 8080
```

### High Memory Usage

```bash
# Check current usage
ps aux | grep api-gateway

# Adjust max_connections in config
# Reduce connection_timeout
# Enable memory profiling
```

### SSL/TLS Issues

```bash
# Verify certificate
openssl x509 -in config/cert.pem -text -noout

# Check certificate and key match
openssl x509 -noout -modulus -in config/cert.pem | openssl md5
openssl rsa -noout -modulus -in config/key.pem | openssl md5

# Test TLS connection
openssl s_client -connect localhost:8080 -showcerts
```

## Security Incident Response

### Suspected Compromise

1. **Immediately**: Rotate JWT secret
2. Revoke all existing tokens
3. Review audit logs for suspicious activity
4. Check for unauthorized configuration changes
5. Scan for malware/backdoors
6. Update all dependencies
7. Re-deploy from known good state

### DDoS Attack

1. Enable stricter rate limiting
2. Block offending IP ranges at firewall
3. Enable DDoS protection at network layer
4. Scale horizontally to handle load
5. Contact upstream network provider

## Backup and Recovery

### Configuration Backup

```bash
# Automated daily backup
#!/bin/bash
BACKUP_DIR=/backup/api-gateway
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR
tar czf $BACKUP_DIR/config-$DATE.tar.gz \
    /etc/api-gateway/*.json \
    /etc/api-gateway/certs/*.pem

# Keep last 30 days
find $BACKUP_DIR -name "config-*.tar.gz" -mtime +30 -delete
```

### Recovery

```bash
# Restore from backup
tar xzf /backup/api-gateway/config-20240101.tar.gz -C /

# Restart service
systemctl restart api-gateway
```

## Maintenance

### Updating the Gateway

```bash
# 1. Build new version
git pull
./build.sh

# 2. Test in staging environment first

# 3. Backup current version
sudo cp /usr/local/bin/api-gateway /usr/local/bin/api-gateway.backup

# 4. Deploy new version
sudo cp build/api-gateway /usr/local/bin/

# 5. Restart service
sudo systemctl restart api-gateway

# 6. Monitor logs
sudo journalctl -u api-gateway -f

# 7. Rollback if needed
sudo cp /usr/local/bin/api-gateway.backup /usr/local/bin/api-gateway
sudo systemctl restart api-gateway
```

## Support

For production support:
- Review logs: `/var/log/api-gateway/gateway.log`
- Check GitHub issues: https://github.com/your-org/api-gateway/issues
- Consult troubleshooting guide: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
