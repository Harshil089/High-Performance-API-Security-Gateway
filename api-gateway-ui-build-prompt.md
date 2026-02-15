# Professional UI Development Prompt for High-Performance API Security Gateway

## ROLE
You are a **Senior Full-Stack Developer** specializing in building enterprise-grade admin dashboards and API management interfaces. You have extensive experience with:
- Modern frontend frameworks (React, Next.js, Vue.js)
- Real-time data visualization and monitoring dashboards
- API gateway management UIs (similar to Kong, AWS API Gateway, Apigee)
- Security-focused UI/UX design patterns
- Integration with backend services via REST APIs and WebSocket

## OBJECTIVE
Build a **production-ready, professional web UI** for the High-Performance API Security Gateway that enables administrators to:
1. **Monitor** real-time gateway performance, metrics, and health
2. **Manage** routes, backends, security policies, and rate limits
3. **Configure** gateway settings without editing JSON files
4. **Visualize** traffic patterns, authentication flows, and cache performance
5. **Troubleshoot** issues through logs, alerts, and request tracing
6. **Test** API endpoints with built-in request builder

## CONTEXT & TECHNICAL BACKGROUND

### Gateway Architecture
The API Gateway is a **C++ high-performance service** with the following characteristics:
- Handles 10,000+ requests/second with sub-10ms P95 latency
- Consolidates authentication (JWT/API Keys), rate limiting, caching, routing, and security validation
- Exposes Prometheus metrics at `/metrics`
- Provides Admin API at `/admin/*` endpoints (Bearer token authenticated)
- Integrates with Redis for distributed caching and rate limiting
- Routes traffic to multiple backend microservices with load balancing and circuit breaking

### Current Admin API Endpoints
```
GET  /admin/config              # View current configuration
POST /admin/config              # Update configuration at runtime
GET  /admin/cache/stats         # Redis cache statistics
POST /admin/cache/clear         # Clear all cached responses
POST /admin/ratelimit/reset     # Reset rate limit for a specific key
POST /admin/reload              # Reload configuration from disk
```

### Key Gateway Features to Surface in UI
1. **Security Layer**: JWT/API Key auth, IP filtering, input validation, CORS, TLS
2. **Routing Engine**: Pattern-based routes with wildcard matching, load balancing (round-robin)
3. **Rate Limiting**: Global, per-IP, per-endpoint limits using token bucket algorithm
4. **Caching**: Redis-backed response caching with configurable TTL
5. **Circuit Breaker**: Automatic failure detection and recovery for backends
6. **Health Monitoring**: Background health checks for all backend services
7. **Observability**: Prometheus metrics, structured JSON logs, request tracing (X-Request-ID)

### Performance Benchmarks to Display
- Throughput: 10,000+ req/s (single core)
- P95 Latency: < 10ms
- Memory Usage: ~80MB under load
- Cache Hit Latency: < 1ms
- Binary Size: ~15MB

## REQUIREMENTS

### Functional Requirements

#### 1. Dashboard Overview (Home Page)
**Must Display:**
- Real-time request rate (req/s) with sparkline chart
- HTTP status code distribution (2xx, 4xx, 5xx) with pie/donut chart
- Active connections count
- Auth success vs failure rate (bar chart or meter)
- Rate limit hit percentage
- Cache hit rate percentage
- Top 5 most requested endpoints (table with req count)
- Backend health status grid (green/red indicators per service)
- Gateway uptime and version info
- System resource usage (CPU, memory, connections)

**Behavior:**
- Auto-refresh every 5 seconds (configurable)
- Clickable metrics that drill down into detailed views
- Alert banners for unhealthy backends or rate limit violations

#### 2. Route Management
**Features:**
- **View All Routes**: Paginated table showing path, backend(s), auth required, timeout, load balancing strategy
- **Add New Route**: Form to configure:
  - Path pattern (e.g., `/api/users/*`)
  - Backend URL(s) (support multiple for load balancing)
  - Load balancing algorithm (round-robin)
  - Timeout (ms)
  - Require authentication (toggle)
  - Strip prefix option
  - Rewrite rule
