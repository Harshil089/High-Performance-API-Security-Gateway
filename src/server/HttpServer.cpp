#include "HttpServer.h"
#include "Response.h"
#include "../router/ProxyManager.h"
#include <uuid/uuid.h>
#include <iostream>
#include <chrono>

namespace gateway {

HttpServer::HttpServer(const std::string& host, int port, int max_connections)
    : host_(host)
    , port_(port)
    , max_connections_(max_connections)
    , server_(new httplib::Server())
    , metrics_(std::make_shared<SimpleMetrics>())
    , tls_enabled_(false) {}

HttpServer::~HttpServer() {
    stop();
}

void HttpServer::initialize(
    std::shared_ptr<JWTManager> jwt_manager,
    std::shared_ptr<RateLimiter> rate_limiter,
    std::shared_ptr<Router> router,
    std::shared_ptr<SecurityValidator> security_validator,
    std::shared_ptr<Logger> logger,
    std::shared_ptr<ProxyManager> proxy_manager
) {
    jwt_manager_ = jwt_manager;
    rate_limiter_ = rate_limiter;
    router_ = router;
    security_validator_ = security_validator;
    logger_ = logger;
    proxy_manager_ = proxy_manager;

    setupHandlers();
}

bool HttpServer::start() {
    if (!server_) {
        return false;
    }

    logger_->info("Starting API Gateway", {
        {"host", host_},
        {"port", port_},
        {"tls_enabled", tls_enabled_}
    });

    return server_->listen(host_.c_str(), port_);
}

void HttpServer::stop() {
    if (server_) {
        server_->stop();
        logger_->info("API Gateway stopped");
    }
}

void HttpServer::enableTLS(const std::string& cert_file, const std::string& key_file) {
    tls_enabled_ = true;
    cert_file_ = cert_file;
    key_file_ = key_file;
}

void HttpServer::setSecurityHeaders(const std::map<std::string, std::string>& headers) {
    security_headers_ = headers;
}

void HttpServer::addSecurityHeaders(httplib::Response& res) {
    for (const auto& header_pair : security_headers_) {
        res.set_header(header_pair.first, header_pair.second);
    }
}

void HttpServer::setupHandlers() {
    // Health check endpoint
    server_->Get("/health", [this](const httplib::Request& req, httplib::Response& res) {
        handleHealthCheck(req, res);
    });

    // Metrics endpoint (Prometheus format)
    server_->Get("/metrics", [this](const httplib::Request& req, httplib::Response& res) {
        handleMetrics(req, res);
    });

    // Catch-all handler for all other requests
    server_->Get(".*", [this](const httplib::Request& req, httplib::Response& res) {
        handleRequest(req, res);
    });

    server_->Post(".*", [this](const httplib::Request& req, httplib::Response& res) {
        handleRequest(req, res);
    });

    server_->Put(".*", [this](const httplib::Request& req, httplib::Response& res) {
        handleRequest(req, res);
    });

    server_->Delete(".*", [this](const httplib::Request& req, httplib::Response& res) {
        handleRequest(req, res);
    });

    server_->Patch(".*", [this](const httplib::Request& req, httplib::Response& res) {
        handleRequest(req, res);
    });

    server_->Options(".*", [this](const httplib::Request& req, httplib::Response& res) {
        // Add security headers
        addSecurityHeaders(res);

        // CORS preflight - will be set by main.cpp based on config
        res.status = 204;
    });
}

void HttpServer::handleRequest(const httplib::Request& req, httplib::Response& res) {
    auto start_time = std::chrono::steady_clock::now();

    std::string request_id = generateRequestId();
    std::string client_ip = getClientIP(req);
    std::string user_id;

    // Add security headers to all responses
    addSecurityHeaders(res);

    // Add X-Request-ID to response
    res.set_header("X-Request-ID", request_id);

    // Skip processing if already handled (like /health, /metrics, /admin/*)
    if (req.path == "/health" || req.path == "/metrics" ||
        req.path.find("/admin/") == 0) {
        return;
    }

    // IP filtering — reject blacklisted / non-whitelisted IPs early
    if (!security_validator_->isIPAllowed(client_ip)) {
        res.status = StatusCode::FORBIDDEN;
        res.set_content(ResponseBuilder::errorJson("Access denied"), "application/json");

        auto end_time = std::chrono::steady_clock::now();
        auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time
        ).count();

        logRequest(request_id, client_ip, req.method, req.path, res.status,
                  response_time, user_id, "", "IP blocked");
        return;
    }

    // Validate HTTP method
    auto method_validation = security_validator_->validateMethod(req.method);
    if (!method_validation.valid) {
        res.status = StatusCode::METHOD_NOT_ALLOWED;
        res.set_content(ResponseBuilder::errorJson(method_validation.error), "application/json");

        auto end_time = std::chrono::steady_clock::now();
        auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time
        ).count();

