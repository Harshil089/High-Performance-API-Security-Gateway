#include "ProxyManager.h"
#include <httplib.h>
#include <iostream>

namespace gateway {

ProxyManager::ProxyManager(int failure_threshold, int recovery_timeout)
    : failure_threshold_(failure_threshold)
    , recovery_timeout_(recovery_timeout) {}

ProxyResponse ProxyManager::forwardRequest(
    const std::string& method,
    const std::string& backend_url,
    const std::string& path,
    const std::map<std::string, std::string>& headers,
    const std::string& body,
    int timeout_ms
) {
    auto health = getBackendHealth(backend_url);

    // Check circuit breaker
    {
        std::lock_guard<std::mutex> lock(health->mtx);

        if (health->circuit_state == CircuitState::OPEN) {
            // Check if we should attempt recovery
            if (shouldAttemptRecovery(*health)) {
                health->circuit_state = CircuitState::HALF_OPEN;
            } else {
                ProxyResponse response;
                response.status_code = 503;
                response.error = "Circuit breaker open";
                response.success = false;
                return response;
            }
        }
    }

    // Make request
    auto start_time = std::chrono::steady_clock::now();
    ProxyResponse response = makeRequest(method, backend_url, path, headers, body, timeout_ms);
    auto end_time = std::chrono::steady_clock::now();

    response.response_time_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        end_time - start_time
    ).count();

    // Update circuit breaker state
    if (response.success && response.status_code < 500) {
        recordSuccess(backend_url);
    } else {
        recordFailure(backend_url);
    }

    return response;
}

bool ProxyManager::isHealthy(const std::string& backend_url) {
    auto health = getBackendHealth(backend_url);
    std::lock_guard<std::mutex> lock(health->mtx);
    return health->status == HealthStatus::HEALTHY &&
           health->circuit_state == CircuitState::CLOSED;
}

bool ProxyManager::performHealthCheck(const std::string& backend_url) {
    try {
        // Extract host and port from URL
        std::string host;
        int port = 80;
        std::string url_copy = backend_url;

        // Remove protocol
        if (url_copy.find("http://") == 0) {
            url_copy = url_copy.substr(7);
        } else if (url_copy.find("https://") == 0) {
            url_copy = url_copy.substr(8);
            port = 443;
        }

        // Extract host and port
        size_t colon_pos = url_copy.find(':');
        size_t slash_pos = url_copy.find('/');

        if (colon_pos != std::string::npos && (slash_pos == std::string::npos || colon_pos < slash_pos)) {
            host = url_copy.substr(0, colon_pos);
            std::string port_str = (slash_pos != std::string::npos)
                ? url_copy.substr(colon_pos + 1, slash_pos - colon_pos - 1)
                : url_copy.substr(colon_pos + 1);
            port = std::stoi(port_str);
        } else {
            host = (slash_pos != std::string::npos) ? url_copy.substr(0, slash_pos) : url_copy;
        }

        httplib::Client client(host, port);
        client.set_connection_timeout(5, 0);
        client.set_read_timeout(5, 0);

        auto res = client.Head("/health");

        if (res && res->status >= 200 && res->status < 500) {
            auto health = getBackendHealth(backend_url);
            std::lock_guard<std::mutex> lock(health->mtx);
            health->status = HealthStatus::HEALTHY;
            health->last_check = std::chrono::steady_clock::now();
            return true;
        }

    } catch (const std::exception& e) {
        std::cerr << "Health check failed for " << backend_url << ": " << e.what() << "\n";
    }

    auto health = getBackendHealth(backend_url);
    std::lock_guard<std::mutex> lock(health->mtx);
    health->status = HealthStatus::UNHEALTHY;
    health->last_check = std::chrono::steady_clock::now();
    return false;
}

CircuitState ProxyManager::getCircuitState(const std::string& backend_url) {
    auto health = getBackendHealth(backend_url);
    std::lock_guard<std::mutex> lock(health->mtx);
    return health->circuit_state;
}