- **Edit Route**: Inline editing or modal form
- **Delete Route**: Confirmation dialog with impact warning
- **Test Route**: Send test request directly from UI with custom headers/body
- **Duplicate Route**: Clone existing route as template

**Validation:**
- Path pattern must be unique
- Backend URLs must be valid HTTP/HTTPS
- Timeout must be positive integer
- Show preview of final URL after rewrite

#### 3. Security Configuration
**Sections:**

**3.1 Authentication**
- JWT Settings:
  - Algorithm selector (HS256 / RS256)
  - Secret input (masked, with "show" toggle) for HS256
  - Public/Private key file paths for RS256
  - Token expiry slider (in minutes/hours)
  - Issuer and Audience fields
  - "Test JWT" button: paste token, see decoded payload + validation result
- API Keys Management:
  - Table of API keys with description and creation date
  - Generate new API key (with auto-generated secure key)
  - Revoke API key (with confirmation)
  - Copy API key to clipboard

**3.2 IP Filtering**
- IP Whitelist:
  - Add/remove IP addresses or CIDR ranges
  - Import from CSV
  - Validation: valid IPv4/IPv6 format
- IP Blacklist:
  - Same functionality as whitelist
  - Warning badge: "Blacklist takes priority"

**3.3 CORS Settings**
- Allowed Origins (multi-input with tags)
- Allowed Methods (checkbox group)
- Allowed Headers (multi-input)
- Max Age (number input in seconds)
- Enable/Disable toggle

**3.4 Security Headers**
- Dropdown selectors for standard values:
  - X-Frame-Options: DENY / SAMEORIGIN / ALLOW-FROM
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection: 1; mode=block / 0
  - Referrer-Policy: strict-origin-when-cross-origin / no-referrer / etc.

**3.5 Input Validation**
- Display current validation rules (SQL injection, XSS, path traversal patterns)
- Toggle enable/disable for each validator
- View logs of blocked requests (if available via Admin API extension)

#### 4. Rate Limiting Dashboard
**Views:**

**4.1 Global Rate Limits**
- Global limit: requests per window (editable)
- Per-IP limit: requests per window (editable)
- Per-IP max concurrent connections (editable)
- Current usage gauges showing % of limit consumed

**4.2 Endpoint-Specific Limits**
- Table of endpoints with custom rate limits
- Add new endpoint limit (dropdown to select existing route)
- Edit/Delete endpoint limits
- Real-time hit counter per endpoint

**4.3 Rate Limit Events**
- Live feed of rate limit violations:
  - Timestamp
  - Client IP
  - Endpoint
  - Limit exceeded
  - Action taken (blocked/throttled)
- Filter by IP, endpoint, time range

**4.4 Manual Controls**
- "Reset Rate Limit" form:
  - Input: IP address or endpoint
  - Button to reset via `/admin/ratelimit/reset`
  - Confirmation message

#### 5. Caching Management
**Metrics Display:**
- Total cached entries count
- Cache hit rate % (with trend graph)
- Cache miss count
- Average response size
- Memory usage by cache
- Most cached endpoints (top 10 table)

**Actions:**
- "Clear All Cache" button (with confirmation dialog)
- "Purge Specific Key" input (to clear individual cached responses)
- TTL configuration:
  - Default TTL slider (seconds)
  - Excluded paths (multi-input)
  - Cacheable methods (checkboxes: GET, POST, etc.)

**Cache Inspector:**
- View cache keys with metadata (path, TTL remaining, size, hit count)
- Preview cached response (JSON viewer)

#### 6. Backend Services Health
**Display:**
- Grid/card layout for each backend service:
  - Service name (extracted from backend URL)
  - Status indicator (healthy/unhealthy/circuit open)
  - Last health check timestamp
  - Success rate % (last 100 checks)
  - Average latency
  - Circuit breaker state (closed/open/half-open)

