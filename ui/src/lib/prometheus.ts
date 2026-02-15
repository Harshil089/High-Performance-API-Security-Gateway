import { PrometheusMetric, MetricsSummary, BackendHealth } from "@/types/gateway";

/**
 * Parse Prometheus text format metrics into structured data
 */
export function parsePrometheusMetrics(text: string): PrometheusMetric[] {
  const metrics: PrometheusMetric[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || !line.trim()) continue;

    try {
      // Parse: metric_name{labels} value
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*?)(?:\{(.*?)\})?\s+([0-9.eE+-]+)$/);

      if (match) {
        const [, name, labelsStr, valueStr] = match;
        const labels: Record<string, string> = {};

        if (labelsStr) {
          // Parse labels: key="value",key2="value2"
          const labelMatches = labelsStr.matchAll(/(\w+)="([^"]*)"/g);
          for (const [, key, value] of labelMatches) {
            labels[key] = value;
          }
        }

        metrics.push({
          name,
          labels,
          value: parseFloat(valueStr),
        });
      }
    } catch (error) {
      console.warn(`Failed to parse metric line: ${line}`, error);
    }
  }

  return metrics;
}

/**
 * Get metric value by name and optional labels
 */
export function getMetricValue(
  metrics: PrometheusMetric[],
  name: string,
  labels?: Record<string, string>
): number {
  const metric = metrics.find((m) => {
    if (m.name !== name) return false;

    if (!labels) return true;

    return Object.entries(labels).every(
      ([key, value]) => m.labels[key] === value
    );
  });

  return metric?.value ?? 0;
}

/**
 * Sum all metrics matching a name pattern
 */
export function sumMetrics(
  metrics: PrometheusMetric[],
  namePattern: string | RegExp
): number {
  const pattern = typeof namePattern === "string"
    ? new RegExp(`^${namePattern}$`)
    : namePattern;

  return metrics
    .filter((m) => pattern.test(m.name))
    .reduce((sum, m) => sum + m.value, 0);
}

/**
 * Get all unique label values for a metric
 */
export function getLabelValues(
  metrics: PrometheusMetric[],
  metricName: string,
  labelKey: string
): string[] {
  const values = new Set<string>();

  metrics
    .filter((m) => m.name === metricName)
    .forEach((m) => {
      if (m.labels[labelKey]) {
        values.add(m.labels[labelKey]);
      }
    });

  return Array.from(values);
}

/**
 * Calculate metrics summary for dashboard
 */
export function calculateMetricsSummary(metricsText: string): MetricsSummary {
  const metrics = parsePrometheusMetrics(metricsText);

  // Total requests
  const totalRequests = getMetricValue(metrics, "gateway_requests_total");

  // Request rate (requests per second) - calculate from counter difference
  // For now, we'll just show the total. In production, calculate delta over time.
  const requestRate = 0; // Would need historical data

  // Active connections
  const activeConnections = getMetricValue(metrics, "gateway_active_connections");

  // Auth success rate
  const authSuccess = getMetricValue(metrics, "gateway_auth_success_total");
  const authFailure = getMetricValue(metrics, "gateway_auth_failure_total");
  const authTotal = authSuccess + authFailure;
  const authSuccessRate = authTotal > 0 ? (authSuccess / authTotal) * 100 : 0;

  // Cache hit rate
  const cacheHits = getMetricValue(metrics, "gateway_cache_hits_total");
  const cacheMisses = getMetricValue(metrics, "gateway_cache_misses_total");
  const cacheTotal = cacheHits + cacheMisses;
  const cacheHitRate = cacheTotal > 0 ? (cacheHits / cacheTotal) * 100 : 0;

  // Status codes
  const status2xx = sumMetrics(metrics, /^gateway_requests_total\{.*status="2\d\d".*\}$/);
  const status4xx = sumMetrics(metrics, /^gateway_requests_total\{.*status="4\d\d".*\}$/);
  const status5xx = sumMetrics(metrics, /^gateway_requests_total\{.*status="5\d\d".*\}$/);

  // Backend health
  const backendUrls = getLabelValues(metrics, "gateway_backend_errors_total", "backend");
  const backends: BackendHealth[] = backendUrls.map((url) => {
    const errorCount = getMetricValue(
      metrics,
      "gateway_backend_errors_total",
      { backend: url }
    );
    const latency = getMetricValue(
      metrics,
      "gateway_backend_latency_seconds",
      { backend: url }
    );

    return {
      url,
      healthy: errorCount < 5, // Consider unhealthy if > 5 errors
      errorCount,
      latency: latency > 0 ? latency * 1000 : undefined, // Convert to ms
    };
  });

  return {
    totalRequests,
    requestRate,
    activeConnections,
    authSuccessRate,
    cacheHitRate,
    statusCodes: {
      "2xx": status2xx,
      "4xx": status4xx,
      "5xx": status5xx,
    },
    backends,
  };
}
