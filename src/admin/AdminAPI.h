#pragma once

#include <string>
#include <functional>
#include <map>
#include <httplib.h>
#include <nlohmann/json.hpp>

namespace gateway {

/**
 * @brief Admin API for runtime configuration and management
 *
 * Provides endpoints for:
 * - Viewing current configuration
 * - Updating rate limits
 * - Managing cache
 * - Viewing metrics
 * - Health checks
 */
class AdminAPI {
public:
    using ConfigUpdateCallback = std::function<void(const nlohmann::json&)>;

    AdminAPI() = default;
    ~AdminAPI() = default;

    /**
     * @brief Register admin endpoints with HTTP server
     * @param server HTTP server instance
     * @param admin_token Bearer token required for admin endpoints
     */
    void registerEndpoints(httplib::Server& server, const std::string& admin_token);

    /**
     * @brief Set callback for configuration updates
     */
    void setConfigUpdateCallback(ConfigUpdateCallback callback) {
        config_update_callback_ = callback;
    }

    /**
     * @brief Set current configuration (for GET /admin/config)
     */
    void setCurrentConfig(const nlohmann::json& config) {
        current_config_ = config;
    }

    /**
     * @brief Set cache statistics callback
     */
    using CacheStatsCallback = std::function<nlohmann::json()>;
    void setCacheStatsCallback(CacheStatsCallback callback) {
        cache_stats_callback_ = callback;
    }

    /**
     * @brief Set rate limit reset callback
     */
    using RateLimitResetCallback = std::function<void(const std::string&)>;
    void setRateLimitResetCallback(RateLimitResetCallback callback) {
        rate_limit_reset_callback_ = callback;
    }

private:
    std::string admin_token_;
    nlohmann::json current_config_;
    ConfigUpdateCallback config_update_callback_;
    CacheStatsCallback cache_stats_callback_;
    RateLimitResetCallback rate_limit_reset_callback_;

    /**
     * @brief Verify admin token
     */
    bool verifyAdminToken(const httplib::Request& req);

    /**
     * @brief Send JSON response
     */
    void sendJSON(httplib::Response& res, int status, const nlohmann::json& data);

    /**
     * @brief Send error response
     */
    void sendError(httplib::Response& res, int status, const std::string& message);

    // Admin endpoint handlers
    void handleGetConfig(const httplib::Request& req, httplib::Response& res);
    void handleUpdateConfig(const httplib::Request& req, httplib::Response& res);
    void handleGetCacheStats(const httplib::Request& req, httplib::Response& res);
    void handleClearCache(const httplib::Request& req, httplib::Response& res);
    void handleResetRateLimit(const httplib::Request& req, httplib::Response& res);
    void handleReloadConfig(const httplib::Request& req, httplib::Response& res);
};

} // namespace gateway