**Actions:**
- Manual health check trigger
- Force circuit breaker open/close (emergency controls)
- Configure health check interval
- Configure circuit breaker thresholds:
  - Failure threshold (number of failures before opening)
  - Recovery timeout (seconds)

**Health Check Logs:**
- Timeline view of health check results
- Filter by service
- Export to CSV

#### 7. Metrics & Monitoring
**Integration:**
- Embed Grafana dashboard panels directly (if Grafana is running)
- If no Grafana: Build custom charts from Prometheus `/metrics` endpoint

**Charts to Include:**
- Request rate over time (line chart, last 1h/6h/24h/7d)
- Latency distribution (histogram: P50, P95, P99)
- HTTP status codes over time (stacked area chart)
- Auth success vs failures (line chart)
- Backend latency per service (grouped bar chart)
- Cache hit/miss ratio (pie chart)
- Rate limit hits vs allowed (line chart)
- Active connections (area chart)

**Metrics Export:**
- Download raw Prometheus metrics as text
- Export charts as PNG/SVG

#### 8. Request Tracing & Logs
**Log Viewer:**
- Table of recent requests with columns:
  - Timestamp
  - Request ID (X-Request-ID, clickable to see full trace)
  - Client IP
  - Method + Path
  - Status Code
  - Response Time (ms)
  - User ID (if authenticated)
  - Backend routed to
- Filters:
  - Time range picker
  - Status code (dropdown)
  - Path pattern (text input with autocomplete)
  - Client IP
  - Min/Max response time
- Search bar for Request ID lookup
- Auto-refresh toggle
- Pagination (50/100/200 per page)

**Request Detail Modal:**
- Full request headers
- Request body (formatted JSON if applicable)
- Response headers
- Response body (formatted JSON if applicable)
- Auth validation result
- Rate limit status
- Cache status (HIT/MISS)
- Backend routing decision
- Timeline breakdown (auth → routing → proxy → response)

**Log Export:**
- Export filtered logs as JSON/CSV

#### 9. Configuration Editor
**JSON Editor View:**
- Syntax-highlighted JSON editor for `gateway.json` and `routes.json`
- Validation on save (check for required fields, valid JSON)
- Schema hints (auto-complete for known fields)
- "Compare with Current" diff view before applying
- "Apply Configuration" button → calls `POST /admin/config`
- "Reload from Disk" button → calls `POST /admin/reload`

**Environment Variables Display:**
- Read-only view of environment variables (mask sensitive values like `JWT_SECRET`)
- Indicator if value is set vs using default

**Version Control:**
- Show last 10 configuration changes with:
  - Timestamp
  - Changed by (admin user if multi-user auth implemented)
  - Summary of changes (diff)
- Rollback button to restore previous config

#### 10. API Testing Playground
**Request Builder:**
- Method selector (GET, POST, PUT, DELETE, PATCH)
- URL path input (with autocomplete from configured routes)
- Headers editor (key-value pairs, with common headers as quick-add buttons)
- Body editor (JSON, form-data, raw text)
- "Send Request" button

**Response Display:**
- Status code with color indicator
- Response headers (collapsible)
- Response body (syntax-highlighted JSON or raw text)
- Response time (ms)
- Response size (bytes)
- Cache status (X-Cache header value)
- Request ID for tracing

**Pre-configured Tests:**
- Dropdown with sample requests:
  - Health check
  - Login (with demo credentials)
  - Protected endpoint (auto-includes JWT from login)
  - Rate limit test (spam endpoint)

**cURL Export:**
- Button to copy equivalent cURL command

#### 11. Admin Settings
**User Management** (if implemented):
- List of admin users with roles
- Add/Edit/Delete users
- Password reset

