#include "metrics/MetricsCollector.h"
#include <iostream>

namespace gateway {

MetricsCollector::MetricsCollector(int port) {
    // Create registry
    registry_ = std::make_shared<prometheus::Registry>();

    // Create exposer on specified port
    exposer_ = std::make_unique<prometheus::Exposer>("0.0.0.0:" + std::to_string(port));
    exposer_->RegisterCollectable(registry_);

    std::cout << "Metrics exposed on http://0.0.0.0:" << port << "/metrics" << std::endl;

    // Initialize request metrics
    requests_total_ = &prometheus::BuildCounter()
        .Name("gateway_requests_total")
        .Help("Total number of requests")
        .Register(*registry_);

    request_duration_ = &prometheus::BuildHistogram()
        .Name("gateway_request_duration_milliseconds")
        .Help("Request duration in milliseconds")
        .Register(*registry_);

    // Initialize auth metrics
    auto& auth_success_counter = prometheus::BuildCounter()
        .Name("gateway_auth_success_total")
        .Help("Total successful authentications")
        .Register(*registry_);
    auth_success_ = &auth_success_counter.Add({});

    auth_failures_ = &prometheus::BuildCounter()
        .Name("gateway_auth_failures_total")
        .Help("Total failed authentications")
        .Register(*registry_);

    // Initialize rate limit metrics
    rate_limit_hits_ = &prometheus::BuildCounter()
        .Name("gateway_rate_limit_hits_total")
        .Help("Total rate limit hits (blocked requests)")
        .Register(*registry_);

    rate_limit_allowed_ = &prometheus::BuildCounter()
        .Name("gateway_rate_limit_allowed_total")
        .Help("Total rate limit checks that allowed requests")
        .Register(*registry_);

    // Initialize backend metrics
    backend_latency_ = &prometheus::BuildHistogram()
        .Name("gateway_backend_latency_milliseconds")
        .Help("Backend request latency in milliseconds")
        .Register(*registry_);

    backend_errors_ = &prometheus::BuildCounter()
        .Name("gateway_backend_errors_total")
        .Help("Total backend errors")
        .Register(*registry_);

    backend_health_ = &prometheus::BuildGauge()
        .Name("gateway_backend_healthy")
        .Help("Backend health status (1=healthy, 0=unhealthy)")
        .Register(*registry_);

    // Initialize cache metrics
    auto& cache_hits_counter = prometheus::BuildCounter()
        .Name("gateway_cache_hits_total")
        .Help("Total cache hits")
        .Register(*registry_);
    cache_hits_ = &cache_hits_counter.Add({});

    auto& cache_misses_counter = prometheus::BuildCounter()
        .Name("gateway_cache_misses_total")
        .Help("Total cache misses")
        .Register(*registry_);
    cache_misses_ = &cache_misses_counter.Add({});

    auto& cache_latency_histogram = prometheus::BuildHistogram()
        .Name("gateway_cache_latency_milliseconds")
        .Help("Cache operation latency in milliseconds")
        .Register(*registry_);
    cache_latency_ = &cache_latency_histogram.Add({}, prometheus::Histogram::BucketBoundaries{1, 2, 5, 10, 20, 50, 100});

    // Initialize system metrics
    auto& active_connections_gauge = prometheus::BuildGauge()
        .Name("gateway_active_connections")
        .Help("Number of active connections")
        .Register(*registry_);
    active_connections_ = &active_connections_gauge.Add({});

    auto& total_connections_counter = prometheus::BuildCounter()
        .Name("gateway_total_connections")
        .Help("Total connections handled")
        .Register(*registry_);
    total_connections_ = &total_connections_counter.Add({});
}

void MetricsCollector::incrementRequests(const std::string& method, const std::string& path, int status_code) {
    requests_total_->Add({
        {"method", method},
        {"path", path},
        {"status", std::to_string(status_code)}
    }).Increment();
}

void MetricsCollector::recordRequestDuration(const std::string& method, const std::string& path, double duration_ms) {
    request_duration_->Add({
        {"method", method},
        {"path", path}
    }, prometheus::Histogram::BucketBoundaries{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000})
    .Observe(duration_ms);
}

void MetricsCollector::incrementAuthSuccess() {
    auth_success_->Increment();
}

void MetricsCollector::incrementAuthFailure(const std::string& reason) {
    auth_failures_->Add({{"reason", reason}}).Increment();
}

void MetricsCollector::incrementRateLimitHits(const std::string& key) {
    rate_limit_hits_->Add({{"key", key}}).Increment();
}

void MetricsCollector::incrementRateLimitAllowed(const std::string& key) {
    rate_limit_allowed_->Add({{"key", key}}).Increment();
}

void MetricsCollector::recordBackendLatency(const std::string& backend, double latency_ms) {
    backend_latency_->Add({{"backend", backend}},
        prometheus::Histogram::BucketBoundaries{1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000})
        .Observe(latency_ms);
}

void MetricsCollector::incrementBackendErrors(const std::string& backend) {
    backend_errors_->Add({{"backend", backend}}).Increment();
}

void MetricsCollector::setBackendHealthy(const std::string& backend, bool healthy) {
    backend_health_->Add({{"backend", backend}}).Set(healthy ? 1.0 : 0.0);
}

void MetricsCollector::incrementCacheHits() {
    cache_hits_->Increment();
}

void MetricsCollector::incrementCacheMisses() {
    cache_misses_->Increment();
}

void MetricsCollector::recordCacheLatency(double latency_ms) {
    cache_latency_->Observe(latency_ms);
}

void MetricsCollector::setActiveConnections(int count) {
    active_connections_->Set(count);
}

void MetricsCollector::incrementTotalConnections() {
    total_connections_->Increment();
}

} // namespace gateway
