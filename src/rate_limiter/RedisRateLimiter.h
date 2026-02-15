#pragma once

#include <string>
#include <memory>
#include <sw/redis++/redis++.h>

namespace gateway {

/**
 * @brief Redis-backed distributed rate limiter using sliding window algorithm
 *
 * This rate limiter can be shared across multiple gateway instances by storing
 * rate limit data in Redis. Uses sorted sets for accurate sliding window counting.
 */
class RedisRateLimiter {
public:
    /**
     * @brief Construct a new Redis Rate Limiter
     * @param redis_uri Redis connection string (e.g., "tcp://127.0.0.1:6379")
     * @param key_prefix Prefix for all Redis keys (default: "ratelimit:")
     */
    explicit RedisRateLimiter(const std::string& redis_uri, const std::string& password = "",
                              const std::string& key_prefix = "ratelimit:");

    ~RedisRateLimiter() = default;

    /**
     * @brief Check if request is allowed under rate limit
     * @param key Rate limit key (e.g., "ip:192.168.1.1" or "endpoint:/api/login")
     * @param max_requests Maximum requests allowed in window
     * @param window_seconds Time window in seconds
     * @return true if request is allowed, false if rate limited
     */
    bool allowRequest(const std::string& key, int max_requests, int window_seconds);

    /**
     * @brief Get current request count for a key
     * @param key Rate limit key
     * @param window_seconds Time window in seconds
     * @return Current number of requests in the window
     */
    int getCurrentCount(const std::string& key, int window_seconds);

    /**
     * @brief Reset rate limit for a specific key
     * @param key Rate limit key to reset
     */
    void resetKey(const std::string& key);

    /**
     * @brief Check if Redis connection is healthy
     * @return true if connected, false otherwise
     */
    bool isConnected();

private:
    std::unique_ptr<sw::redis::Redis> redis_;
    std::string key_prefix_;

    /**
     * @brief Get full Redis key with prefix
     */
    std::string getFullKey(const std::string& key) const;
};

} // namespace gateway
