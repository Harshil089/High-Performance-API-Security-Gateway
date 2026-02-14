#include "metrics/SimpleMetrics.h"
#include <sstream>
#include <iomanip>
#include <algorithm>

namespace gateway {

void SimpleMetrics::incrementRequests(const std::string& method, const std::string& path, int status_code) {
    total_requests_++;

    std::lock_guard<std::mutex> lock(mutex_);
    std::string key = method + ":" + path + ":" + std::to_string(status_code);
    request_metrics_[key].count++;
}

void SimpleMetrics::recordRequestDuration(const std::string& method, double duration_ms) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::string key = method;
    auto& metrics = request_metrics_[key];

    if (metrics.count == 0) {
        metrics.min_duration_ms = duration_ms;
        metrics.max_duration_ms = duration_ms;
    } else {
        metrics.min_duration_ms = std::min(metrics.min_duration_ms, duration_ms);
        metrics.max_duration_ms = std::max(metrics.max_duration_ms, duration_ms);
    }

    metrics.total_duration_ms += duration_ms;
    metrics.count++;
}

void SimpleMetrics::recordBackendLatency(const std::string& backend, double latency_ms) {
    std::lock_guard<std::mutex> lock(mutex_);
    // Simple moving average
    if (backend_latency_.find(backend) == backend_latency_.end()) {
        backend_latency_[backend] = latency_ms;
    } else {
        backend_latency_[backend] = (backend_latency_[backend] * 0.9) + (latency_ms * 0.1);
    }
}

void SimpleMetrics::incrementBackendErrors(const std::string& backend) {
    std::lock_guard<std::mutex> lock(mutex_);
    backend_errors_[backend]++;
}

std::string SimpleMetrics::exportMetrics() {
    std::lock_guard<std::mutex> lock(mutex_);
    std::ostringstream ss;

    // Header
    ss << "# HELP gateway_requests_total Total number of requests\n";
    ss << "# TYPE gateway_requests_total counter\n";
    ss << "gateway_requests_total " << total_requests_ << "\n\n";

    // Auth metrics
    ss << "# HELP gateway_auth_success_total Total successful authentications\n";
    ss << "# TYPE gateway_auth_success_total counter\n";
    ss << "gateway_auth_success_total " << auth_success_ << "\n\n";

    ss << "# HELP gateway_auth_failures_total Total failed authentications\n";
    ss << "# TYPE gateway_auth_failures_total counter\n";
    ss << "gateway_auth_failures_total " << auth_failures_ << "\n\n";

    // Rate limit metrics
    ss << "# HELP gateway_rate_limit_hits_total Total rate limit hits\n";
    ss << "# TYPE gateway_rate_limit_hits_total counter\n";
    ss << "gateway_rate_limit_hits_total " << rate_limit_hits_ << "\n\n";

    ss << "# HELP gateway_rate_limit_allowed_total Total allowed requests\n";
    ss << "# TYPE gateway_rate_limit_allowed_total counter\n";
    ss << "gateway_rate_limit_allowed_total " << rate_limit_allowed_ << "\n\n";

    // Connection metrics
    ss << "# HELP gateway_active_connections Current active connections\n";
    ss << "# TYPE gateway_active_connections gauge\n";
    ss << "gateway_active_connections " << active_connections_ << "\n\n";

    ss << "# HELP gateway_total_connections Total connections handled\n";
    ss << "# TYPE gateway_total_connections counter\n";
    ss << "gateway_total_connections " << total_connections_ << "\n\n";

    // Request metrics by method/path/status
    if (!request_metrics_.empty()) {
        ss << "# HELP gateway_http_requests_total HTTP requests by method, path, and status\n";
        ss << "# TYPE gateway_http_requests_total counter\n";
        for (const auto& entry : request_metrics_) {
            // Parse key back to labels
            std::string key = entry.first;
            size_t first_colon = key.find(':');
            size_t second_colon = key.find(':', first_colon + 1);

            if (first_colon != std::string::npos && second_colon != std::string::npos) {
                std::string method = key.substr(0, first_colon);
                std::string path = key.substr(first_colon + 1, second_colon - first_colon - 1);
                std::string status = key.substr(second_colon + 1);

                ss << "gateway_http_requests_total{method=\"" << method
                   << "\",path=\"" << path
                   << "\",status=\"" << status << "\"} "
                   << entry.second.count << "\n";
            }
        }
        ss << "\n";

        // Request duration
        ss << "# HELP gateway_request_duration_ms Request duration in milliseconds\n";
        ss << "# TYPE gateway_request_duration_ms summary\n";
        for (const auto& entry : request_metrics_) {
            if (entry.second.count > 0 && entry.second.total_duration_ms > 0) {
                double avg = entry.second.total_duration_ms / entry.second.count;
                ss << "gateway_request_duration_ms{method=\"" << entry.first << "\",quantile=\"avg\"} "
                   << std::fixed << std::setprecision(2) << avg << "\n";
                ss << "gateway_request_duration_ms{method=\"" << entry.first << "\",quantile=\"min\"} "
                   << std::fixed << std::setprecision(2) << entry.second.min_duration_ms << "\n";
                ss << "gateway_request_duration_ms{method=\"" << entry.first << "\",quantile=\"max\"} "
                   << std::fixed << std::setprecision(2) << entry.second.max_duration_ms << "\n";
            }
        }
        ss << "\n";
    }

    // Backend metrics
    if (!backend_errors_.empty()) {
        ss << "# HELP gateway_backend_errors_total Backend errors by backend\n";
        ss << "# TYPE gateway_backend_errors_total counter\n";
        for (const auto& entry : backend_errors_) {
            ss << "gateway_backend_errors_total{backend=\"" << entry.first << "\"} "
               << entry.second << "\n";
        }
        ss << "\n";
    }

    if (!backend_latency_.empty()) {
        ss << "# HELP gateway_backend_latency_ms Average backend latency in milliseconds\n";
        ss << "# TYPE gateway_backend_latency_ms gauge\n";
        for (const auto& entry : backend_latency_) {
            ss << "gateway_backend_latency_ms{backend=\"" << entry.first << "\"} "
               << std::fixed << std::setprecision(2) << entry.second << "\n";
        }
        ss << "\n";
    }

    return ss.str();
}

} // namespace gateway
