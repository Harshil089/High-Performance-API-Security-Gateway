#!/usr/bin/env node

/**
 * Mock Gateway Server for UI Development
 * Simulates the C++ gateway's Admin API and Metrics endpoints
 * Run: node mock-gateway.js
 */

const http = require('http');

const ADMIN_TOKEN = '2af82383ba0a6a5e995484952b3f7241053184850c1209857af77bc1a39bd077';

// Mock data
let requestCount = 0;
let mockConfig = {
  config: {
    server: {
      host: "0.0.0.0",
      port: 8080,
      timeout: 30,
      max_connections: 1000
    },
    jwt: {
      algorithm: "HS256",
      secret: "your-secret-key",
      issuer: "api-gateway",
      audience: "api-clients",
      access_token_expiry: 3600,
      refresh_token_expiry: 604800,
      public_key_file: "",
      private_key_file: ""
    },
    security: {
      max_header_size: 8192,
      allowed_methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      cors: {
        enabled: true,
        allowed_origins: ["*"],
        allowed_methods: ["GET", "POST", "PUT", "DELETE"],
        allowed_headers: ["Content-Type", "Authorization"],
        expose_headers: [],
        max_age: 3600,
        allow_credentials: false
      },
      headers: {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block"
      },
      ip_whitelist: [],
      ip_blacklist: [],
      api_keys: {}
    },
    cache: {
      enabled: true,
      backend: "redis",
      default_ttl: 300,
      max_entry_size: 1048576,
      cacheable_methods: ["GET", "HEAD"],
      cacheable_status_codes: [200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501],
      exclude_paths: ["/admin/*", "/health"],
      respect_cache_control: true
    },
    rate_limits: {
      global: { requests: 1000, window: 60 },
      per_ip: { requests: 100, window: 60 },
      endpoints: {}
    },
    routes: {
      "/api/users/*": {
        backends: ["http://user-service:8002"],
        timeout: 30,
        require_auth: false
      },
      "/api/auth/*": {
        backends: ["http://auth-service:8001"],
        timeout: 10,
        require_auth: false
      }
    }
  }
};

// Generate mock Prometheus metrics
function generateMetrics() {
  requestCount += Math.floor(Math.random() * 5);
  const timestamp = Date.now();

  return `# HELP gateway_requests_total Total number of requests
# TYPE gateway_requests_total counter
gateway_requests_total ${requestCount}

# HELP gateway_active_connections Active connections
# TYPE gateway_active_connections gauge
gateway_active_connections ${Math.floor(Math.random() * 50)}

# HELP gateway_auth_success_total Successful authentications
# TYPE gateway_auth_success_total counter
gateway_auth_success_total ${Math.floor(requestCount * 0.8)}

# HELP gateway_auth_failure_total Failed authentications
# TYPE gateway_auth_failure_total counter
gateway_auth_failure_total ${Math.floor(requestCount * 0.2)}

# HELP gateway_cache_hits_total Cache hits
# TYPE gateway_cache_hits_total counter
gateway_cache_hits_total ${Math.floor(requestCount * 0.6)}

# HELP gateway_cache_misses_total Cache misses
# TYPE gateway_cache_misses_total counter
gateway_cache_misses_total ${Math.floor(requestCount * 0.4)}

# HELP gateway_backend_errors_total Backend errors
# TYPE gateway_backend_errors_total counter
gateway_backend_errors_total{backend="http://user-service:8002"} ${Math.floor(Math.random() * 5)}
gateway_backend_errors_total{backend="http://auth-service:8001"} ${Math.floor(Math.random() * 3)}

# HELP gateway_request_duration_seconds Request duration
# TYPE gateway_request_duration_seconds histogram
gateway_request_duration_seconds_bucket{le="0.1"} ${Math.floor(requestCount * 0.5)}
gateway_request_duration_seconds_bucket{le="0.5"} ${Math.floor(requestCount * 0.8)}
gateway_request_duration_seconds_bucket{le="1.0"} ${requestCount}
gateway_request_duration_seconds_sum ${requestCount * 0.3}
gateway_request_duration_seconds_count ${requestCount}

# HELP gateway_status_codes_total HTTP status codes
# TYPE gateway_status_codes_total counter
gateway_status_codes_total{code="200"} ${Math.floor(requestCount * 0.7)}
gateway_status_codes_total{code="404"} ${Math.floor(requestCount * 0.2)}
gateway_status_codes_total{code="500"} ${Math.floor(requestCount * 0.1)}
`;
}

const server = http.createServer((req, res) => {
  const { method, url, headers } = req;

  console.log(`${method} ${url}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health endpoint
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
    return;
  }

  // Metrics endpoint (public - no auth required)
  if (url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(generateMetrics());
    return;
  }

  // Admin API - require auth
  if (url.startsWith('/admin/')) {
    const authHeader = headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // GET /admin/config
    if (method === 'GET' && url === '/admin/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockConfig));
      return;
    }

    // POST /admin/config
    if (method === 'POST' && url === '/admin/config') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const update = JSON.parse(body);
          mockConfig = update;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: mockConfig.config }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // GET /admin/cache/stats
    if (method === 'GET' && url === '/admin/cache/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        total_entries: Math.floor(Math.random() * 1000),
        total_hits: Math.floor(requestCount * 0.6),
        total_misses: Math.floor(requestCount * 0.4),
        hit_rate: 0.6,
        memory_usage: Math.floor(Math.random() * 10485760),
        evictions: Math.floor(Math.random() * 50)
      }));
      return;
    }

    // POST /admin/cache/clear
    if (method === 'POST' && url === '/admin/cache/clear') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, cleared: true }));
      return;
    }

    // POST /admin/ratelimit/reset
    if (method === 'POST' && url === '/admin/ratelimit/reset') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, reset: true }));
      return;
    }
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`🚀 Mock Gateway Server running on http://localhost:${PORT}`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔧 Admin API: http://localhost:${PORT}/admin/config`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  console.log(`\nPress Ctrl+C to stop`);
});
