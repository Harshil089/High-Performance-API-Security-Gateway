#!/bin/bash

# Quick test script for JWT authentication flow
# Run this after starting services with: export JWT_SECRET='test-secret-key-min-32-characters-long' && ./run.sh

echo "🧪 API Gateway JWT Authentication Test"
echo "======================================="
echo ""

# 1. Health Check
echo "1️⃣  Testing health endpoint..."
curl -s http://localhost:8080/health | jq '.'
echo ""

# 2. Login and get JWT token
echo "2️⃣  Logging in to get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}')

echo "$LOGIN_RESPONSE" | jq '.'

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
echo ""
echo "📝 Token received: ${TOKEN:0:50}..."
echo ""

# 3. Decode JWT to show contents (without verification)
echo "3️⃣  JWT Token contents (header.payload.signature):"
echo "Header:"
echo "$TOKEN" | cut -d '.' -f1 | base64 -d 2>/dev/null | jq '.' 2>/dev/null || echo "  (binary data)"
echo ""
echo "Payload:"
echo "$TOKEN" | cut -d '.' -f2 | base64 -d 2>/dev/null | jq '.' 2>/dev/null || echo "  (binary data)"
echo ""

# 4. Access protected endpoint - Get all users
echo "4️⃣  Accessing protected endpoint /api/users/ with JWT..."
curl -s http://localhost:8080/api/users/ \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 5. Get specific user
echo "5️⃣  Getting specific user /api/users/1..."
curl -s http://localhost:8080/api/users/1 \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 6. Try without authentication (should fail)
echo "6️⃣  Testing without authentication (should fail)..."
curl -s http://localhost:8080/api/users/ | jq '.'
echo ""

# 7. Create a new user
echo "7️⃣  Creating a new user..."
curl -s -X POST http://localhost:8080/api/users/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","role":"user"}' | jq '.'
echo ""

echo "✅ Test complete!"
echo ""
echo "💡 Tip: Set JWT_SECRET environment variable before starting:"
echo "   export JWT_SECRET='test-secret-key-min-32-characters-long'"
echo "   ./run.sh"
