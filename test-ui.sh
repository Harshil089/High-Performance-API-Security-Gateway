#!/bin/bash

# Test script for API Gateway Admin UI

set -e

echo "🧪 Testing API Gateway Admin UI"
echo "================================"
echo ""

# Check if ui directory exists
if [ ! -d "ui" ]; then
    echo "❌ Error: ui directory not found"
    exit 1
fi

echo "✅ UI directory exists"

# Check if required files exist
required_files=(
    "ui/package.json"
    "ui/tsconfig.json"
    "ui/next.config.mjs"
    "ui/Dockerfile"
    "ui/README.md"
    "ui/.env.local"
    "ui/src/app/page.tsx"
    "ui/src/app/layout.tsx"
    "ui/src/app/api/config/route.ts"
    "ui/src/app/api/metrics/route.ts"
    "ui/src/lib/prometheus.ts"
    "ui/src/types/gateway.ts"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: $file not found"
        exit 1
    fi
    echo "✅ $file exists"
done

echo ""
echo "📦 Checking dependencies..."

cd ui

if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Run 'npm install' first."
    exit 1
fi

echo "✅ Dependencies installed"

echo ""
echo "🔨 Building application..."

npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "To start the UI:"
echo "  Development: cd ui && npm run dev"
echo "  Production:  cd ui && npm start"
echo "  Docker:      docker compose up gateway-ui"
echo ""
echo "Access the UI at: http://localhost:3001 (Docker) or http://localhost:3000 (local)"
