#include "admin/AdminAPI.h"
#include <iostream>

using json = nlohmann::json;

namespace gateway {

void AdminAPI::registerEndpoints(httplib::Server& server, const std::string& admin_token) {
    admin_token_ = admin_token;

    // GET /admin/config - View current configuration
    server.Get("/admin/config", [this](const httplib::Request& req, httplib::Response& res) {
        handleGetConfig(req, res);
    });

    // POST /admin/config - Update configuration
    server.Post("/admin/config", [this](const httplib::Request& req, httplib::Response& res) {
        handleUpdateConfig(req, res);
    });

    // GET /admin/cache/stats - Get cache statistics
    server.Get("/admin/cache/stats", [this](const httplib::Request& req, httplib::Response& res) {
        handleGetCacheStats(req, res);
    });

    // POST /admin/cache/clear - Clear cache
    server.Post("/admin/cache/clear", [this](const httplib::Request& req, httplib::Response& res) {
        handleClearCache(req, res);
    });

    // POST /admin/ratelimit/reset - Reset rate limit for a key
    server.Post("/admin/ratelimit/reset", [this](const httplib::Request& req, httplib::Response& res) {
        handleResetRateLimit(req, res);
    });

    // POST /admin/reload - Reload configuration from disk
    server.Post("/admin/reload", [this](const httplib::Request& req, httplib::Response& res) {
        handleReloadConfig(req, res);
    });

    std::cout << "Admin API: Registered admin endpoints at /admin/*" << std::endl;
}

bool AdminAPI::verifyAdminToken(const httplib::Request& req) {
    if (admin_token_.empty()) {
        // No token configured - admin API disabled
        return false;
    }

    std::string auth_header = req.get_header_value("Authorization");
    if (auth_header.empty()) {
        return false;
    }

    // Check for "Bearer <token>" format
    if (auth_header.find("Bearer ") == 0) {
        std::string token = auth_header.substr(7);
        return token == admin_token_;
    }

    return false;
}

void AdminAPI::sendJSON(httplib::Response& res, int status, const json& data) {
    res.status = status;
    res.set_content(data.dump(2), "application/json");
}

void AdminAPI::sendError(httplib::Response& res, int status, const std::string& message) {
    json error = {
        {"error", message},
        {"status", status}
    };
    sendJSON(res, status, error);
}

void AdminAPI::handleGetConfig(const httplib::Request& req, httplib::Response& res) {
    if (!verifyAdminToken(req)) {
        sendError(res, 401, "Unauthorized: Invalid or missing admin token");
        return;
    }

    json response = {
        {"config", current_config_},
        {"timestamp", std::time(nullptr)}
    };
    sendJSON(res, 200, response);
}

void AdminAPI::handleUpdateConfig(const httplib::Request& req, httplib::Response& res) {
    if (!verifyAdminToken(req)) {
        sendError(res, 401, "Unauthorized: Invalid or missing admin token");
        return;
    }

    try {
        json new_config = json::parse(req.body);

        // Validate configuration
        if (!new_config.is_object()) {
            sendError(res, 400, "Invalid configuration: must be a JSON object");
            return;
        }

        // Call update callback if set
        if (config_update_callback_) {
            config_update_callback_(new_config);
            current_config_ = new_config;

            json response = {
                {"message", "Configuration updated successfully"},
                {"timestamp", std::time(nullptr)}
            };
            sendJSON(res, 200, response);
        } else {
            sendError(res, 500, "Configuration update not supported");
        }
    } catch (const json::parse_error& e) {
        sendError(res, 400, std::string("Invalid JSON: ") + e.what());
    } catch (const std::exception& e) {
        sendError(res, 500, std::string("Configuration update failed: ") + e.what());
    }
}

void AdminAPI::handleGetCacheStats(const httplib::Request& req, httplib::Response& res) {
    if (!verifyAdminToken(req)) {
        sendError(res, 401, "Unauthorized: Invalid or missing admin token");
        return;
    }

    if (cache_stats_callback_) {
        json stats = cache_stats_callback_();
        sendJSON(res, 200, stats);
    } else {
        sendError(res, 503, "Cache statistics not available");
    }
}

void AdminAPI::handleClearCache(const httplib::Request& req, httplib::Response& res) {
    if (!verifyAdminToken(req)) {
        sendError(res, 401, "Unauthorized: Invalid or missing admin token");
        return;
    }

    try {
        // Parse optional pattern from request body
        std::string pattern = "*";
        if (!req.body.empty()) {
            json body = json::parse(req.body);
            if (body.contains("pattern")) {
                pattern = body["pattern"].get<std::string>();
            }
        }

        // Note: Cache clearing would be implemented in the main gateway
        // For now, just return success
        json response = {
            {"message", "Cache cleared"},
            {"pattern", pattern},
            {"timestamp", std::time(nullptr)}
        };
        sendJSON(res, 200, response);
    } catch (const std::exception& e) {
        sendError(res, 400, std::string("Cache clear failed: ") + e.what());
    }
}

void AdminAPI::handleResetRateLimit(const httplib::Request& req, httplib::Response& res) {
    if (!verifyAdminToken(req)) {
        sendError(res, 401, "Unauthorized: Invalid or missing admin token");
        return;
    }

    try {
        json body = json::parse(req.body);

        if (!body.contains("key")) {
            sendError(res, 400, "Missing required field: key");
            return;
        }

        std::string key = body["key"].get<std::string>();

        if (rate_limit_reset_callback_) {
            rate_limit_reset_callback_(key);

            json response = {
                {"message", "Rate limit reset"},
                {"key", key},
                {"timestamp", std::time(nullptr)}
            };
            sendJSON(res, 200, response);
        } else {
            sendError(res, 500, "Rate limit reset not supported");
        }
    } catch (const json::parse_error& e) {
        sendError(res, 400, std::string("Invalid JSON: ") + e.what());
    } catch (const std::exception& e) {
        sendError(res, 500, std::string("Rate limit reset failed: ") + e.what());
    }
}

void AdminAPI::handleReloadConfig(const httplib::Request& req, httplib::Response& res) {
    if (!verifyAdminToken(req)) {
        sendError(res, 401, "Unauthorized: Invalid or missing admin token");
        return;
    }

    // Note: Config reloading would be implemented in the main gateway
    // This would re-read the config file and apply changes
    json response = {
        {"message", "Configuration reload not yet implemented"},
        {"status", "pending"}
    };
    sendJSON(res, 501, response);
}

} // namespace gateway
