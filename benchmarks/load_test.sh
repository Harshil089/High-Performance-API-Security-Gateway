#!/bin/bash

# Load testing script for API Gateway
# Requires: wrk (https://github.com/wg/wrk)

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         API Gateway Load Testing Suite                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

GATEWAY_URL="http://localhost:8080"
DURATION="30s"
THREADS=12
CONNECTIONS=400

# Check if wrk is installed
if ! command -v wrk &> /dev/null; then
    echo "Error: wrk is not installed"
    echo "Install with: brew install wrk (macOS) or apt-get install wrk (Linux)"
    exit 1
fi

echo "Configuration:"
echo "  - Gateway URL: $GATEWAY_URL"
echo "  - Duration: $DURATION"
echo "  - Threads: $THREADS"
echo "  - Connections: $CONNECTIONS"
echo ""

# Test 1: Health check endpoint (no auth)
echo "═══════════════════════════════════════════════════════════════"
echo "Test 1: Health Check Endpoint (No Authentication)"
echo "═══════════════════════════════════════════════════════════════"
wrk -t$THREADS -c$CONNECTIONS -d$DURATION $GATEWAY_URL/health
echo ""

# Test 2: Auth endpoint (rate limited)
echo "═══════════════════════════════════════════════════════════════"
echo "Test 2: Login Endpoint (Rate Limited)"
echo "═══════════════════════════════════════════════════════════════"
wrk -t$THREADS -c100 -d$DURATION \
    -s benchmarks/post_login.lua \
    $GATEWAY_URL/api/auth/login
echo ""

# Test 3: Protected endpoint with JWT
echo "═══════════════════════════════════════════════════════════════"
echo "Test 3: Protected Users Endpoint (With JWT)"
echo "═══════════════════════════════════════════════════════════════"
# First get a token
echo "Getting JWT token..."
TOKEN=$(curl -s -X POST $GATEWAY_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"secret"}' | \
    grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
    echo "Warning: Could not obtain JWT token. Skipping protected endpoint test."
else
    echo "Token obtained: ${TOKEN:0:20}..."
    wrk -t$THREADS -c$CONNECTIONS -d$DURATION \
        -H "Authorization: Bearer $TOKEN" \
        $GATEWAY_URL/api/users
fi
echo ""

# Test 4: Rate limit test
echo "═══════════════════════════════════════════════════════════════"
echo "Test 4: Rate Limiting Verification"
echo "═══════════════════════════════════════════════════════════════"
echo "Sending 50 requests rapidly to test rate limiting..."
for i in {1..50}; do
    status=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY_URL/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"secret"}')
    if [ "$status" = "429" ]; then
        echo "✓ Rate limit activated after $i requests (HTTP 429)"
        break
    fi
done
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "Load testing complete!"
echo "═══════════════════════════════════════════════════════════════"
