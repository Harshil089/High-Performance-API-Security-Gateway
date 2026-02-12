#!/bin/bash

# Build script for API Gateway

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║        Building High-Performance API Gateway                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check for required tools
echo "Checking prerequisites..."

if ! command -v cmake &> /dev/null; then
    echo "❌ CMake not found. Please install CMake 3.15+"
    exit 1
fi

if ! command -v g++ &> /dev/null && ! command -v clang++ &> /dev/null; then
    echo "❌ C++ compiler not found. Please install GCC or Clang"
    exit 1
fi

echo "✓ CMake found: $(cmake --version | head -n1)"
echo "✓ Compiler found"
echo ""

# Create build directory
BUILD_DIR="build"
BUILD_TYPE="${1:-Release}"

echo "Build configuration:"
echo "  - Build directory: $BUILD_DIR"
echo "  - Build type: $BUILD_TYPE"
echo ""

if [ -d "$BUILD_DIR" ]; then
    echo "Cleaning existing build directory..."
    rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "Running CMake configuration..."
cmake .. -DCMAKE_BUILD_TYPE=$BUILD_TYPE

echo ""
echo "Building project..."
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Build completed successfully!                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Executables:"
echo "  - API Gateway: $BUILD_DIR/api-gateway"
echo "  - Unit Tests:  $BUILD_DIR/gateway-tests"
echo ""
echo "Next steps:"
echo "  1. Set JWT secret: export JWT_SECRET='your-secret-key-min-32-chars'"
echo "  2. Install mock services: cd mock-services && npm install"
echo "  3. Start mock services: cd mock-services && npm run all"
echo "  4. Run gateway: ./build/api-gateway"
echo ""
