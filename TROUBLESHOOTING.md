# Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "Route not found" Error

**Symptom:**
```bash
curl http://localhost:8080/api/users -H "Authorization: Bearer $TOKEN"
{"error":"Route not found"}
```

**Cause:** The route pattern `/api/users/*` requires a path after `users`.

**Solution:** Add a trailing slash:
```bash
curl http://localhost:8080/api/users/ -H "Authorization: Bearer $TOKEN"
```

Or access a specific user:
```bash
curl http://localhost:8080/api/users/1 -H "Authorization: Bearer $TOKEN"
```

---

### Issue 2: "Unauthorized" Error on Protected Endpoints

**Symptom:**
```bash
curl http://localhost:8080/api/users/ -H "Authorization: Bearer $TOKEN"
{"error":"Unauthorized"}
```

**Cause:** The mock auth service returns a simple mock token string instead of a properly signed JWT token. The gateway cannot validate these mock tokens.

**Root Cause Details:**
1. The gateway expects JWT tokens signed with the `JWT_SECRET` environment variable
2. The mock `auth-service.js` returns: `mock_jwt_token_user_001_<timestamp>`
3. This is just a string, not a valid JWT with signature

**Solution Option 1 - Update Mock Auth Service (Recommended):**

Edit `mock-services/auth-service.js` to generate real JWT tokens:

```javascript
const jwt = require('jsonwebtoken');

// At the top of the file
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-min-32-characters-long';

// In the login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validate credentials
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate real JWT token
    const token = jwt.sign(
        {
            sub: user.id,
            iss: 'api-gateway',
            aud: 'api-clients',
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
    );

    res.json({
        token: token,
        user_id: user.id,
        role: user.role,
        expires_in: 3600
    });
});
```

Then install jsonwebtoken:
```bash
cd mock-services
npm install jsonwebtoken
cd ..
```

**Solution Option 2 - Set JWT_SECRET and Restart:**

```bash
export JWT_SECRET="your-super-secret-key-min-32-characters-long"
./run.sh  # Restart all services
```

---

### Issue 3: JWT_SECRET Not Set

**Symptom:** Gateway starts but can't generate or validate JWT tokens properly.

**Solution:**
```bash
# Set the environment variable
export JWT_SECRET="your-super-secret-key-min-32-characters-long"

# Make it persistent (add to ~/.zshrc or ~/.bashrc)
echo 'export JWT_SECRET="your-super-secret-key-min-32-characters-long"' >> ~/.zshrc

# Reload shell config
source ~/.zshrc

# Restart gateway
./run.sh
```

---

### Issue 4: Services Not Starting

**Symptom:** `./run.sh` fails or services don't respond.

**Diagnosis:**
```bash
# Check if services are running
ps aux | grep -E "api-gateway|node.*service"

# Check ports
lsof -i :8080  # Gateway
lsof -i :3001  # Auth service
lsof -i :3002  # User service
lsof -i :3004  # Payment service

# Check logs
tail -f logs/gateway.log
```

**Solution:**
```bash
# Kill all services
pkill -f api-gateway
pkill -f "node.*service"

# Restart
./run.sh
```

---

### Issue 5: Build Errors

**Symptom:** `./build.sh` fails with dependency errors.

**Common Causes:**
1. CMake version too old (need 3.25+)
2. Missing dependencies
3. Compiler issues

**Solutions:**

**macOS:**
```bash
# Update CMake
brew upgrade cmake

# Install dependencies
brew install cmake openssl ossp-uuid

# Clean and rebuild
rm -rf build
./build.sh
```

**Linux (Ubuntu/Debian):**
```bash
# Install newer CMake
sudo apt-get update
sudo apt-get install cmake libssl-dev uuid-dev build-essential

# If CMake too old, install from snap
sudo snap install cmake --classic

# Clean and rebuild
rm -rf build
./build.sh
```

---

### Issue 6: Rate Limiting Test

**Testing Rate Limits:**

Login endpoint (5 req/60s):
```bash
for i in {1..7}; do
  echo "Request $i:"
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"secret"}'
  echo ""
done
```

Expected: First 5 succeed, requests 6-7 get rate limited.

---

### Issue 7: CORS Errors in Browser

**Symptom:** Browser console shows CORS errors.

**Solution:** The gateway has CORS enabled by default. If still seeing errors:

1. Check `config/gateway.json`:
```json
"cors": {
  "enabled": true,
  "allowed_origins": ["*"],
  "allowed_headers": ["*"],
  "allowed_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}
```

2. Restart gateway after config changes.

---

## Testing the Complete Flow

### Manual Testing:

```bash
# 1. Health Check
curl http://localhost:8080/health

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}' | jq -r '.token')

echo "Token: $TOKEN"

# 3. Access protected endpoint
curl http://localhost:8080/api/users/ \
  -H "Authorization: Bearer $TOKEN"

# 4. Get specific user
curl http://localhost:8080/api/users/1 \
  -H "Authorization: Bearer $TOKEN"

# 5. Create user
curl -X POST http://localhost:8080/api/users/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","role":"user"}'
```

### Automated Testing:

```bash
# Run the test script
./test-gateway.sh

# Run unit tests
./test.sh
```

---

## Debugging Tips

### Enable Debug Logging:

Edit `config/gateway.json`:
```json
"logging": {
  "level": "debug",  // Change from "info" to "debug"
  ...
}
```

### Watch Logs in Real-Time:

```bash
tail -f logs/gateway.log | jq '.'
```

### Check Backend Health:

```bash
# Direct backend calls (bypassing gateway)
curl http://localhost:3001/health  # Auth service
curl http://localhost:3002/health  # User service
curl http://localhost:3004/health  # Payment service
```

### Verify JWT Token Contents:

```bash
# Decode JWT (base64)
echo "$TOKEN" | cut -d '.' -f2 | base64 -d | jq '.'
```

---

## Performance Testing

```bash
# Install wrk
brew install wrk  # macOS
# or
sudo apt-get install wrk  # Linux

# Run load test
wrk -t4 -c100 -d30s http://localhost:8080/health

# With authentication
./benchmarks/load_test.sh
```

---

## FAQ

**Q: Why does `/api/users` not work but `/api/users/` does?**

A: The route pattern `/api/users/*` requires something after "users". The `*` wildcard must match at least a `/`. You can either use `/api/users/` or change the pattern to `/api/users*` in `config/routes.json`.

**Q: Can I use the gateway with real microservices?**

A: Yes! Update the backend URLs in `config/routes.json` to point to your actual services.

**Q: How do I add a new route?**

A: Edit `config/routes.json` and add a new route object:
```json
{
  "path": "/api/newservice/*",
  "backend": "http://localhost:3005",
  "timeout": 3000,
  "require_auth": true,
  "strip_prefix": "/api"
}
```

**Q: How do I disable authentication for testing?**

A: Set `"require_auth": false` in the route configuration.

---

## Getting Help

- Check [README.md](README.md) for overview
- See [QUICKSTART.md](QUICKSTART.md) for quick setup
- Read [docs/architecture.md](docs/architecture.md) for technical details
- Review [docs/api-documentation.md](docs/api-documentation.md) for API reference
- Open an issue on GitHub for bugs

---

**Note:** This is a development/demonstration project. For production use, implement:
- Proper secret management (HashiCorp Vault, AWS Secrets Manager, etc.)
- Real database backends
- Distributed rate limiting (Redis)
- Monitoring and metrics (Prometheus, Grafana)
- Service mesh integration (Istio, Linkerd)