**Gateway Settings:**
- Server host/port (read-only, show current value)
- Max connections (editable)
- Max body size (editable, with unit selector: KB/MB)
- TLS enable/disable toggle (with cert/key file paths)

**Notification Settings:**
- Email alerts for unhealthy backends (toggle + email input)
- Webhook URL for critical events (input field)
- Alert threshold configuration (e.g., error rate > X%)

**Audit Log:**
- Table of admin actions:
  - Timestamp
  - Admin user
  - Action (e.g., "Updated route /api/users", "Cleared cache")
  - IP address
- Export to CSV

### Non-Functional Requirements

#### Performance
- Initial page load < 2 seconds
- Dashboard metrics refresh without full page reload
- Support 1000+ routes in route table without lag (use virtualized list)
- Chart rendering optimized (use canvas for large datasets)

#### Security
- HTTPS only in production
- Admin authentication via JWT (use gateway's own JWT auth)
- Input sanitization to prevent XSS
- CSRF protection on state-changing actions
- Rate limiting on admin endpoints (configurable)

#### Usability
- Responsive design (mobile-friendly for monitoring, desktop-optimized for config)
- Dark mode toggle (persisted in localStorage)
- Keyboard shortcuts:
  - `Ctrl+K` or `Cmd+K`: Quick search (routes, backends, endpoints)
  - `?`: Show keyboard shortcuts help
  - `Esc`: Close modals
- Contextual help tooltips on hover (explain technical terms)
- Undo/Redo for configuration changes (before applying)
- Confirmation dialogs for destructive actions (delete, clear cache, etc.)

#### Accessibility
- ARIA labels for screen readers
- Keyboard navigation support
- Color-blind friendly palette (avoid red/green only for status)
- Sufficient contrast ratios (WCAG AA minimum)

#### Error Handling
- Graceful degradation if backend is unreachable
- User-friendly error messages (avoid raw stack traces)
- Retry mechanism for failed API calls
- Offline indicator with "Retry" button

### Technical Stack

#### Frontend Framework
**Recommended:** React with TypeScript + Next.js (for SSR/API routes)
- **Why React:** Component reusability, large ecosystem, excellent charting libraries
- **Why TypeScript:** Type safety for gateway config schema, better IDE support
- **Why Next.js:** Built-in API routes to proxy Admin API calls (hides admin token from client)

**Alternative:** Vue.js 3 + Nuxt.js (if preferred)

#### UI Component Library
**Recommended:** Shadcn/UI or Ant Design
- **Shadcn/UI:** Tailwind-based, highly customizable, modern aesthetic
- **Ant Design:** Enterprise-grade components, built-in data tables and forms

**Alternative:** Material-UI (MUI)

#### State Management
- **React Query** (TanStack Query) for server state (API calls, caching, auto-refresh)
- **Zustand** or **Redux Toolkit** for client state (UI state, theme, filters)

#### Charts & Visualization
- **Recharts** (React) or **Chart.js** for standard charts (line, bar, pie)
- **D3.js** for custom visualizations (if needed)
- **Apache ECharts** (alternative, more feature-rich)

#### Forms & Validation
- **React Hook Form** + **Zod** for form handling and schema validation
- Pre-define Zod schemas matching gateway config structure

#### Code Editor (for JSON config)
- **Monaco Editor** (same as VS Code) with JSON schema support
- **CodeMirror 6** (lighter alternative)

#### Styling
- **Tailwind CSS** for utility-first styling
- **CSS Modules** or **Styled Components** for component-scoped styles

#### Testing
- **Vitest** for unit tests (faster than Jest)
- **React Testing Library** for component tests
- **Playwright** for E2E tests

#### Additional Libraries
- **date-fns** for timestamp formatting
- **react-hot-toast** for notifications
- **react-icons** for iconography
- **framer-motion** for animations (optional, subtle transitions)

### Architecture Patterns

#### Backend for Frontend (BFF) Pattern
**Problem:** Admin API token should not be exposed to browser client.

**Solution:** Use Next.js API routes as a proxy:
```
Browser → Next.js API Route (server-side) → Gateway Admin API
          (adds Bearer token)
```

**Example:**
```typescript
// pages/api/admin/config.ts
export default async function handler(req, res) {
  const response = await fetch(`http://gateway:8080/admin/config`, {
    headers: { 'Authorization': `Bearer ${process.env.ADMIN_TOKEN}` }
  });
  const data = await response.json();
  res.json(data);
}
```

#### Component Structure
```
src/
├── components/
│   ├── Dashboard/
│   │   ├── MetricsOverview.tsx
│   │   ├── RealtimeChart.tsx
│   │   └── AlertBanner.tsx
│   ├── Routes/
│   │   ├── RouteTable.tsx
│   │   ├── RouteForm.tsx
│   │   └── RouteTestModal.tsx
│   ├── Security/
│   │   ├── JWTSettings.tsx
│   │   ├── APIKeyManager.tsx
│   │   └── IPFilterList.tsx
│   ├── RateLimiting/
│   │   ├── RateLimitDashboard.tsx
│   │   └── RateLimitEventFeed.tsx
│   ├── Cache/
│   │   ├── CacheMetrics.tsx
│   │   └── CacheInspector.tsx
│   ├── Backends/
│   │   ├── BackendHealthGrid.tsx
│   │   └── CircuitBreakerControls.tsx
│   ├── Metrics/
│   │   ├── PrometheusCharts.tsx
│   │   └── MetricsExporter.tsx
│   ├── Logs/
│   │   ├── LogViewer.tsx
│   │   └── RequestDetailModal.tsx
│   ├── Config/
│   │   ├── ConfigEditor.tsx
│   │   └── ConfigHistory.tsx
│   ├── Playground/
│   │   └── APITester.tsx
│   └── Common/
│       ├── Navbar.tsx
│       ├── Sidebar.tsx
│       └── LoadingSpinner.tsx
├── lib/
│   ├── api/              # API client functions
│   ├── hooks/            # Custom React hooks
│   ├── schemas/          # Zod validation schemas
│   └── utils/            # Helper functions
├── pages/
│   ├── index.tsx         # Dashboard
│   ├── routes.tsx        # Route management
│   ├── security.tsx      # Security config
│   ├── rate-limits.tsx   # Rate limiting
│   ├── cache.tsx         # Cache management
│   ├── backends.tsx      # Backend health
│   ├── metrics.tsx       # Metrics & charts
│   ├── logs.tsx          # Request logs
│   ├── config.tsx        # Config editor
│   ├── playground.tsx    # API tester
│   └── api/              # Next.js API routes (BFF)
└── types/
    └── gateway.ts        # TypeScript types for gateway entities
