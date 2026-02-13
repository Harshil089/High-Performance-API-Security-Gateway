#include "Router.h"
#include <nlohmann/json.hpp>
#include <fstream>
#include <iostream>
#include <random>

namespace gateway {

using json = nlohmann::json;

Router::Router() {}

void Router::addRoute(const Route& route) {
    Route r = route;
    r.path_regex = patternToRegex(route.path_pattern);
    routes_.push_back(r);
}

std::optional<RouteMatch> Router::matchRoute(const std::string& path) {
    for (const auto& route : routes_) {
        std::smatch match;
        if (std::regex_match(path, match, route.path_regex)) {
            RouteMatch result;
            result.route = &route;
            result.matched_path = path;
            result.rewritten_path = rewritePath(path, route);

            // Select backend if not an internal handler
            if (route.handler.empty() && !route.backends.empty()) {
                result.backend_url = selectBackend(route);
            }

            return result;
        }
    }
    return std::nullopt;
}

int Router::loadRoutes(const std::string& routes_json) {
    try {
        json config = json::parse(routes_json);

        if (!config.contains("routes") || !config["routes"].is_array()) {
            std::cerr << "Invalid routes configuration\n";
            return 0;
        }

        int count = 0;
        for (const auto& route_json : config["routes"]) {
            Route route;

            route.path_pattern = route_json.value("path", "");
            route.timeout_ms = route_json.value("timeout", 5000);
            route.require_auth = route_json.value("require_auth", false);
            route.strip_prefix = route_json.value("strip_prefix", "");
            route.handler = route_json.value("handler", "");
            route.load_balancing = route_json.value("load_balancing", "round_robin");

            // Handle single backend or multiple backends
            if (route_json.contains("backend")) {
                route.backends.push_back(route_json["backend"]);
            } else if (route_json.contains("backends") && route_json["backends"].is_array()) {
                for (const auto& backend : route_json["backends"]) {
                    route.backends.push_back(backend);
                }
            }

            if (!route.path_pattern.empty()) {
                addRoute(route);
                count++;
            }
        }

        return count;

    } catch (const std::exception& e) {
        std::cerr << "Error loading routes: " << e.what() << "\n";
        return 0;
    }
}

std::regex Router::patternToRegex(const std::string& pattern) {
    std::string regex_pattern = pattern;

    // Escape special regex characters except *
    std::string special_chars = ".^$+?()[]{}|\\";
    for (char c : special_chars) {
        std::string from(1, c);
        std::string to = "\\" + from;
        size_t pos = 0;
        while ((pos = regex_pattern.find(from, pos)) != std::string::npos) {
            regex_pattern.replace(pos, 1, to);
            pos += to.length();
        }
    }

    // Convert trailing /* to optional match: (/.*)?
    // This allows /api/users/* to match both /api/users and /api/users/123
    if (regex_pattern.size() >= 2 &&
        regex_pattern.substr(regex_pattern.size() - 2) == "/*") {
        regex_pattern = regex_pattern.substr(0, regex_pattern.size() - 2) + "(/.*)?";
    }

    // Convert remaining * to .*
    size_t pos = 0;
    while ((pos = regex_pattern.find("*", pos)) != std::string::npos) {
        regex_pattern.replace(pos, 1, ".*");
        pos += 2;
    }

    return std::regex(regex_pattern);
}

std::string Router::selectBackend(const Route& route) {
    if (route.backends.empty()) {
        return "";
    }

    if (route.backends.size() == 1) {
        return route.backends[0];
    }

    if (route.load_balancing == "round_robin") {
        // Round-robin selection
        std::string key = route.path_pattern;
        size_t& index = backend_indices_[key];
        std::string backend = route.backends[index % route.backends.size()];
        index++;
        return backend;
    } else if (route.load_balancing == "random") {
        // Random selection
        static std::random_device rd;
        static std::mt19937 gen(rd());
        std::uniform_int_distribution<> dis(0, route.backends.size() - 1);
        return route.backends[dis(gen)];
    }

    // Default to first backend
    return route.backends[0];
}

std::string Router::rewritePath(const std::string& original_path, const Route& route) {
    std::string path = original_path;

    // Strip prefix if configured
    if (!route.strip_prefix.empty()) {
        if (path.find(route.strip_prefix) == 0) {
            path = path.substr(route.strip_prefix.length());
        }
    }

    // Ensure path starts with /
    if (path.empty() || path[0] != '/') {
        path = "/" + path;
    }

    return path;
}

} // namespace gateway
