// Gateway Configuration Types
export interface GatewayConfig {
  server: ServerConfig;
  jwt: JWTConfig;
  rate_limits: RateLimitConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  backends: BackendConfig;
  redis: RedisConfig;
  cache: CacheConfig;
  metrics: MetricsConfig;
  admin: AdminConfig;
  websocket: WebSocketConfig;
}

export interface ServerConfig {
  host: string;
  port: number;
  tls: {
    enabled: boolean;
    cert_file: string;
    key_file: string;
  };
  max_connections: number;
  connection_timeout: number;
  request_timeout: number;
  max_body_size: number;
}

export interface JWTConfig {
  algorithm: "HS256" | "RS256";
  secret: string;
  issuer: string;
  audience: string;
  access_token_expiry: number;
  refresh_token_expiry: number;
  public_key_file: string;
  private_key_file: string;
}

export interface RateLimitConfig {
  global: {
    requests: number;
    window: number;
  };
  per_ip: {
    requests: number;
    window: number;
  };
  per_ip_connections: number;
  endpoints: Record<string, {
    requests: number;
    window: number;
  }>;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
  file: string;
  max_file_size: number;
  max_files: number;
  async: boolean;
}

export interface SecurityConfig {
  max_header_size: number;
  allowed_methods: string[];
  cors: CORSConfig;
  headers: SecurityHeaders;
  ip_whitelist: string[];
  ip_blacklist: string[];
  api_keys: Record<string, APIKey>;
}

export interface CORSConfig {
  enabled: boolean;
  allowed_origins: string[];
  allowed_headers: string[];
  allowed_methods: string[];
  max_age: number;
  allow_credentials: boolean;
}

export interface SecurityHeaders {
  x_frame_options: string;
  x_content_type_options: string;
  x_xss_protection: string;
  referrer_policy: string;
}

export interface APIKey {
  name: string;
  key: string;
  permissions: string[];
  rate_limit?: {
    requests: number;
    window: number;
  };
}

export interface BackendConfig {
  health_check_interval: number;
  health_check_timeout: number;
  circuit_breaker: {
    failure_threshold: number;
    recovery_timeout: number;
    half_open_requests: number;
  };
}

export interface RedisConfig {
  enabled: boolean;
  uri: string;
  password: string;
  db: number;
  connection_pool_size: number;
}

export interface CacheConfig {
  enabled: boolean;
  backend: "redis" | "memory";
  default_ttl: number;
  max_entry_size: number;
  cacheable_methods: string[];
  cacheable_status_codes: number[];
  exclude_paths: string[];
  cache_control_respect: boolean;
}

export interface MetricsConfig {
  enabled: boolean;
  port: number;
  path: string;
}

export interface AdminConfig {
  enabled: boolean;
  token: string;
  allowed_ips: string[];
}

export interface WebSocketConfig {
  enabled: boolean;
  max_connections: number;
  ping_interval: number;
  ping_timeout: number;
}

// Route Configuration Types
export interface RouteConfig {
  path: string;
  backend?: string;
  backends?: string[];
  load_balancing?: "round_robin" | "least_connections" | "random";
  rewrite?: string;
  timeout: number;
  require_auth: boolean;
  strip_prefix?: string;
  handler?: string;
}

export interface RoutesConfig {
  routes: RouteConfig[];
}

// Metrics Types
export interface PrometheusMetric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface MetricsSummary {
  totalRequests: number;
  requestRate: number;
  activeConnections: number;
  authSuccessRate: number;
  cacheHitRate: number;
  statusCodes: {
    "2xx": number;
    "4xx": number;
    "5xx": number;
  };
  backends: BackendHealth[];
}

export interface BackendHealth {
  url: string;
  healthy: boolean;
  errorCount: number;
  latency?: number;
}

// Cache Statistics
export interface CacheStats {
  total_entries: number;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  memory_usage: number;
  eviction_count: number;
}

// Admin API Response Types
export interface AdminResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  timestamp?: number;
}
