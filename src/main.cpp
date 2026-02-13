#include <iostream>
#include <csignal>
#include <cstdlib>
#include <memory>
#include "server/HttpServer.h"
#include "auth/JWTManager.h"
#include "rate_limiter/RateLimiter.h"
#include "router/Router.h"
#include "security/SecurityValidator.h"
#include "logging/Logger.h"
#include "config/ConfigManager.h"
#include <nlohmann/json.hpp>

using namespace gateway;
using json = nlohmann::json;

std::shared_ptr<HttpServer> g_server;

void signalHandler(int signal) {
    if (g_server) {
        std::cout << "\nShutting down API Gateway...\n";
        g_server->stop();
        exit(0);
    }
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
        auto jwt_manager = std::make_shared<JWTManager>(jwt_secret, jwt_issuer, jwt_audience);
        std::cout << "  ✓ JWT Manager initialized\n";

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

        std::cout << "  ✓ Security Validator initialized\n";

        // HTTP Server
        auto server = std::make_shared<HttpServer>(host, port, max_connections);
        server->initialize(jwt_manager, rate_limiter, router, security_validator, logger);

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
            return 1;
        }

    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << "\n";
        return 1;
    }

    return 0;
}