```

### Data Flow & API Integration

#### Fetching Gateway Metrics
**Option 1:** Poll Admin API every 5 seconds
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['config'],
  queryFn: fetchGatewayConfig,
  refetchInterval: 5000 // auto-refresh
});
```

**Option 2:** WebSocket for real-time updates (requires gateway extension)
```typescript
const ws = new WebSocket('ws://gateway:8080/admin/stream');
ws.onmessage = (event) => {
  const metrics = JSON.parse(event.data);
  updateDashboard(metrics);
};
```

#### Parsing Prometheus Metrics
- Fetch `/metrics` endpoint (plain text format)
- Parse using regex or library (e.g., `prom-client` parser)
- Extract relevant metrics:
  - `gateway_http_requests_total`
  - `gateway_auth_success_total`
  - `gateway_rate_limit_hits_total`
  - etc.
- Transform into chart-friendly format

**Example Parser:**
```typescript
function parsePrometheusMetrics(text: string) {
  const lines = text.split('\n');
  const metrics: Record<string, number> = {};
  
  lines.forEach(line => {
    if (line.startsWith('#')) return; // skip comments
    const match = line.match(/^(\w+)(?:{.*?})?\s+([\d.]+)$/);
    if (match) {
      metrics[match[1]] = parseFloat(match[2]);
    }
  });
  
  return metrics;
}
```

