#pragma once

#include <string>
#include <map>
#include <memory>
#include <chrono>
#include <atomic>
#include <mutex>

namespace gateway {

/**
 * @brief Backend health status
 */
enum class HealthStatus {
    HEALTHY,
    UNHEALTHY,
    UNKNOWN
};

/**
 * @brief Circuit breaker state
 */
enum class CircuitState {
    CLOSED,      // Normal operation
    OPEN,        // Failing, reject requests
    HALF_OPEN    // Testing if recovered
};

/**
 * @brief Backend health info
 */
struct BackendHealth {
    HealthStatus status;
    CircuitState circuit_state;
    int failure_count;
    std::chrono::steady_clock::time_point last_check;
    std::chrono::steady_clock::time_point circuit_opened_at;
    std::mutex mtx;

    BackendHealth()
        : status(HealthStatus::UNKNOWN)
        , circuit_state(CircuitState::CLOSED)
        , failure_count(0)
        , last_check(std::chrono::steady_clock::now())
        , circuit_opened_at(std::chrono::steady_clock::now()) {}
};

/**
 * @brief Proxy response
 */
struct ProxyResponse {
    int status_code;
    std::map<std::string, std::string> headers;
    std::string body;
    bool success;
    std::string error;
    long response_time_ms;

    ProxyResponse() : status_code(0), success(false), response_time_ms(0) {}
};

/**
 * @brief Proxy Manager for forwarding requests to backends
 *
 * Features:
 * - HTTP client for backend requests
 * - Connection pooling
 * - Health checks
 * - Circuit breaker pattern
 * - Timeout handling
 */
class ProxyManager {
public:
    /**
     * @brief Constructor
     * @param failure_threshold Failures before opening circuit
     * @param recovery_timeout Seconds before attempting recovery
     */
    ProxyManager(int failure_threshold = 5, int recovery_timeout = 60);

    /**
     * @brief Forward request to backend
     * @param method HTTP method
     * @param backend_url Backend URL
     * @param path Request path
     * @param headers Request headers
     * @param body Request body
     * @param timeout_ms Timeout in milliseconds
     * @return Proxy response
     */
    ProxyResponse forwardRequest(
        const std::string& method,
        const std::string& backend_url,
        const std::string& path,
        const std::map<std::string, std::string>& headers,
        const std::string& body,
        int timeout_ms = 5000
    );

    /**
     * @brief Check backend health
     * @param backend_url Backend URL
     * @return true if healthy
     */
    bool isHealthy(const std::string& backend_url);

    /**
     * @brief Perform health check on backend
     * @param backend_url Backend URL
     * @return true if health check passed
     */
    bool performHealthCheck(const std::string& backend_url);

    /**
     * @brief Get circuit state for backend
     */
    CircuitState getCircuitState(const std::string& backend_url);

private:
    std::map<std::string, std::shared_ptr<BackendHealth>> backend_health_;
    std::mutex health_mutex_;

    int failure_threshold_;
    int recovery_timeout_;

    /**
     * @brief Get or create health info for backend
     */
    std::shared_ptr<BackendHealth> getBackendHealth(const std::string& backend_url);

    /**
     * @brief Record successful request
     */
    void recordSuccess(const std::string& backend_url);

    /**
     * @brief Record failed request
     */
    void recordFailure(const std::string& backend_url);

    /**
     * @brief Check if circuit should be half-opened
     */
    bool shouldAttemptRecovery(const BackendHealth& health);

    /**
     * @brief Make HTTP request to backend
     */
    ProxyResponse makeRequest(
        const std::string& method,
        const std::string& url,
        const std::string& path,
        const std::map<std::string, std::string>& headers,
        const std::string& body,
        int timeout_ms
    );
};

} // namespace gateway
