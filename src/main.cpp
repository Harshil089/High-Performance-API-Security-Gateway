#include <iostream>
#include <fstream>
#include <csignal>
#include <cstdlib>
#include <memory>
#include <thread>
#include <atomic>
#include "server/HttpServer.h"
#include "auth/JWTManager.h"
#include "rate_limiter/RateLimiter.h"
#include "router/Router.h"
#include "router/ProxyManager.h"
#include "security/SecurityValidator.h"
#include "logging/Logger.h"
#include "config/ConfigManager.h"
#include "admin/AdminAPI.h"
#ifdef REDIS_AVAILABLE
#include "cache/RedisCache.h"
#include "rate_limiter/RedisRateLimiter.h"
#endif
#include <nlohmann/json.hpp>

using namespace gateway;
using json = nlohmann::json;

std::shared_ptr<HttpServer> g_server;
std::atomic<bool> g_running{true};

void signalHandler(int signal) {
    g_running = false;
    if (g_server) {
        std::cout << "\nShutting down API Gateway...\n";
        g_server->stop();
    }
}

// Helper: get env var as string, return default if not set
static std::string getEnv(const char* name, const std::string& default_val = "") {
    const char* val = std::getenv(name);
    return val ? std::string(val) : default_val;
}

// Helper: get env var as bool ("true" / "1")
static bool getEnvBool(const char* name, bool default_val = false) {
    const char* val = std::getenv(name);
    if (!val) return default_val;
    std::string s(val);
    return s == "true" || s == "1";
}

void printBanner() {
    std::cout << R"(
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        High-Performance API Gateway in C++                   ║
║        Enterprise-Grade Security & Performance               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
)" << "\n";
}

