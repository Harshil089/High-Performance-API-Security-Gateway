#pragma once

#include <string>
#include <memory>
#include <functional>
#include <map>
#include <optional>
#include <httplib.h>
#include "../auth/JWTManager.h"
#include "../rate_limiter/RateLimiter.h"
#include "../router/Router.h"
#include "../security/SecurityValidator.h"
#include "../logging/Logger.h"
#include "../metrics/SimpleMetrics.h"
#include "../router/ProxyManager.h"

namespace gateway {

class AdminAPI;

/**
 * @brief Main HTTP server handling incoming requests
 *
 * Implements HTTP/1.1 server with support for:
 * - Concurrent connection handling
 * - Request parsing and validation
 * - Authentication and authorization
 * - Rate limiting
 * - Request routing and proxying
 */
class HttpServer {
public:
    /**
     * @brief Constructor
     * @param host Server host address
     * @param port Server port
     * @param max_connections Maximum concurrent connections
     */
    HttpServer(const std::string& host, int port, int max_connections = 1000);

    /**
     * @brief Destructor
     */
    ~HttpServer();

    /**
     * @brief Initialize server components
     * @param jwt_manager JWT authentication manager
     * @param rate_limiter Rate limiter instance
     * @param router Request router
     * @param security_validator Security validator
     * @param logger Logger instance
     */
    void initialize(
        std::shared_ptr<JWTManager> jwt_manager,
        std::shared_ptr<RateLimiter> rate_limiter,
        std::shared_ptr<Router> router,
        std::shared_ptr<SecurityValidator> security_validator,
        std::shared_ptr<Logger> logger,
        std::shared_ptr<ProxyManager> proxy_manager
    );

    /**
     * @brief Get reference to internal httplib server (for admin endpoint registration)
     */
    httplib::Server& getInternalServer() { return *server_; }

    /**
     * @brief Start the server (blocking)
     * @return true if server started successfully
     */
    bool start();

    /**
     * @brief Stop the server
     */
    void stop();

    /**
     * @brief Enable TLS/SSL
     * @param cert_file Path to certificate file
     * @param key_file Path to private key file
     */
    void enableTLS(const std::string& cert_file, const std::string& key_file);

    /**
     * @brief Set security headers configuration
     * @param headers Map of security headers to add to responses
     */
    void setSecurityHeaders(const std::map<std::string, std::string>& headers);

    struct CachedResponse {
        std::string body;
        std::string content_type;
        int status_code;
    };
    using CacheGetFn = std::function<std::optional<CachedResponse>(const std::string& key)>;
    using CacheSetFn = std::function<void(const std::string& key, const CachedResponse& resp, int ttl)>;

    void setCache(CacheGetFn get_fn, CacheSetFn set_fn, int default_ttl = 300) {
        cache_get_ = std::move(get_fn);
        cache_set_ = std::move(set_fn);
        cache_ttl_ = default_ttl;
    }

private:
    std::string host_;
    int port_;
    int max_connections_;

    std::unique_ptr<httplib::Server> server_;
    std::shared_ptr<JWTManager> jwt_manager_;
    std::shared_ptr<RateLimiter> rate_limiter_;
    std::shared_ptr<Router> router_;
    std::shared_ptr<SecurityValidator> security_validator_;
    std::shared_ptr<Logger> logger_;
    std::shared_ptr<SimpleMetrics> metrics_;
    std::shared_ptr<ProxyManager> proxy_manager_;

    bool tls_enabled_;
    std::string cert_file_;
    std::string key_file_;

    std::map<std::string, std::string> security_headers_;

    CacheGetFn cache_get_;
    CacheSetFn cache_set_;
    int cache_ttl_ = 300;

    /**
     * @brief Setup request handlers
     */
    void setupHandlers();

    /**
     * @brief Add security headers to response
     */
    void addSecurityHeaders(httplib::Response& res);

    /**
     * @brief Main request handler
     */
    void handleRequest(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Health check endpoint handler
     */
    void handleHealthCheck(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Metrics endpoint handler
     */
    void handleMetrics(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Extract client IP from request
     */
    std::string getClientIP(const httplib::Request& req);

    /**
     * @brief Validate JWT token from Authorization header
     */
    bool validateAuth(const httplib::Request& req, std::string& user_id);

    /**
     * @brief Generate request ID for tracing
     */
    std::string generateRequestId();

    /**
     * @brief Log request details
     */
    void logRequest(
        const std::string& request_id,
        const std::string& client_ip,
        const std::string& method,
        const std::string& path,
        int status,
        long response_time_ms,
        const std::string& user_id = "",
        const std::string& backend = "",
        const std::string& error = ""
    );
};

} // namespace gateway
