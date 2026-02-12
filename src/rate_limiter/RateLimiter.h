#pragma once

#include <string>
#include <map>
#include <mutex>
#include <chrono>
#include <memory>
#include <thread>

namespace gateway {

/**
 * @brief Token bucket for rate limiting
 */
struct TokenBucket {
    int capacity;           // Maximum tokens
    double tokens;          // Current tokens (double for fractional refill)
    int refill_rate;        // Tokens per second
    std::chrono::steady_clock::time_point last_refill;
    std::mutex mtx;         // Thread safety

    TokenBucket(int cap, int rate)
        : capacity(cap)
        , tokens(cap)
        , refill_rate(rate)
        , last_refill(std::chrono::steady_clock::now()) {}
};

/**
 * @brief Rate limit configuration
 */
struct RateLimitConfig {
    int requests;           // Number of requests allowed
    int window;             // Time window in seconds
};

/**
 * @brief Rate Limiter using Token Bucket algorithm
 *
 * Supports:
 * - Per-IP rate limiting
 * - Per-endpoint rate limiting
 * - Global rate limiting
 * - Thread-safe operations
 * - Automatic cleanup of old entries
 */
class RateLimiter {
public:
    /**
     * @brief Constructor
     * @param cleanup_interval_seconds Interval to cleanup old buckets
     */
    explicit RateLimiter(int cleanup_interval_seconds = 300);

    /**
     * @brief Destructor
     */
    ~RateLimiter();

    /**
     * @brief Configure global rate limit
     * @param requests Number of requests
     * @param window Time window in seconds
     */
    void setGlobalLimit(int requests, int window);

    /**
     * @brief Configure per-IP rate limit
     * @param requests Number of requests
     * @param window Time window in seconds
     */
    void setPerIPLimit(int requests, int window);

    /**
     * @brief Configure endpoint-specific rate limit
     * @param endpoint Endpoint path
     * @param requests Number of requests
     * @param window Time window in seconds
     */
    void setEndpointLimit(const std::string& endpoint, int requests, int window);

    /**
     * @brief Check if request is allowed
     * @param client_ip Client IP address
     * @param endpoint Request endpoint
     * @param tokens_required Number of tokens to consume (default 1)
     * @return Pair of (allowed, retry_after_seconds)
     */
    std::pair<bool, int> allowRequest(
        const std::string& client_ip,
        const std::string& endpoint,
        int tokens_required = 1
    );

    /**
     * @brief Get remaining tokens for client
     * @param client_ip Client IP address
     * @param endpoint Request endpoint
     * @return Number of remaining tokens
     */
    int getRemainingTokens(const std::string& client_ip, const std::string& endpoint);

    /**
     * @brief Reset bucket for client (for testing)
     * @param client_ip Client IP address
     */
    void resetBucket(const std::string& client_ip);

private:
    std::map<std::string, std::shared_ptr<TokenBucket>> ip_buckets_;
    std::map<std::string, std::shared_ptr<TokenBucket>> endpoint_buckets_;
    std::shared_ptr<TokenBucket> global_bucket_;

    std::mutex buckets_mutex_;

    RateLimitConfig global_config_;
    RateLimitConfig per_ip_config_;
    std::map<std::string, RateLimitConfig> endpoint_configs_;

    bool cleanup_running_;
    std::thread cleanup_thread_;
    int cleanup_interval_seconds_;

    /**
     * @brief Get or create bucket for key
     */
    std::shared_ptr<TokenBucket> getBucket(
        std::map<std::string, std::shared_ptr<TokenBucket>>& buckets,
        const std::string& key,
        const RateLimitConfig& config
    );

    /**
     * @brief Refill bucket based on elapsed time
     */
    void refillBucket(TokenBucket& bucket, const RateLimitConfig& config);

    /**
     * @brief Try to consume tokens from bucket
     */
    bool consumeTokens(TokenBucket& bucket, int tokens);

    /**
     * @brief Cleanup old buckets periodically
     */
    void cleanupOldBuckets();

    /**
     * @brief Calculate retry-after seconds
     */
    int calculateRetryAfter(TokenBucket& bucket, const RateLimitConfig& config);
};

} // namespace gateway