        logRequest(request_id, client_ip, req.method, req.path, res.status,
                  response_time, user_id, "", method_validation.error);
        return;
    }

    // Validate path
    auto path_validation = security_validator_->validatePath(req.path);
    if (!path_validation.valid) {
        res.status = StatusCode::BAD_REQUEST;
        res.set_content(ResponseBuilder::errorJson(path_validation.error), "application/json");

        auto end_time = std::chrono::steady_clock::now();
        auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time
        ).count();

        logRequest(request_id, client_ip, req.method, req.path, res.status,
                  response_time, user_id, "", path_validation.error);
        return;
    }

    // Validate headers
    std::map<std::string, std::string> headers_map;
    for (const auto& header : req.headers) {
        headers_map[header.first] = header.second;
    }

    auto headers_validation = security_validator_->validateHeaders(headers_map);
    if (!headers_validation.valid) {
        res.status = StatusCode::BAD_REQUEST;
        res.set_content(ResponseBuilder::errorJson(headers_validation.error), "application/json");

        auto end_time = std::chrono::steady_clock::now();
        auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time
        ).count();

        logRequest(request_id, client_ip, req.method, req.path, res.status,
                  response_time, user_id, "", headers_validation.error);
        return;
    }

    // Validate body
    auto content_type = req.get_header_value("Content-Type");
    auto body_validation = security_validator_->validateBody(req.body, content_type);
    if (!body_validation.valid) {
        res.status = StatusCode::BAD_REQUEST;
        res.set_content(ResponseBuilder::errorJson(body_validation.error), "application/json");

        auto end_time = std::chrono::steady_clock::now();
        auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time
        ).count();

        logRequest(request_id, client_ip, req.method, req.path, res.status,
                  response_time, user_id, "", body_validation.error);
        return;
    }

    // Check rate limiting
    auto [allowed, retry_after] = rate_limiter_->allowRequest(client_ip, req.path);
    if (!allowed) {
        metrics_->incrementRateLimitHits();
        res.status = StatusCode::TOO_MANY_REQUESTS;
        res.set_header("Retry-After", std::to_string(retry_after));
        res.set_content(ResponseBuilder::errorJson("Rate limit exceeded"), "application/json");

        auto end_time = std::chrono::steady_clock::now();
        auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time
        ).count();

        metrics_->incrementRequests(req.method, req.path, res.status);
        logRequest(request_id, client_ip, req.method, req.path, res.status,
                  response_time, user_id, "", "Rate limit exceeded");
        return;
    }
    metrics_->incrementRateLimitAllowed();

    // Match route
    auto route_match = router_->matchRoute(req.path);
    if (!route_match.has_value()) {
        res.status = StatusCode::NOT_FOUND;
        res.set_content(ResponseBuilder::errorJson("Route not found"), "application/json");

        auto end_time = std::chrono::steady_clock::now();
        auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time
        ).count();

        logRequest(request_id, client_ip, req.method, req.path, res.status,
                  response_time, user_id, "", "Route not found");
        return;
    }

    auto& match = route_match.value();

    // Check authentication if required
    if (match.route->require_auth) {
        if (!validateAuth(req, user_id)) {
            metrics_->incrementAuthFailure();
            res.status = StatusCode::UNAUTHORIZED;
            res.set_content(ResponseBuilder::errorJson("Unauthorized"), "application/json");

            auto end_time = std::chrono::steady_clock::now();
            auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                end_time - start_time
            ).count();

            metrics_->incrementRequests(req.method, req.path, res.status);
            logRequest(request_id, client_ip, req.method, req.path, res.status,
                      response_time, user_id, "", "Unauthorized");
            return;
        }
        metrics_->incrementAuthSuccess();
    }

    // Forward request to backend
    if (!match.route->handler.empty()) {
        // Internal handler (already handled health check)
        res.status = StatusCode::NOT_FOUND;
        res.set_content(ResponseBuilder::errorJson("Handler not implemented"), "application/json");
        return;
    }

    // Check cache for GET requests
    std::string cache_key = req.method + ":" + req.path;
    if (req.method == "GET" && cache_get_) {
        auto cached = cache_get_(cache_key);
        if (cached) {
            res.status = cached->status_code;
            res.set_content(cached->body, cached->content_type.c_str());
            res.set_header("X-Cache", "HIT");

            auto end_time = std::chrono::steady_clock::now();
            auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                end_time - start_time
            ).count();

            metrics_->incrementRequests(req.method, req.path, res.status);
            metrics_->recordRequestDuration(req.method, static_cast<double>(response_time));
            logRequest(request_id, client_ip, req.method, req.path, res.status,
                      response_time, user_id, "cache", "");
            return;
        }
    }

    // Proxy to backend (use shared ProxyManager to preserve circuit breaker state)
    headers_map["X-Request-ID"] = request_id;
    auto proxy_response = proxy_manager_->forwardRequest(
        req.method,
        match.backend_url,
        match.rewritten_path,
        headers_map,
        req.body,
        match.route->timeout_ms
    );

    if (proxy_response.success) {
        res.status = proxy_response.status_code;
        res.body = proxy_response.body;

        for (const auto& [key, value] : proxy_response.headers) {
            res.set_header(key.c_str(), value.c_str());
        }

        // Store in cache for successful GET responses
        if (req.method == "GET" && cache_set_ && proxy_response.status_code == 200) {
            CachedResponse to_cache;
            to_cache.body = proxy_response.body;
            to_cache.content_type = "application/json";
            to_cache.status_code = proxy_response.status_code;
            cache_set_(cache_key, to_cache, cache_ttl_);
            res.set_header("X-Cache", "MISS");
        }
    } else {
        res.status = StatusCode::BAD_GATEWAY;
        res.set_content(ResponseBuilder::errorJson("Backend error: " + proxy_response.error),
                       "application/json");
        metrics_->incrementBackendErrors(match.backend_url);
    }

    // Log request and record metrics
    auto end_time = std::chrono::steady_clock::now();
    auto response_time = std::chrono::duration_cast<std::chrono::milliseconds>(
        end_time - start_time
    ).count();

    metrics_->incrementRequests(req.method, req.path, res.status);
    metrics_->recordRequestDuration(req.method, static_cast<double>(response_time));
    metrics_->recordBackendLatency(match.backend_url, static_cast<double>(response_time));

    logRequest(request_id, client_ip, req.method, req.path, res.status,
              response_time, user_id, match.backend_url,
              proxy_response.success ? "" : proxy_response.error);
}