### Deployment

#### Packaging
- Build Next.js app: `npm run build`
- Output: Static files + server bundle
- Serve via Node.js server or deploy to Vercel/Netlify

#### Docker Integration
Add to existing `docker-compose.yml`:
```yaml
gateway-ui:
  build: ./ui
  ports:
    - "3000:3000"
  environment:
    - GATEWAY_URL=http://api-gateway:8080
    - ADMIN_TOKEN=${ADMIN_TOKEN}
  depends_on:
    - api-gateway
```

#### Environment Variables for UI
```
GATEWAY_URL=http://api-gateway:8080  # Internal Docker network
ADMIN_TOKEN=<secret>                 # For BFF to call admin API
NEXT_PUBLIC_APP_NAME=API Gateway UI
NEXT_PUBLIC_REFRESH_INTERVAL=5000    # Dashboard refresh interval (ms)
```

## DELIVERABLES

### Phase 1: MVP (Core Functionality)
1. **Dashboard** with real-time metrics (request rate, status codes, auth stats)
2. **Route Management** (view, add, edit, delete routes)
3. **Security Config** (JWT settings, API keys, IP filtering)
4. **Cache Management** (stats, clear cache)
5. **Backend Health** (status grid, manual health checks)
6. **Basic Metrics** (charts from Prometheus)

**Estimated Effort:** 2-3 weeks (single developer)

### Phase 2: Advanced Features
1. **Rate Limiting Dashboard** with live event feed
2. **Request Tracing & Logs** with filtering and search
3. **Config Editor** with syntax highlighting and validation
4. **API Testing Playground**
5. **Advanced Metrics** (Grafana embedding or custom charts)

**Estimated Effort:** 2 weeks

### Phase 3: Polish & Production Readiness
1. **User authentication** for multi-admin support
2. **Audit logging** of admin actions
3. **Notification system** (email/webhook alerts)
4. **Dark mode** and accessibility improvements
5. **Comprehensive testing** (unit, integration, E2E)
6. **Documentation** (user guide, deployment guide)

**Estimated Effort:** 1-2 weeks

## TESTING CRITERIA

### Functional Tests
- [ ] Admin can view current gateway configuration
- [ ] Admin can add a new route and see it in the table
- [ ] Admin can edit an existing route and changes persist
- [ ] Admin can delete a route (with confirmation)
- [ ] Admin can clear cache and see confirmation
- [ ] Admin can reset rate limit for a specific IP
- [ ] Dashboard auto-refreshes every 5 seconds
- [ ] Charts update with new data without full page reload
- [ ] Backend health status updates in real-time
- [ ] API testing playground sends requests and displays responses
- [ ] Config editor validates JSON before save
- [ ] Error messages display when API calls fail
- [ ] Dark mode toggle persists across sessions
- [ ] Mobile layout is functional (responsive design)

### Integration Tests
- [ ] UI connects to gateway Admin API successfully
- [ ] All Admin API endpoints are covered by UI actions
- [ ] Prometheus metrics are fetched and parsed correctly
- [ ] WebSocket connection (if implemented) handles reconnects
- [ ] BFF layer correctly proxies requests with admin token
- [ ] CORS is configured to allow UI origin

### Performance Tests
- [ ] Initial page load < 2 seconds (on 3G network)
- [ ] Dashboard updates without jank (60 FPS)
- [ ] Route table with 1000+ routes renders smoothly
- [ ] Charts with 10K data points render in < 500ms
- [ ] No memory leaks after 1 hour of auto-refresh

### Security Tests
- [ ] Admin token is never exposed to browser client
- [ ] All forms sanitize inputs to prevent XSS
- [ ] CSRF tokens are validated on state-changing actions
- [ ] HTTPS is enforced in production build
- [ ] Sensitive config values are masked in UI (e.g., JWT secret)

