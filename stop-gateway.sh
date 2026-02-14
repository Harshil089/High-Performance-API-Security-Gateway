#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  High-Performance API Security Gateway - Shutdown         ║${NC}"
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

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Parse command line arguments
REMOVE_VOLUMES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        *)
            echo "Usage: $0 [-v|--volumes]"
            echo "  -v, --volumes  Remove volumes (Redis data, Prometheus data, etc.)"
            exit 1
            ;;
    esac
done

# Stop containers
print_info "Stopping all containers..."
$DOCKER_COMPOSE down

if [ "$REMOVE_VOLUMES" = true ]; then
    print_warning "Removing all volumes (data will be lost)..."
    $DOCKER_COMPOSE down -v
    print_success "All containers and volumes removed"
else
    print_success "All containers stopped (volumes preserved)"
    echo ""
    print_info "To remove volumes as well, run: $0 --volumes"
fi

echo ""
print_success "Gateway shutdown complete"
