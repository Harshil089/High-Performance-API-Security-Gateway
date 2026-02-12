#!/bin/bash

# Test script for API Gateway

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        API Gateway Test Suite                                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if tests are built
if [ ! -f "build/gateway-tests" ]; then
    echo "Tests not built. Building now..."
    ./build.sh
fi

echo "Running unit tests..."
echo ""

cd build
./gateway-tests

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  All tests completed!                                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
