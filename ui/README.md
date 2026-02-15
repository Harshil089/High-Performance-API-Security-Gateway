# API Gateway Admin UI

A modern, production-ready admin interface for the High-Performance API Security Gateway.

## Features

- **Real-time Dashboard** - Monitor gateway metrics with auto-refresh
- **Route Management** - Configure API routes and backends visually
- **Security Settings** - Manage JWT, API keys, IP filtering, and CORS
- **Cache Management** - View stats and control cache operations
- **Rate Limiting** - Configure and monitor rate limits
- **Backend Health** - Monitor backend service health and performance

## Technology Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first styling
- **Shadcn/UI** - High-quality UI components
- **TanStack Query** - Server state management with auto-refresh
- **Recharts** - Data visualization
- **Monaco Editor** - Code editing for JSON configuration

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Running API Gateway on `http://localhost:8080`
- Admin token from gateway configuration

### Installation

```bash
npm install
```

### Configuration

Create a `.env.local` file (or copy from `.env.local.example`):

```env
GATEWAY_URL=http://localhost:8080
ADMIN_TOKEN=your-admin-token-here
NEXT_PUBLIC_REFRESH_INTERVAL=5000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Architecture

### Backend-for-Frontend (BFF) Pattern

For security, the admin token is **never exposed to the browser**. All admin API calls go through Next.js API routes (`/api/*`) that add the `Authorization: Bearer <token>` header server-side.

```
Browser → Next.js API Route (adds token) → Gateway Admin API
```

### API Routes

- `/api/config` - Get/update gateway configuration
- `/api/cache/stats` - Get cache statistics
- `/api/cache/clear` - Clear cache
- `/api/ratelimit/reset` - Reset rate limit for a key
- `/api/metrics` - Get Prometheus metrics

### Auto-refresh

Metrics and dashboard data automatically refresh every 5 seconds (configurable via `NEXT_PUBLIC_REFRESH_INTERVAL`).

## Project Structure

```
ui/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/          # BFF proxy routes
│   │   ├── page.tsx      # Dashboard page
│   │   └── layout.tsx    # Root layout
│   ├── components/       # React components
│   │   ├── dashboard/    # Dashboard components
│   │   ├── ui/           # Shadcn UI components
│   │   └── providers/    # Context providers
│   ├── lib/              # Utilities and helpers
│   │   ├── api/          # API client
│   │   ├── hooks/        # React Query hooks
│   │   └── prometheus.ts # Metrics parser
│   └── types/            # TypeScript types
├── public/               # Static assets
└── package.json
```

## Development Tips

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Adding New Features

1. **New API endpoint**: Create route in `src/app/api/`
2. **New page**: Create file in `src/app/`
3. **Data fetching**: Add hook in `src/lib/hooks/`
4. **UI component**: Add to `src/components/`

## Docker Deployment

Build the Docker image:

```bash
docker build -t api-gateway-ui .
```

Run with docker-compose (see main project `docker-compose.yml`):

```bash
docker compose up gateway-ui
```

## Security Considerations

- **Admin token** is stored server-side only (never exposed to client)
- All admin operations require authentication via BFF layer
- CORS is configured to only allow requests from the UI origin
- No sensitive data is logged to the browser console

## Troubleshooting

### Cannot connect to gateway

- Ensure the gateway is running on the configured `GATEWAY_URL`
- Check that `ADMIN_TOKEN` matches the gateway configuration
- Verify network connectivity between UI and gateway

### Metrics not loading

- Check that `/metrics` endpoint is accessible on the gateway
- Verify the Prometheus format is correctly parsed
- Check browser console for errors

### Configuration updates not working

- Ensure admin API is enabled in gateway config
- Verify the admin token is correct
- Check gateway logs for authorization errors

## License

Same as the parent API Gateway project.
