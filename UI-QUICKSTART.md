# API Gateway Admin UI - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+ installed
- Gateway running on `http://localhost:8080`
- Admin token from `.env` file

### Option 1: Local Development (Fastest)

```bash
# 1. Navigate to UI directory
cd ui

# 2. Install dependencies (if not already done)
npm install

# 3. Start development server
npm run dev
```

**Access at**: http://localhost:3000

The dashboard will automatically fetch metrics from your running gateway!

### Option 2: Docker Deployment (Production-Ready)

```bash
# 1. From project root, build and start all services
docker compose up --build gateway-ui

# Or start just the UI (requires gateway to be running)
docker compose up gateway-ui
```

**Access at**: http://localhost:3001

### Option 3: Full Stack with Docker

```bash
# Start everything (Gateway + Redis + Mock Services + UI)
docker compose up --build

# Or without monitoring services
docker compose up api-gateway redis auth-service user-service gateway-ui
```

**Services available:**
- Gateway: http://localhost:8080
- Admin UI: http://localhost:3001
- Metrics: http://localhost:8080/metrics

## 📊 What You'll See

### Dashboard Overview

When you open the UI, you'll immediately see:

1. **Total Requests** - Lifetime request count
2. **Active Connections** - Current connected clients
3. **Auth Success Rate** - Authentication performance
4. **Cache Hit Rate** - Cache efficiency
5. **Status Codes** - 2xx/4xx/5xx distribution
6. **Backend Health** - Service status

### Real-Time Updates

Metrics automatically refresh every 5 seconds. No manual refresh needed!

## 🔧 Configuration

### Environment Variables

The UI reads configuration from `.env.local`:

```env
# Gateway connection
GATEWAY_URL=http://localhost:8080        # Where your gateway is running
ADMIN_TOKEN=2af82383...                  # From main .env file

# UI settings
NEXT_PUBLIC_REFRESH_INTERVAL=5000        # Metrics refresh rate (ms)
```

### Changing the Admin Token

If you regenerate your admin token:

1. Update `ADMIN_TOKEN` in the main `.env` file
2. Update `ADMIN_TOKEN` in `ui/.env.local`
3. Restart the UI

## 🐛 Troubleshooting

### "Failed to load metrics"

**Cause**: Cannot connect to gateway
**Solution**:
```bash
# Check gateway is running
curl http://localhost:8080/health

# Should return 200 OK
```

### "Admin token not configured"

**Cause**: `.env.local` missing or token incorrect
**Solution**:
```bash
cd ui
cat .env.local  # Verify ADMIN_TOKEN is set
```

### Port 3000 already in use

**Cause**: Another service (like Grafana) using port 3000
**Solution**:
- Use Docker version on port 3001
- Or change Next.js port: `PORT=3002 npm run dev`

### Build fails in Docker

**Cause**: Tailwind CSS compilation error
**Solution**: Already handled - UI uses Tailwind v3 for compatibility

## 📈 Available Metrics

The dashboard displays metrics from these Prometheus endpoints:

- `gateway_requests_total` - Total requests
- `gateway_active_connections` - Active connections
- `gateway_auth_success_total` - Successful authentications
- `gateway_auth_failure_total` - Failed authentications
- `gateway_cache_hits_total` - Cache hits
- `gateway_cache_misses_total` - Cache misses
- `gateway_backend_errors_total` - Backend errors

## 🎯 Next Steps

Once the UI is running:

1. **Monitor Performance** - Watch metrics update in real-time
2. **Check Backend Health** - See which services are healthy
3. **View Status Codes** - Identify error patterns
4. **Track Auth Success** - Monitor security

## 🔒 Security Notes

- Admin token is NEVER sent to the browser
- All admin API calls go through Next.js backend
- Token is injected server-side via BFF pattern
- Only the gateway URL is exposed to the frontend

## 💡 Tips

### Development Mode Features
- Hot reload on code changes
- Detailed error messages
- React DevTools support
- Source maps enabled

### Production Mode Benefits
- Optimized bundle size
- Server-side rendering
- Automatic code splitting
- Better performance

### Viewing Raw Metrics
To see raw Prometheus metrics:
```bash
curl http://localhost:8080/metrics
```

### Testing API Endpoints
Test if admin API is accessible:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:8080/admin/config
```

## 📚 More Information

- **Full Documentation**: [ui/README.md](ui/README.md)
- **Implementation Details**: [UI-IMPLEMENTATION-SUMMARY.md](UI-IMPLEMENTATION-SUMMARY.md)
- **Gateway Docs**: [README.md](README.md)

## 🆘 Getting Help

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section above
2. Review browser console for errors (F12)
3. Check UI logs: `docker compose logs gateway-ui`
4. Verify gateway is healthy: `curl http://localhost:8080/health`

## 🎉 Success!

If you see the dashboard with metrics updating, you're all set!

The UI foundation is complete and ready for additional features. Enjoy monitoring your API Gateway!