int main(int argc, char* argv[]) {
    printBanner();

    // Parse command line arguments
    std::string config_file = "config/gateway.json";
    std::string routes_file = "config/routes.json";

    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--config" && i + 1 < argc) {
            config_file = argv[++i];
        } else if (arg == "--routes" && i + 1 < argc) {
            routes_file = argv[++i];
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: " << argv[0] << " [options]\n"
                      << "Options:\n"
                      << "  --config <file>  Path to gateway config (default: config/gateway.json)\n"
                      << "  --routes <file>  Path to routes config (default: config/routes.json)\n"
                      << "  --help, -h       Show this help message\n";
            return 0;
        }
    }

    try {
        // Load configuration
        json config;
        if (!ConfigManager::loadConfig(config_file, config)) {
            std::cerr << "Failed to load configuration from " << config_file << "\n";
            return 1;
        }

        json routes_config;
        if (!ConfigManager::loadRoutes(routes_file, routes_config)) {
            std::cerr << "Failed to load routes from " << routes_file << "\n";
            return 1;
        }

        // ── Environment variable overrides ───────────────────────────
        if (getEnvBool("ADMIN_ENABLED")) {
            config["admin"]["enabled"] = true;
        }
        if (getEnvBool("REDIS_ENABLED")) {
            config["redis"]["enabled"] = true;
        }
        if (getEnvBool("CACHE_ENABLED")) {
            config["cache"]["enabled"] = true;
        }
        // Redis host/port from env (Docker networking)
        std::string redis_host = getEnv("REDIS_HOST");
        std::string redis_port = getEnv("REDIS_PORT", "6379");
        if (!redis_host.empty()) {
            config["redis"]["uri"] = "tcp://" + redis_host + ":" + redis_port;
        }
        std::string redis_password = getEnv("REDIS_PASSWORD");
        if (!redis_password.empty()) {
            config["redis"]["password"] = redis_password;
        }

        // Extract configuration values
        std::string host = config["server"]["host"].get<std::string>();
        int port = config["server"]["port"].get<int>();
        int max_connections = config["server"]["max_connections"].get<int>();

        // JWT configuration - validate critical security settings
        std::string jwt_secret = config["jwt"]["secret"].get<std::string>();
        if (jwt_secret.empty()) {
            std::cerr << "SECURITY ERROR: JWT_SECRET not configured\n";
            std::cerr << "Set JWT_SECRET environment variable with a secure random key (min 32 characters)\n";
            return 1;
        }

        if (jwt_secret.length() < 32) {
            std::cerr << "SECURITY ERROR: JWT_SECRET must be at least 32 characters long\n";
            std::cerr << "Current length: " << jwt_secret.length() << " characters\n";
            return 1;
        }

        // Warn about insecure default secrets
        if (jwt_secret.find("test") != std::string::npos ||
            jwt_secret.find("demo") != std::string::npos ||
            jwt_secret.find("example") != std::string::npos) {
            std::cerr << "WARNING: JWT_SECRET appears to be a test/demo value\n";
            std::cerr << "This is INSECURE for production use. Generate a secure random secret.\n";
        }

        std::string jwt_issuer = config["jwt"]["issuer"].get<std::string>();
        std::string jwt_audience = config["jwt"]["audience"].get<std::string>();
        int access_token_expiry = config["jwt"]["access_token_expiry"].get<int>();
        (void)access_token_expiry; // used by auth service, not gateway directly

        // Validate JWT configuration
        if (jwt_issuer.empty() || jwt_audience.empty()) {
            std::cerr << "SECURITY ERROR: JWT issuer and audience must be configured\n";
            return 1;
        }

        // Rate limiting configuration
        auto rate_limits = config["rate_limits"];

        // Security configuration
        size_t max_header_size = config["security"]["max_header_size"].get<size_t>();
        int max_body_size = config["server"]["max_body_size"].get<int>();

        // Logging configuration
        std::string log_file = config["logging"]["file"].get<std::string>();
        size_t max_log_size = config["logging"]["max_file_size"].get<size_t>();
        size_t max_log_files = config["logging"]["max_files"].get<size_t>();
        bool async_logging = config["logging"]["async"].get<bool>();

        std::cout << "Configuration loaded successfully\n";
        std::cout << "  Host: " << host << "\n";
        std::cout << "  Port: " << port << "\n";
        std::cout << "  Max Connections: " << max_connections << "\n\n";

        // Initialize components
        std::cout << "Initializing components...\n";

        // Logger
        auto logger = std::make_shared<Logger>(log_file, max_log_size, max_log_files, async_logging);
        std::cout << "  ✓ Logger initialized\n";

        // JWT Manager
        std::string jwt_algorithm_str = config["jwt"].value("algorithm", std::string("HS256"));
        JWTManager::Algorithm jwt_algo = JWTManager::Algorithm::HS256;
        std::string public_key_pem, private_key_pem;

        if (jwt_algorithm_str == "RS256") {
            jwt_algo = JWTManager::Algorithm::RS256;
            std::string pub_key_file = config["jwt"].value("public_key_file", std::string(""));
            std::string priv_key_file = config["jwt"].value("private_key_file", std::string(""));

            if (!pub_key_file.empty()) {
                std::ifstream pub_f(pub_key_file);
                if (pub_f.is_open()) {
                    public_key_pem = std::string(std::istreambuf_iterator<char>(pub_f), {});
                    std::cout << "  ✓ RS256 public key loaded from " << pub_key_file << "\n";
                } else {
                    std::cerr << "ERROR: Cannot open RS256 public key file: " << pub_key_file << "\n";
                    return 1;
                }
            }
            if (!priv_key_file.empty()) {
                std::ifstream priv_f(priv_key_file);
                if (priv_f.is_open()) {
                    private_key_pem = std::string(std::istreambuf_iterator<char>(priv_f), {});
                    std::cout << "  ✓ RS256 private key loaded\n";
                }
            }
        }

        auto jwt_manager = std::make_shared<JWTManager>(
            jwt_secret, jwt_issuer, jwt_audience, jwt_algo, public_key_pem, private_key_pem);
        std::cout << "  ✓ JWT Manager initialized (" << jwt_algorithm_str << ")\n";

        // Rate Limiter
        auto rate_limiter = std::make_shared<RateLimiter>();

        if (rate_limits.contains("global")) {
            rate_limiter->setGlobalLimit(
                rate_limits["global"]["requests"].get<int>(),
                rate_limits["global"]["window"].get<int>()
            );
        }

        if (rate_limits.contains("per_ip")) {
            rate_limiter->setPerIPLimit(
                rate_limits["per_ip"]["requests"].get<int>(),
                rate_limits["per_ip"]["window"].get<int>()
            );
        }

        if (rate_limits.contains("endpoints") && rate_limits["endpoints"].is_object()) {
            for (auto& [endpoint, limit] : rate_limits["endpoints"].items()) {
                rate_limiter->setEndpointLimit(
                    endpoint,
                    limit["requests"].get<int>(),
                    limit["window"].get<int>()
                );
            }
        }

        std::cout << "  ✓ Rate Limiter initialized\n";

        // Router
        auto router = std::make_shared<Router>();
        int routes_loaded = router->loadRoutes(routes_config.dump());
        std::cout << "  ✓ Router initialized (" << routes_loaded << " routes loaded)\n";

        // Security Validator
        auto security_validator = std::make_shared<SecurityValidator>(max_header_size, max_body_size);

        if (config["security"].contains("allowed_methods")) {
            std::vector<std::string> allowed_methods = config["security"]["allowed_methods"];
            security_validator->setAllowedMethods(allowed_methods);
        }

        if (rate_limits.contains("per_ip_connections")) {
            security_validator->setMaxConnectionsPerIP(
                rate_limits["per_ip_connections"].get<int>()
            );
        }

        // IP whitelist / blacklist
        if (config["security"].contains("ip_whitelist") && config["security"]["ip_whitelist"].is_array()) {
            std::vector<std::string> whitelist = config["security"]["ip_whitelist"];
            if (!whitelist.empty()) {
                security_validator->setIPWhitelist(whitelist);
                std::cout << "  ✓ IP whitelist configured (" << whitelist.size() << " IPs)\n";
            }
        }
        if (config["security"].contains("ip_blacklist") && config["security"]["ip_blacklist"].is_array()) {
            std::vector<std::string> blacklist = config["security"]["ip_blacklist"];
            if (!blacklist.empty()) {
                security_validator->setIPBlacklist(blacklist);
                std::cout << "  ✓ IP blacklist configured (" << blacklist.size() << " IPs)\n";
            }
        }

        // API keys
        if (config["security"].contains("api_keys") && config["security"]["api_keys"].is_object()) {
            std::map<std::string, std::string> api_keys;
            for (auto& [key, val] : config["security"]["api_keys"].items()) {
                api_keys[key] = val.get<std::string>();
            }
            if (!api_keys.empty()) {
                security_validator->setAPIKeys(api_keys);
                std::cout << "  ✓ API key authentication configured (" << api_keys.size() << " keys)\n";
            }
        }

        std::cout << "  ✓ Security Validator initialized\n";

        // ── ProxyManager (shared, preserves circuit breaker state) ───
        int cb_failure_threshold = 5;
        int cb_recovery_timeout = 60;
        if (config.contains("backends") && config["backends"].contains("circuit_breaker")) {
            cb_failure_threshold = config["backends"]["circuit_breaker"].value("failure_threshold", 5);
            cb_recovery_timeout = config["backends"]["circuit_breaker"].value("recovery_timeout", 60);
        }
        auto proxy_manager = std::make_shared<ProxyManager>(cb_failure_threshold, cb_recovery_timeout);
        std::cout << "  ✓ Proxy Manager initialized (circuit breaker: threshold="
                  << cb_failure_threshold << ", recovery=" << cb_recovery_timeout << "s)\n";

        // HTTP Server
        auto server = std::make_shared<HttpServer>(host, port, max_connections);

        // ── Admin API — register BEFORE initialize() so routes are added
        //    before the catch-all ".*" handler ─────────────────────────
        std::shared_ptr<AdminAPI> admin_api;
        bool admin_enabled = config.contains("admin") && config["admin"].value("enabled", false);
        std::string admin_token = config.contains("admin") ? config["admin"].value("token", std::string("")) : "";
        std::string env_admin_token = getEnv("ADMIN_TOKEN");
        if (!env_admin_token.empty()) {
            admin_token = env_admin_token;
        }

        if (admin_enabled && !admin_token.empty()) {
            admin_api = std::make_shared<AdminAPI>();
            admin_api->registerEndpoints(server->getInternalServer(), admin_token);
            admin_api->setCurrentConfig(config);

            // Wire rate limit reset callback
            admin_api->setRateLimitResetCallback([rate_limiter](const std::string& key) {
                (void)rate_limiter;
                (void)key;
                std::cout << "Admin: Rate limit reset requested for key: " << key << std::endl;
            });

            std::cout << "  ✓ Admin API enabled at /admin/*\n";
        } else {
            std::cout << "  - Admin API disabled\n";
        }

        // Now register catch-all handlers (must come AFTER admin routes)
        server->initialize(jwt_manager, rate_limiter, router, security_validator, logger, proxy_manager);

        // ── Redis Cache + Distributed Rate Limiter (Task 3) ──────────
#ifdef REDIS_AVAILABLE
        bool redis_enabled = config.contains("redis") && config["redis"].value("enabled", false);
        bool cache_enabled = config.contains("cache") && config["cache"].value("enabled", false);

        if (redis_enabled) {
            std::string redis_uri = config["redis"].value("uri", std::string("tcp://127.0.0.1:6379"));
            std::string redis_pass = config["redis"].value("password", std::string(""));

            try {
                if (cache_enabled) {
                    int cache_ttl = config.contains("cache") ? config["cache"].value("default_ttl", 300) : 300;
                    auto redis_cache = std::make_shared<RedisCache>(redis_uri, redis_pass);

                    // Wire cache into HttpServer via function callbacks
                    server->setCache(
                        [redis_cache](const std::string& key) -> std::optional<HttpServer::CachedResponse> {
                            auto cached = redis_cache->get(key);
                            if (cached) {
                                HttpServer::CachedResponse resp;
                                resp.body = cached->body;
                                resp.content_type = cached->content_type;
                                resp.status_code = cached->status_code;
                                return resp;
                            }
                            return std::nullopt;
                        },
                        [redis_cache](const std::string& key, const HttpServer::CachedResponse& resp, int ttl) {
                            RedisCache::CachedResponse cr;
                            cr.body = resp.body;
                            cr.content_type = resp.content_type;
                            cr.status_code = resp.status_code;
                            cr.cached_at = 0;
                            redis_cache->set(key, cr, ttl);
                        },
                        cache_ttl
                    );

                    // Wire cache stats to Admin API
                    if (admin_api) {
                        admin_api->setCacheStatsCallback([redis_cache]() -> nlohmann::json {
                            auto stats = redis_cache->getStats();
                            return nlohmann::json{
                                {"total_keys", stats.total_keys},
                                {"memory_usage_bytes", stats.memory_usage},
                                {"connected", redis_cache->isConnected()}
                            };
                        });
                    }

                    std::cout << "  ✓ Redis Cache enabled (TTL=" << cache_ttl << "s)\n";
                }

                auto redis_rate_limiter = std::make_shared<RedisRateLimiter>(redis_uri, redis_pass);
                std::cout << "  ✓ Redis Rate Limiter connected\n";

                // Wire rate limit reset to Admin API
                if (admin_api) {
                    admin_api->setRateLimitResetCallback([redis_rate_limiter](const std::string& key) {
                        redis_rate_limiter->resetKey(key);
                        std::cout << "Admin: Rate limit reset for key: " << key << std::endl;
                    });
                }

            } catch (const std::exception& e) {
                std::cerr << "  ✗ Redis connection failed: " << e.what() << "\n";
                std::cerr << "    Continuing without Redis (using in-memory rate limiting)\n";
            }
        } else {
            std::cout << "  - Redis disabled\n";
        }
#else
        std::cout << "  - Redis support not compiled in\n";
#endif

        // Configure security headers
        if (config["security"].contains("headers")) {
            std::map<std::string, std::string> security_headers;
            for (auto it = config["security"]["headers"].items().begin();
                 it != config["security"]["headers"].items().end(); ++it) {
                std::string key = it.key();
                auto value = it.value();

                // Convert snake_case to Header-Case
                std::string header_name = key;
                for (size_t i = 0; i < header_name.length(); i++) {
                    if (header_name[i] == '_') {
                        header_name[i] = '-';
                        if (i + 1 < header_name.length()) {
                            header_name[i + 1] = toupper(header_name[i + 1]);
                        }
                    } else if (i == 0) {
                        header_name[i] = toupper(header_name[i]);
                    }
                }
                security_headers[header_name] = value.get<std::string>();
            }
            server->setSecurityHeaders(security_headers);
            std::cout << "  ✓ Security headers configured (" << security_headers.size() << " headers)\n";
        }

        // Configure CORS
        if (config["security"]["cors"]["enabled"].get<bool>()) {
            std::cout << "  ✓ CORS enabled\n";
        }

        // Enable TLS if configured
        if (config["server"]["tls"]["enabled"].get<bool>()) {
            std::string cert_file = config["server"]["tls"]["cert_file"].get<std::string>();
            std::string key_file = config["server"]["tls"]["key_file"].get<std::string>();
            server->enableTLS(cert_file, key_file);
            std::cout << "  ✓ TLS/SSL enabled\n";
        }

        std::cout << "  ✓ HTTP Server initialized\n\n";

        // Setup signal handlers
        std::signal(SIGINT, signalHandler);
        std::signal(SIGTERM, signalHandler);

        g_server = server;

        // ── Background health check thread ───────────────────────────
        int health_check_interval = config.contains("backends") ? config["backends"].value("health_check_interval", 10) : 10;
        auto backend_urls = router->getAllBackendUrls();

        std::thread health_thread([proxy_manager, backend_urls, health_check_interval, logger]() {
            std::cout << "Health checker: monitoring " << backend_urls.size() << " backends every "
                      << health_check_interval << "s\n";
            while (g_running) {
                for (const auto& url : backend_urls) {
                    if (!g_running) break;
                    bool healthy = proxy_manager->performHealthCheck(url);
                    if (!healthy) {
                        logger->warn("Health check failed for backend: " + url);
                    }
                }
                for (int i = 0; i < health_check_interval && g_running; ++i) {
                    std::this_thread::sleep_for(std::chrono::seconds(1));
                }
            }
        });
        health_thread.detach();

        // Start server
        std::cout << "╔═══════════════════════════════════════════════════════════════╗\n";
        std::cout << "║  API Gateway is running on " << host << ":" << port << std::string(28 - host.length() - std::to_string(port).length(), ' ') << "║\n";
        std::cout << "║  Press Ctrl+C to stop                                        ║\n";
        std::cout << "╚═══════════════════════════════════════════════════════════════╝\n\n";

        logger->info("API Gateway started", {
            {"host", host},
            {"port", port}
        });

        if (!server->start()) {
            std::cerr << "Failed to start server\n";
            g_running = false;
            return 1;
        }

    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << "\n";
        g_running = false;
        return 1;
    }

    return 0;
}
