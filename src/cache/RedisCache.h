#pragma once

#include <string>
#include <memory>
#include <optional>
#include <sw/redis++/redis++.h>

namespace gateway {

/**
 * @brief Redis-backed response cache with TTL support
 *
 * Caches HTTP responses in Redis to reduce backend load
 */
class RedisCache {
public:
    struct CachedResponse {
        std::string body;
        std::string content_type;
        int status_code;
        long long cached_at;  // Unix timestamp in milliseconds
    };

    /**
     * @brief Construct Redis cache
     * @param redis_uri Redis connection string (e.g., "tcp://127.0.0.1:6379")
     * @param key_prefix Prefix for all cache keys (default: "cache:")
     */
    explicit RedisCache(const std::string& redis_uri, const std::string& password = "",
                        const std::string& key_prefix = "cache:");

    ~RedisCache() = default;

    /**
     * @brief Get cached response
     * @param key Cache key (usually method + path + query)
     * @return Cached response if found, std::nullopt otherwise
     */
    std::optional<CachedResponse> get(const std::string& key);

    /**
     * @brief Store response in cache
     * @param key Cache key
     * @param response Response to cache
     * @param ttl_seconds Time to live in seconds
     */
    void set(const std::string& key, const CachedResponse& response, int ttl_seconds);

    /**
     * @brief Invalidate cache entry
     * @param key Cache key to invalidate
     */
    void invalidate(const std::string& key);

    /**
     * @brief Invalidate all cache entries matching pattern
     * @param pattern Redis key pattern (e.g., "cache:GET:/api/users/*")
     */
    void invalidatePattern(const std::string& pattern);

    /**
     * @brief Clear all cached entries
     */
    void clear();

    /**
     * @brief Check if Redis connection is healthy
     */
    bool isConnected();

    /**
     * @brief Get cache statistics
     */
    struct Stats {
        long long total_keys;
        long long memory_usage;  // in bytes
    };
    Stats getStats();

private:
    std::unique_ptr<sw::redis::Redis> redis_;
    std::string key_prefix_;

    std::string getFullKey(const std::string& key) const;
    std::string serializeResponse(const CachedResponse& response);
    std::optional<CachedResponse> deserializeResponse(const std::string& data);
};

} // namespace gateway
