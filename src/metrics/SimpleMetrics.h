#pragma once

#include <string>
#include <map>
#include <mutex>
#include <atomic>

namespace gateway {

/**
 * @brief Simple metrics collector without external dependencies
 * Exposes metrics in Prometheus text format
 */
class SimpleMetrics {
public:
    SimpleMetrics() = default;
    ~SimpleMetrics() = default;

    // Request metrics
    void incrementRequests(const std::string& method, const std::string& path, int status_code);
    void recordRequestDuration(const std::string& method, double duration_ms);

    // Authentication metrics
    void incrementAuthSuccess() { auth_success_++; }
    void incrementAuthFailure() { auth_failures_++; }

    // Rate limiting metrics
    void incrementRateLimitHits() { rate_limit_hits_++; }
    void incrementRateLimitAllowed() { rate_limit_allowed_++; }

    // Backend metrics
    void recordBackendLatency(const std::string& backend, double latency_ms);
    void incrementBackendErrors(const std::string& backend);

    // System metrics
    void setActiveConnections(int count) { active_connections_ = count; }
    void incrementTotalConnections() { total_connections_++; }

    /**
     * @brief Export metrics in Prometheus text format
     */
    std::string exportMetrics();

private:
    std::mutex mutex_;

    // Counters
    std::atomic<uint64_t> total_requests_{0};
    std::atomic<uint64_t> auth_success_{0};
    std::atomic<uint64_t> auth_failures_{0};
    std::atomic<uint64_t> rate_limit_hits_{0};
    std::atomic<uint64_t> rate_limit_allowed_{0};
    std::atomic<uint64_t> total_connections_{0};
    std::atomic<int> active_connections_{0};

    // Maps for labeled metrics
    struct RequestMetrics {
        uint64_t count = 0;
        double total_duration_ms = 0;
        double min_duration_ms = 0;
        double max_duration_ms = 0;
    };

    std::map<std::string, RequestMetrics> request_metrics_;  // key: "method:path:status"
    std::map<std::string, uint64_t> backend_errors_;  // key: backend_url
    std::map<std::string, double> backend_latency_;  // key: backend_url (avg)
};

} // namespace gateway
