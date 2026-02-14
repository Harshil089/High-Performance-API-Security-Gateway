#pragma once

#include <memory>
#include <string>
#include <prometheus/counter.h>
#include <prometheus/gauge.h>
#include <prometheus/histogram.h>
#include <prometheus/registry.h>
#include <prometheus/exposer.h>

namespace gateway {

/**
 * @brief Prometheus metrics collector for API Gateway
 *
 * Collects and exposes metrics in Prometheus format on /metrics endpoint
 */
class MetricsCollector {
public:
    /**
     * @brief Construct metrics collector
     * @param port Port to expose /metrics endpoint (default: 9090)
     */
    explicit MetricsCollector(int port = 9090);

    ~MetricsCollector() = default;

    // Request metrics
    void incrementRequests(const std::string& method, const std::string& path, int status_code);
    void recordRequestDuration(const std::string& method, const std::string& path, double duration_ms);

    // Authentication metrics
    void incrementAuthSuccess();
    void incrementAuthFailure(const std::string& reason);

    // Rate limiting metrics
    void incrementRateLimitHits(const std::string& key);
    void incrementRateLimitAllowed(const std::string& key);

    // Backend metrics
    void recordBackendLatency(const std::string& backend, double latency_ms);
    void incrementBackendErrors(const std::string& backend);
    void setBackendHealthy(const std::string& backend, bool healthy);

    // Cache metrics (for Redis cache)
    void incrementCacheHits();
    void incrementCacheMisses();
    void recordCacheLatency(double latency_ms);

    // System metrics
    void setActiveConnections(int count);
    void incrementTotalConnections();

    /**
     * @brief Get metrics registry for manual metric creation
     */
    std::shared_ptr<prometheus::Registry> getRegistry() { return registry_; }

private:
    std::shared_ptr<prometheus::Registry> registry_;
    std::unique_ptr<prometheus::Exposer> exposer_;

    // Request metrics
    prometheus::Family<prometheus::Counter>* requests_total_;
    prometheus::Family<prometheus::Histogram>* request_duration_;

    // Auth metrics
    prometheus::Counter* auth_success_;
    prometheus::Family<prometheus::Counter>* auth_failures_;

    // Rate limit metrics
    prometheus::Family<prometheus::Counter>* rate_limit_hits_;
    prometheus::Family<prometheus::Counter>* rate_limit_allowed_;

    // Backend metrics
    prometheus::Family<prometheus::Histogram>* backend_latency_;
    prometheus::Family<prometheus::Counter>* backend_errors_;
    prometheus::Family<prometheus::Gauge>* backend_health_;

    // Cache metrics
    prometheus::Counter* cache_hits_;
    prometheus::Counter* cache_misses_;
    prometheus::Histogram* cache_latency_;

    // System metrics
    prometheus::Gauge* active_connections_;
    prometheus::Counter* total_connections_;
};

} // namespace gateway
