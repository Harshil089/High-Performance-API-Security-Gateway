#pragma once

#include <string>
#include <vector>
#include <memory>
#include <regex>
#include <optional>

namespace gateway {

/**
 * @brief Route configuration
 */
struct Route {
    std::string path_pattern;       // e.g., "/api/users/*"
    std::regex path_regex;          // Compiled regex for matching
    std::vector<std::string> backends;  // Backend URLs
    std::string load_balancing;     // "round_robin", "random", "least_conn"
    int timeout_ms;                 // Request timeout
    bool require_auth;              // Require authentication
    std::string strip_prefix;       // Prefix to strip from path
    std::string handler;            // Internal handler (e.g., "health_check")

    Route() : timeout_ms(5000), require_auth(false) {}
};

/**
 * @brief Route match result
 */
struct RouteMatch {
    const Route* route;
    std::string matched_path;
    std::string rewritten_path;
    std::string backend_url;
};

/**
 * @brief Request Router
 *
 * Features:
 * - Pattern-based routing with wildcards
 * - Load balancing (round-robin, random)
 * - Path rewriting
 * - Internal handlers (health checks)
 */
class Router {
public:
    /**
     * @brief Constructor
     */
    Router();

    /**
     * @brief Add route
     * @param route Route configuration
     */
    void addRoute(const Route& route);

    /**
     * @brief Find matching route for path
     * @param path Request path
     * @return Optional route match
     */
    std::optional<RouteMatch> matchRoute(const std::string& path);

    /**
     * @brief Load routes from configuration
     * @param routes_json JSON configuration
     * @return Number of routes loaded
     */
    int loadRoutes(const std::string& routes_json);

private:
    std::vector<Route> routes_;
    std::map<std::string, size_t> backend_indices_; // For round-robin

    /**
     * @brief Convert wildcard pattern to regex
     */
    std::regex patternToRegex(const std::string& pattern);

    /**
     * @brief Select backend using load balancing strategy
     */
    std::string selectBackend(const Route& route);

    /**
     * @brief Rewrite path according to route config
     */
    std::string rewritePath(const std::string& original_path, const Route& route);
};

} // namespace gateway
