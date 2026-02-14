#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  High-Performance API Security Gateway - Docker Setup     ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

print_success "Docker and Docker Compose are installed"

# Check if .env file exists
if [ ! -f .env ]; then
    print_info "Creating .env file from template..."

    # Generate secure tokens
    JWT_SECRET=$(openssl rand -base64 32)
    ADMIN_TOKEN=$(openssl rand -hex 32)
    REDIS_PASSWORD=$(openssl rand -hex 16)

    # Prompt user for JWT_SECRET or use generated one
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}   JWT Secret Configuration${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}Generated JWT Secret: ${JWT_SECRET}${NC}"
    echo ""
    read -p "Press ENTER to use the generated JWT secret, or paste your own: " USER_JWT_SECRET

    if [ ! -z "$USER_JWT_SECRET" ]; then
        JWT_SECRET="$USER_JWT_SECRET"
        print_info "Using your provided JWT secret"
    else
        print_info "Using generated JWT secret"
    fi

    # Create .env file
    cat > .env << EOF
# Gateway Configuration
NODE_ENV=development
LOG_LEVEL=info

# JWT Configuration (REQUIRED - PROVIDED BY USER)
JWT_SECRET=${JWT_SECRET}
JWT_ISSUER=api-gateway
JWT_AUDIENCE=api-clients
JWT_EXPIRY=24h

# Demo Credentials (DEVELOPMENT ONLY)
DEMO_ADMIN_PASSWORD=change-me-admin
DEMO_USER_PASSWORD=change-me-user

# Redis Configuration (AUTO-GENERATED)
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# Admin API Configuration (AUTO-GENERATED)
ADMIN_TOKEN=${ADMIN_TOKEN}
ADMIN_ENABLED=true

# Metrics Configuration
METRICS_ENABLED=true
METRICS_PORT=9090

# Cache Configuration
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300
CACHE_MAX_ENTRY_SIZE=1048576

# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_MAX_CONNECTIONS=100

# Gateway Configuration
GATEWAY_PORT=8080
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Monitoring (Optional)
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
EOF

    print_success ".env file created successfully"

    # Display tokens
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}   🔐 IMPORTANT: Save These Tokens Securely!${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}JWT Secret:${NC}"
    echo -e "  ${JWT_SECRET}"
    echo ""
    echo -e "${GREEN}Admin API Token:${NC}"
    echo -e "  ${ADMIN_TOKEN}"
    echo ""
    echo -e "${GREEN}Redis Password:${NC}"
    echo -e "  ${REDIS_PASSWORD}"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Save tokens to a file
    cat > .tokens << EOF
# Generated Tokens - $(date)
# KEEP THIS FILE SECURE AND DO NOT COMMIT TO VERSION CONTROL

JWT_SECRET=${JWT_SECRET}
ADMIN_TOKEN=${ADMIN_TOKEN}
REDIS_PASSWORD=${REDIS_PASSWORD}
EOF

    print_success "Tokens saved to .tokens file (add to .gitignore)"

    # Add to .gitignore if not already there
    if [ -f .gitignore ]; then
        if ! grep -q "^\.tokens$" .gitignore; then
            echo ".tokens" >> .gitignore
            print_info "Added .tokens to .gitignore"
        fi
    fi
else
    print_info ".env file already exists, using existing configuration"

    # Check if JWT_SECRET is set
    if ! grep -q "^JWT_SECRET=" .env || [ -z "$(grep "^JWT_SECRET=" .env | cut -d '=' -f2)" ]; then
        print_error "JWT_SECRET is not set in .env file"
        echo ""
        read -p "Enter your JWT secret: " USER_JWT_SECRET

        if [ -z "$USER_JWT_SECRET" ]; then
            print_error "JWT_SECRET cannot be empty"
            exit 1
        fi

        # Update or add JWT_SECRET
        if grep -q "^JWT_SECRET=" .env; then
            sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${USER_JWT_SECRET}|" .env
        else
            echo "JWT_SECRET=${USER_JWT_SECRET}" >> .env
        fi

        print_success "JWT_SECRET updated in .env file"
    fi
