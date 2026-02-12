#!/bin/bash

# Run script for API Gateway

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        Starting API Gateway and Mock Services                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if built
if [ ! -f "build/api-gateway" ]; then
    echo "Gateway not built. Building now..."
    ./build.sh
fi

# Check JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    echo "⚠️  JWT_SECRET not set. Using default (NOT FOR PRODUCTION)"
    export JWT_SECRET="default-secret-key-for-development-only-min-32-chars"
fi

# Create logs directory
mkdir -p logs

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js to run mock services"
    exit 1
fi

# Install mock service dependencies if needed
if [ ! -d "mock-services/node_modules" ]; then
    echo "Installing mock service dependencies..."
    cd mock-services
    npm install
    cd ..
fi

echo "Starting mock backend services..."
echo ""

# Start mock services in background
cd mock-services
node auth-service.js > ../logs/auth-service.log 2>&1 &
AUTH_PID=$!
echo "✓ Auth Service started (PID: $AUTH_PID)"

node user-service.js > ../logs/user-service.log 2>&1 &
USER_PID=$!
echo "✓ User Service started (PID: $USER_PID)"

node payment-service.js > ../logs/payment-service.log 2>&1 &
PAYMENT_PID=$!
echo "✓ Payment Service started (PID: $PAYMENT_PID)"

cd ..

# Wait for services to start
echo ""
echo "Waiting for services to initialize..."
sleep 2

# Start gateway
echo ""
echo "Starting API Gateway..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $AUTH_PID $USER_PID $PAYMENT_PID 2>/dev/null
    echo "✓ All services stopped"
}

trap cleanup EXIT

# Run gateway
./build/api-gateway --config config/gateway.json --routes config/routes.json