void HttpServer::handleHealthCheck(const httplib::Request& req, httplib::Response& res) {
    // Add security headers
    addSecurityHeaders(res);

    // Get current timestamp
    auto now = std::chrono::system_clock::now();
    auto uptime = std::chrono::duration_cast<std::chrono::seconds>(
        now - std::chrono::system_clock::from_time_t(0)
    ).count();

    // Build health check response with more details
    std::string health_response = "{"
        "\"status\":\"healthy\","
        "\"service\":\"api-gateway\","
        "\"version\":\"1.0.0\","
        "\"timestamp\":" + std::to_string(uptime) + ","
        "\"components\":{"
            "\"jwt_manager\":\"healthy\","
            "\"rate_limiter\":\"healthy\","
            "\"router\":\"healthy\","
            "\"logger\":\"healthy\""
        "}"
    "}";

    res.status = 200;
    res.set_content(health_response, "application/json");
}

void HttpServer::handleMetrics(const httplib::Request& req, httplib::Response& res) {
    res.status = 200;
    res.set_content(metrics_->exportMetrics(), "text/plain; version=0.0.4; charset=utf-8");
}

std::string HttpServer::getClientIP(const httplib::Request& req) {
    // Check X-Forwarded-For header
    if (req.has_header("X-Forwarded-For")) {
        std::string xff = req.get_header_value("X-Forwarded-For");
        size_t comma_pos = xff.find(',');
        return (comma_pos != std::string::npos) ? xff.substr(0, comma_pos) : xff;
    }

    // Check X-Real-IP header
    if (req.has_header("X-Real-IP")) {
        return req.get_header_value("X-Real-IP");
    }

    // Use remote address
    return req.remote_addr;
}

bool HttpServer::validateAuth(const httplib::Request& req, std::string& user_id) {
    // Check API key first (X-API-Key header)
    if (req.has_header("X-API-Key")) {
        std::string api_key = req.get_header_value("X-API-Key");
        if (security_validator_->validateAPIKey(api_key)) {
            user_id = "api-key-user";
            return true;
        }
    }

    // Fall back to JWT Bearer token
    if (!req.has_header("Authorization")) {
        return false;
    }

    std::string auth_header = req.get_header_value("Authorization");

    if (auth_header.find("Bearer ") != 0) {
        return false;
    }

    std::string token = auth_header.substr(7);

    auto validation_result = jwt_manager_->validateToken(token);
    if (validation_result.is_valid) {
        user_id = validation_result.claims.user_id;
        return true;
    }

    return false;
}

std::string HttpServer::generateRequestId() {
    uuid_t uuid;
    uuid_generate(uuid);

    char uuid_str[37];
    uuid_unparse(uuid, uuid_str);

    return std::string(uuid_str);
}

void HttpServer::logRequest(
    const std::string& request_id,
    const std::string& client_ip,
    const std::string& method,
    const std::string& path,
    int status,
    long response_time_ms,
    const std::string& user_id,
    const std::string& backend,
    const std::string& error
) {
    logger_->logRequest(
        request_id,
        client_ip,
        method,
        path,
        status,
        response_time_ms,
        user_id,
        backend,
        error
    );
}

} // namespace gateway