fi

echo ""
print_info "Configuration loaded successfully"

# Create monitoring directory structure if it doesn't exist
if [ ! -d monitoring ]; then
    print_info "Creating monitoring configuration..."
    mkdir -p monitoring/grafana/{dashboards,datasources}

    # Create Prometheus config
    cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:9090']
        labels:
          service: 'api-gateway'

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF

    # Create Grafana datasource
    cat > monitoring/grafana/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

    print_success "Monitoring configuration created"
fi

# Parse command line arguments
MONITORING=false
REBUILD=false
DETACH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --monitoring)
            MONITORING=true
            shift
            ;;
        --rebuild)
            REBUILD=true
            shift
            ;;
        -d|--detach)
            DETACH=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Usage: $0 [--monitoring] [--rebuild] [-d|--detach]"
            echo "  --monitoring  Start with Prometheus and Grafana"
            echo "  --rebuild     Force rebuild of Docker images"
            echo "  -d, --detach  Run in detached mode"
            exit 1
            ;;
    esac
done

# Build compose command
COMPOSE_CMD="$DOCKER_COMPOSE up"

if [ "$DETACH" = true ]; then
    COMPOSE_CMD="$COMPOSE_CMD -d"
fi

if [ "$REBUILD" = true ]; then
    COMPOSE_CMD="$COMPOSE_CMD --build"
fi

if [ "$MONITORING" = true ]; then
    COMPOSE_CMD="$COMPOSE_CMD --profile monitoring"
fi

# Stop any running containers
print_info "Stopping any running containers..."
$DOCKER_COMPOSE down 2>/dev/null || true

# Start the gateway
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🚀 Starting API Gateway${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$REBUILD" = true ]; then
    print_info "Rebuilding Docker images..."
fi

eval $COMPOSE_CMD

# If running in detached mode, show status
if [ "$DETACH" = true ]; then
    echo ""
    print_success "Gateway started in detached mode"
    echo ""

    # Wait a bit for services to start
    print_info "Waiting for services to be healthy..."
    sleep 5

    # Show container status
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}   Container Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    $DOCKER_COMPOSE ps

    # Show URLs
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}   🌐 Access URLs${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}API Gateway:${NC}        http://localhost:8080"
    echo -e "${GREEN}Health Check:${NC}       http://localhost:8080/health"
    echo -e "${GREEN}Metrics:${NC}            http://localhost:9090/metrics"
    echo -e "${GREEN}Auth Service:${NC}       http://localhost:3001"
    echo -e "${GREEN}User Service:${NC}       http://localhost:3002"

    if [ "$MONITORING" = true ]; then
        echo -e "${GREEN}Prometheus:${NC}         http://localhost:9091"
        echo -e "${GREEN}Grafana:${NC}            http://localhost:3000 (admin/admin)"
    fi

    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}   📝 Quick Test Commands${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}# Test health check${NC}"
    echo -e "curl http://localhost:8080/health"
    echo ""
    echo -e "${YELLOW}# Login and get JWT token${NC}"
    echo -e "curl -X POST http://localhost:8080/api/auth/login \\"
    echo -e "  -H \"Content-Type: application/json\" \\"
    echo -e "  -d '{\"username\":\"demo_admin\",\"password\":\"change-me-admin\"}'"
    echo ""
    echo -e "${YELLOW}# View metrics${NC}"
    echo -e "curl http://localhost:9090/metrics"
    echo ""
    echo -e "${YELLOW}# View logs${NC}"
    echo -e "docker-compose logs -f api-gateway"
    echo ""
    echo -e "${YELLOW}# Stop all services${NC}"
    echo -e "./stop-gateway.sh"
    echo ""

    # Source the .env file to get ADMIN_TOKEN
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}   🔑 Admin API Access${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${YELLOW}# View configuration${NC}"
        echo -e "curl -H \"Authorization: Bearer ${ADMIN_TOKEN}\" \\"
        echo -e "  http://localhost:8080/admin/config | jq ."
        echo ""
    fi

    print_success "API Gateway is running! 🚀"
fi
