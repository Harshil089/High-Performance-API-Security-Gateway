# Deployment Guide

This guide covers deploying the API Gateway in development, staging, and production environments.

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+, RHEL 8+) or macOS 10.15+
- **CPU**: 2+ cores (4+ recommended for production)
- **RAM**: 2GB minimum (4GB+ recommended)
- **Disk**: 500MB for application + logs

### Software Dependencies

- **C++ Compiler**: GCC 9+ or Clang 10+
- **CMake**: 3.15+
- **OpenSSL**: 1.1.1+
- **Node.js**: 14+ (for mock services)
- **Git**: For source control

### Installing Dependencies

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    cmake \
    libssl-dev \
    git \
    uuid-dev
```

#### macOS

```bash
brew install cmake openssl ossp-uuid
```

#### RHEL/CentOS

```bash
sudo yum install -y \
    gcc-c++ \
    cmake3 \
    openssl-devel \
    git \
    libuuid-devel
```

---

## Development Deployment

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/api-gateway.git
cd api-gateway
```

### 2. Build Project

```bash
./build.sh
```

This creates a `build/` directory with compiled binaries:
- `api-gateway` - Main gateway executable
- `gateway-tests` - Unit test suite

### 3. Configure Environment

```bash
export JWT_SECRET="dev-secret-key-min-32-chars-for-testing-only"
```

**Important**: Never use this secret in production!

### 4. Install Mock Services

```bash
cd mock-services
npm install
cd ..
```

### 5. Start Gateway and Services

```bash
./run.sh
```

This script:
- Starts 3 mock backend services
- Starts the API gateway
- Displays startup logs

### 6. Verify Deployment

```bash
# Health check
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","service":"api-gateway"}
```

### 7. Run Tests

```bash
./test.sh
```

---

## Staging Deployment

### 1. Build for Release

```bash
./build.sh Release
```

### 2. Configure for Staging

Create production config files:

```bash
cp config/gateway.json config/gateway.staging.json
cp config/routes.json config/routes.staging.json
```

Edit `config/gateway.staging.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "tls": {
      "enabled": true,
      "cert_file": "/etc/api-gateway/certs/cert.pem",
      "key_file": "/etc/api-gateway/certs/key.pem"
    }
  },
  "jwt": {
    "secret": "${JWT_SECRET}",
    "issuer": "api-gateway-staging",
    "audience": "api-clients"
  },
  "logging": {
    "level": "info",
    "file": "/var/log/api-gateway/gateway.log"
  }
}
```

### 3. Generate TLS Certificates

For staging, you can use self-signed certificates:

```bash
mkdir -p /etc/api-gateway/certs
openssl req -x509 -newkey rsa:4096 \
  -keyout /etc/api-gateway/certs/key.pem \
  -out /etc/api-gateway/certs/cert.pem \
  -days 365 -nodes \
  -subj "/CN=staging.yourdomain.com"
```

### 4. Set Environment Variables

```bash
export JWT_SECRET="$(openssl rand -base64 32)"
echo "JWT_SECRET=$JWT_SECRET" >> /etc/api-gateway/environment
```

**Important**: Store this securely! You'll need it for all gateway instances.

### 5. Create Systemd Service

Create `/etc/systemd/system/api-gateway.service`:

```ini
[Unit]
Description=API Gateway
After=network.target

[Service]
Type=simple
User=gateway
Group=gateway
WorkingDirectory=/opt/api-gateway
EnvironmentFile=/etc/api-gateway/environment
ExecStart=/opt/api-gateway/build/api-gateway \
  --config /etc/api-gateway/gateway.staging.json \
  --routes /etc/api-gateway/routes.staging.json
Restart=always
RestartSec=10

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 6. Create User and Directories

```bash
sudo useradd -r -s /bin/false gateway
sudo mkdir -p /opt/api-gateway
sudo mkdir -p /var/log/api-gateway
sudo mkdir -p /etc/api-gateway
sudo chown -R gateway:gateway /opt/api-gateway
sudo chown -R gateway:gateway /var/log/api-gateway
```

### 7. Deploy Application

```bash
sudo cp -r . /opt/api-gateway/
sudo cp config/*.json /etc/api-gateway/
```

### 8. Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable api-gateway
sudo systemctl start api-gateway
sudo systemctl status api-gateway
```

### 9. Configure Log Rotation

Create `/etc/logrotate.d/api-gateway`:

```
/var/log/api-gateway/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 gateway gateway
    sharedscripts
    postrotate
        systemctl reload api-gateway > /dev/null 2>&1 || true
    endscript
}
```

---

## Production Deployment

### Architecture

```
Internet
   ↓
Load Balancer (nginx/HAProxy)
   ↓
┌────────────┬────────────┬────────────┐
│ Gateway 1  │ Gateway 2  │ Gateway 3  │  (Auto-scaled)
└────────────┴────────────┴────────────┘
   ↓
Backend Services (Kubernetes/Docker)
```

### 1. Load Balancer Setup (nginx)

Install nginx:

```bash
sudo apt-get install nginx
```

Configure `/etc/nginx/sites-available/api-gateway`:

```nginx
upstream api_gateway {
    least_conn;
    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Rate limiting (additional layer)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Health checks
        proxy_next_upstream error timeout http_502 http_503;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://api_gateway;
    }
}
```

Enable and start:

```bash
sudo ln -s /etc/nginx/sites-available/api-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. SSL Certificates (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 3. Firewall Configuration

```bash
# Allow only from load balancer
sudo ufw allow from 10.0.1.0/24 to any port 8080
sudo ufw enable
```

### 4. Monitoring Setup

#### Prometheus Integration (Future)

Add to gateway config:

```json
{
  "monitoring": {
    "enabled": true,
    "prometheus_port": 9090,
    "metrics": [
      "request_count",
      "request_duration",
      "error_rate",
      "rate_limit_hits"
    ]
  }
}
```

#### Log Aggregation

Use ELK stack or similar:

```bash
# Filebeat configuration
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/api-gateway/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

### 5. High Availability

#### Database for Rate Limiting (Redis)

For distributed rate limiting across multiple gateway instances:

```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis for rate limiting
sudo vim /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

sudo systemctl restart redis
```

Update gateway config:

```json
{
  "rate_limits": {
    "storage": "redis",
    "redis_host": "localhost:6379"
  }
}
```

#### Health Checks

Configure health check endpoint in load balancer:

```nginx
upstream api_gateway {
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;

    # Health check (nginx Plus)
    check interval=3000 rise=2 fall=3 timeout=1000;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}
```

### 6. Auto-Scaling

#### AWS Auto Scaling

Create Launch Template:

```json
{
  "LaunchTemplateName": "api-gateway-template",
  "VersionDescription": "v1",
  "LaunchTemplateData": {
    "ImageId": "ami-xxxxx",
    "InstanceType": "t3.medium",
    "SecurityGroupIds": ["sg-xxxxx"],
    "UserData": "base64-encoded-startup-script"
  }
}
```

Auto Scaling Group:

```json
{
  "AutoScalingGroupName": "api-gateway-asg",
  "MinSize": 2,
  "MaxSize": 10,
  "DesiredCapacity": 3,
  "HealthCheckType": "ELB",
  "HealthCheckGracePeriod": 300,
  "TargetGroupARNs": ["arn:aws:..."]
}
```

Scaling Policies:

```json
{
  "PolicyName": "scale-up-cpu",
  "PolicyType": "TargetTrackingScaling",
  "TargetTrackingConfiguration": {
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 70.0
  }
}
```

### 7. Backup and Disaster Recovery

#### Configuration Backup

```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/api-gateway"

mkdir -p $BACKUP_DIR

# Backup configs
tar -czf $BACKUP_DIR/config-$DATE.tar.gz /etc/api-gateway/

# Backup logs (last 7 days)
find /var/log/api-gateway/ -name "*.log" -mtime -7 | \
  tar -czf $BACKUP_DIR/logs-$DATE.tar.gz -T -

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### 8. Security Hardening

#### AppArmor Profile

Create `/etc/apparmor.d/opt.api-gateway.api-gateway`:

```
#include <tunables/global>

/opt/api-gateway/build/api-gateway {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/openssl>

  /opt/api-gateway/** r,
  /etc/api-gateway/** r,
  /var/log/api-gateway/** rw,

  deny /proc/** w,
  deny /sys/** w,
}
```

Enable:

```bash
sudo apparmor_parser -r /etc/apparmor.d/opt.api-gateway.api-gateway
```

#### Network Policies

```bash
# iptables rules
sudo iptables -A INPUT -p tcp --dport 8080 -s 10.0.1.0/24 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8080 -j DROP
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libssl-dev \
    git \
    uuid-dev

WORKDIR /app
COPY . .

RUN ./build.sh Release

FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libssl3 \
    uuid-runtime \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false gateway

WORKDIR /app
COPY --from=builder /app/build/api-gateway .
COPY config/ ./config/

RUN mkdir -p /var/log/api-gateway && \
    chown -R gateway:gateway /app /var/log/api-gateway

USER gateway

EXPOSE 8080

ENTRYPOINT ["./api-gateway"]
CMD ["--config", "config/gateway.json", "--routes", "config/routes.json"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  api-gateway:
    build: .
    ports:
      - "8080:8080"
    environment:
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./logs:/var/log/api-gateway
      - ./config:/app/config:ro
    restart: unless-stopped
    networks:
      - backend

  redis:
    image: redis:7-alpine
    networks:
      - backend

networks:
  backend:
    driver: bridge
```

Build and run:

```bash
docker-compose up -d
```

---

## Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  labels:
    app: api-gateway
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
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-gateway-secrets
              key: jwt-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
spec:
  selector:
    app: api-gateway
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

Deploy:

```bash
kubectl apply -f k8s/deployment.yaml
```

---

## Performance Tuning

### System Tuning

```bash
# Increase file descriptor limit
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# TCP tuning
sysctl -w net.core.somaxconn=8192
sysctl -w net.ipv4.tcp_max_syn_backlog=8192
sysctl -w net.ipv4.tcp_tw_reuse=1
```

### Application Tuning

Adjust in `gateway.json`:

```json
{
  "server": {
    "max_connections": 2000,
    "worker_threads": 8,
    "connection_timeout": 30,
    "keepalive_timeout": 60
  }
}
```

---

## Troubleshooting

### Check Logs

```bash
# Real-time logs
tail -f /var/log/api-gateway/gateway.log | jq

# Error logs
grep "ERROR" /var/log/api-gateway/gateway.log

# Systemd logs
journalctl -u api-gateway -f
```

### Common Issues

1. **Port already in use**
   ```bash
   sudo lsof -i :8080
   sudo systemctl stop api-gateway
   ```

2. **Certificate errors**
   ```bash
   openssl verify /etc/api-gateway/certs/cert.pem
   ```

3. **High memory usage**
   ```bash
   # Check for memory leaks
   valgrind --leak-check=full ./api-gateway
   ```

---

## Rollback Procedures

### Quick Rollback

```bash
# Stop current version
sudo systemctl stop api-gateway

# Restore previous version
sudo cp /backups/api-gateway-v1.0/api-gateway /opt/api-gateway/build/

# Start service
sudo systemctl start api-gateway
```

### Blue-Green Deployment

1. Deploy new version to "green" environment
2. Test green environment
3. Switch load balancer to green
4. Keep blue running for quick rollback
5. After verification, decommission blue

---

## Maintenance

### Zero-Downtime Restart

```bash
# Graceful reload (when supported)
sudo systemctl reload api-gateway

# Or rolling restart with load balancer
# 1. Remove instance from LB
# 2. Restart instance
# 3. Add back to LB
# 4. Repeat for each instance
```

### Updating Configuration

```bash
# Test new config
./api-gateway --config config/gateway.new.json --test

# If valid, replace and reload
sudo cp config/gateway.new.json /etc/api-gateway/gateway.json
sudo systemctl reload api-gateway
```

---

## Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Configuration reviewed
- [ ] TLS certificates valid
- [ ] Environment variables set
- [ ] Monitoring configured
- [ ] Backup procedures in place
- [ ] Rollback plan documented
- [ ] Load testing completed
- [ ] Security audit passed

### Post-Deployment

- [ ] Health checks passing
- [ ] Logs being collected
- [ ] Metrics being reported
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Team notified
- [ ] Performance monitored for 24h

---

For production support, contact your DevOps team or create an issue in the repository.