std::shared_ptr<BackendHealth> ProxyManager::getBackendHealth(const std::string& backend_url) {
    std::lock_guard<std::mutex> lock(health_mutex_);

    auto it = backend_health_.find(backend_url);
    if (it != backend_health_.end()) {
        return it->second;
    }

    // Create new health entry
    auto health = std::make_shared<BackendHealth>();
    backend_health_[backend_url] = health;
    return health;
}

void ProxyManager::recordSuccess(const std::string& backend_url) {
    auto health = getBackendHealth(backend_url);
    std::lock_guard<std::mutex> lock(health->mtx);

    health->failure_count = 0;
    health->status = HealthStatus::HEALTHY;

    if (health->circuit_state == CircuitState::HALF_OPEN) {
        health->circuit_state = CircuitState::CLOSED;
    }
}

void ProxyManager::recordFailure(const std::string& backend_url) {
    auto health = getBackendHealth(backend_url);
    std::lock_guard<std::mutex> lock(health->mtx);

    health->failure_count++;
    health->status = HealthStatus::UNHEALTHY;

    if (health->failure_count >= failure_threshold_) {
        health->circuit_state = CircuitState::OPEN;
        health->circuit_opened_at = std::chrono::steady_clock::now();
    }
}

bool ProxyManager::shouldAttemptRecovery(const BackendHealth& health) {
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
        now - health.circuit_opened_at
    ).count();

    return elapsed >= recovery_timeout_;
}

ProxyResponse ProxyManager::makeRequest(
    const std::string& method,
    const std::string& url,
    const std::string& path,
    const std::map<std::string, std::string>& headers,
    const std::string& body,
    int timeout_ms
) {
    ProxyResponse response;

    try {
        // Extract host and port from URL
        std::string host;
        int port = 80;
        std::string url_copy = url;

        // Remove protocol
        if (url_copy.find("http://") == 0) {
            url_copy = url_copy.substr(7);
        } else if (url_copy.find("https://") == 0) {
            url_copy = url_copy.substr(8);
            port = 443;
        }

        // Extract host and port
        size_t colon_pos = url_copy.find(':');
        size_t slash_pos = url_copy.find('/');

        if (colon_pos != std::string::npos && (slash_pos == std::string::npos || colon_pos < slash_pos)) {
            host = url_copy.substr(0, colon_pos);
            std::string port_str = (slash_pos != std::string::npos)
                ? url_copy.substr(colon_pos + 1, slash_pos - colon_pos - 1)
                : url_copy.substr(colon_pos + 1);
            port = std::stoi(port_str);
        } else {
            host = (slash_pos != std::string::npos) ? url_copy.substr(0, slash_pos) : url_copy;
        }

        httplib::Client client(host, port);
        client.set_connection_timeout(timeout_ms / 1000, (timeout_ms % 1000) * 1000);
        client.set_read_timeout(timeout_ms / 1000, (timeout_ms % 1000) * 1000);

        // Prepare headers
        httplib::Headers httplib_headers;
        for (const auto& [key, value] : headers) {
            if (key != "Host" && key != "Content-Length") {
                httplib_headers.insert({key, value});
            }
        }

        // Make request based on method
        httplib::Result res;

        if (method == "GET") {
            res = client.Get(path.c_str(), httplib_headers);
        } else if (method == "POST") {
            res = client.Post(path.c_str(), httplib_headers, body, "application/json");
        } else if (method == "PUT") {
            res = client.Put(path.c_str(), httplib_headers, body, "application/json");
        } else if (method == "DELETE") {
            res = client.Delete(path.c_str(), httplib_headers);
        } else if (method == "PATCH") {
            res = client.Patch(path.c_str(), httplib_headers, body, "application/json");
        } else {
            response.error = "Unsupported HTTP method: " + method;
            return response;
        }

        if (res) {
            response.success = true;
            response.status_code = res->status;
            response.body = res->body;

            for (const auto& header : res->headers) {
                response.headers[header.first] = header.second;
            }
        } else {
            response.error = "Request failed: " + httplib::to_string(res.error());
        }

    } catch (const std::exception& e) {
        response.error = "Exception during request: ";
        response.error += e.what();
    }

    return response;
}

} // namespace gateway