### Accessibility Tests
- [ ] All interactive elements are keyboard-navigable
- [ ] ARIA labels are present on all icons and buttons
- [ ] Color contrast ratios meet WCAG AA
- [ ] Screen reader can navigate the app
- [ ] Focus indicators are visible

## PROFESSIONAL STANDARDS

### Code Quality
- Follow **Airbnb TypeScript Style Guide**
- ESLint + Prettier configured and enforced
- All components have PropTypes or TypeScript types
- No `any` types (use strict TypeScript)
- Maximum function complexity: 15 (configurable in ESLint)

### Documentation
- **README.md** with:
  - Setup instructions
  - Environment variables
  - Development workflow
  - Build and deployment steps
- **CONTRIBUTING.md** with code style guide
- Inline comments for complex logic
- JSDoc for public functions

### Git Workflow
- Feature branches: `feature/route-management`
- Commit messages: `feat: add route deletion confirmation`
- PR template with checklist

### CI/CD
- GitHub Actions workflow:
  - Lint and format check
  - Type check (TypeScript)
  - Run unit tests
  - Build production bundle
  - Deploy to staging (optional)

## SUCCESS METRICS

### User Experience
- Admin can complete common tasks (add route, clear cache, view metrics) in < 30 seconds
- 95% of users successfully navigate the UI without help documentation
- Task success rate > 90% in usability testing

### Performance
- Lighthouse score > 90 (Performance, Accessibility, Best Practices, SEO)
- Time to Interactive < 3 seconds
- Core Web Vitals pass (LCP < 2.5s, FID < 100ms, CLS < 0.1)

### Adoption
- UI is used for 100% of configuration changes (no manual JSON editing)
- Monitoring dashboard reduces time to detect issues by 50%
- Positive feedback from at least 80% of users

## ADDITIONAL CONSIDERATIONS

### Internationalization (i18n)
If future requirement, structure for easy translation:
- Use `react-i18next` library
- Extract all user-facing strings to JSON files
- Support English (default), plan for Spanish, French, German

### Multi-Tenancy
If gateway will support multiple organizations:
- Add organization selector in UI
- Filter data by organization context
- Ensure isolation of sensitive data (configs, logs)

### High Availability
- UI should handle gateway restarts gracefully
- Show "Gateway Unreachable" banner with auto-retry
- Maintain local state for unsaved changes

### Future Extensions
- **Plugins Management:** If gateway supports plugins, add plugin marketplace UI
- **GraphQL Support:** If gateway adds GraphQL, include schema browser
- **Advanced Analytics:** Anomaly detection, predictive alerts
- **Collaboration Features:** Comments on routes, change approval workflow

---

## FINAL NOTES

This is an **enterprise-grade project** requiring attention to detail, security, and user experience. The UI should feel as polished as commercial API gateway products (Kong, Apigee) while being tailored to this specific C++ gateway's capabilities.

**Prioritize:**
1. **Security** -- No exposure of admin tokens, proper authentication
2. **Reliability** -- Graceful error handling, no data loss
3. **Usability** -- Intuitive navigation, clear feedback, minimal clicks
4. **Performance** -- Fast load times, smooth interactions
5. **Maintainability** -- Clean code, good documentation, testable

**Avoid:**
- Over-engineering (don't build features not explicitly required)
- Tight coupling (UI should work even if gateway changes slightly)
- Hardcoded values (use env vars and config files)
- Ignoring edge cases (network failures, malformed data, etc.)

**References:**
- Gateway documentation: `/mnt/user-data/uploads/README.md`
- Kong Admin UI: https://github.com/Kong/kong-manager
- AWS API Gateway Console: https://aws.amazon.com/api-gateway/
- Prometheus metrics format: https://prometheus.io/docs/concepts/data_model/

Good luck building a world-class API Gateway UI! 🚀
