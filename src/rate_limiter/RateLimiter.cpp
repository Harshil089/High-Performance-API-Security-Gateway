#include "RateLimiter.h"
#include <algorithm>
#include <cmath>
#include <iostream>

namespace gateway {

RateLimiter::RateLimiter(int cleanup_interval_seconds)
    : cleanup_running_(true)
    , cleanup_interval_seconds_(cleanup_interval_seconds) {

    // Start cleanup thread
    cleanup_thread_ = std::thread([this]() {
        cleanupOldBuckets();
    });
}

RateLimiter::~RateLimiter() {
    cleanup_running_ = false;
    if (cleanup_thread_.joinable()) {
        cleanup_thread_.join();
    }
}

void RateLimiter::setGlobalLimit(int requests, int window) {
    global_config_ = {requests, window};
    int refill_rate = window > 0 ? requests / window : requests;
    global_bucket_ = std::make_shared<TokenBucket>(requests, refill_rate);
}

void RateLimiter::setPerIPLimit(int requests, int window) {
    per_ip_config_ = {requests, window};
}

void RateLimiter::setEndpointLimit(const std::string& endpoint, int requests, int window) {
    endpoint_configs_[endpoint] = {requests, window};
}

std::pair<bool, int> RateLimiter::allowRequest(
    const std::string& client_ip,
    const std::string& endpoint,
    int tokens_required
) {
    // Check global limit
    if (global_bucket_) {
        refillBucket(*global_bucket_, global_config_);
        if (!consumeTokens(*global_bucket_, tokens_required)) {
            int retry_after = calculateRetryAfter(*global_bucket_, global_config_);
            return {false, retry_after};
        }
    }

    // Check per-IP limit
    if (per_ip_config_.requests > 0) {
        auto bucket = getBucket(ip_buckets_, client_ip, per_ip_config_);
        refillBucket(*bucket, per_ip_config_);
        if (!consumeTokens(*bucket, tokens_required)) {
            int retry_after = calculateRetryAfter(*bucket, per_ip_config_);
            return {false, retry_after};
        }
    }

    // Check endpoint-specific limit
    auto endpoint_config = endpoint_configs_.find(endpoint);
    if (endpoint_config != endpoint_configs_.end()) {
        std::string key = client_ip + ":" + endpoint;
        auto bucket = getBucket(endpoint_buckets_, key, endpoint_config->second);
        refillBucket(*bucket, endpoint_config->second);
        if (!consumeTokens(*bucket, tokens_required)) {
            int retry_after = calculateRetryAfter(*bucket, endpoint_config->second);
            return {false, retry_after};
        }
    }

    return {true, 0};
}

int RateLimiter::getRemainingTokens(const std::string& client_ip, const std::string& endpoint) {
    std::string key = client_ip + ":" + endpoint;

    std::lock_guard<std::mutex> lock(buckets_mutex_);

    auto it = endpoint_buckets_.find(key);
    if (it != endpoint_buckets_.end()) {
        std::lock_guard<std::mutex> bucket_lock(it->second->mtx);
        return static_cast<int>(it->second->tokens);
    }

    auto ip_it = ip_buckets_.find(client_ip);
    if (ip_it != ip_buckets_.end()) {
        std::lock_guard<std::mutex> bucket_lock(ip_it->second->mtx);
        return static_cast<int>(ip_it->second->tokens);
    }

    return per_ip_config_.requests; // Default to full capacity
}

void RateLimiter::resetBucket(const std::string& client_ip) {
    std::lock_guard<std::mutex> lock(buckets_mutex_);
    ip_buckets_.erase(client_ip);
}

std::shared_ptr<TokenBucket> RateLimiter::getBucket(
    std::map<std::string, std::shared_ptr<TokenBucket>>& buckets,
    const std::string& key,
    const RateLimitConfig& config
) {
    std::lock_guard<std::mutex> lock(buckets_mutex_);

    auto it = buckets.find(key);
    if (it != buckets.end()) {
        return it->second;
    }

    // Create new bucket
    int refill_rate = config.window > 0 ? config.requests / config.window : config.requests;
    auto bucket = std::make_shared<TokenBucket>(config.requests, refill_rate);
    buckets[key] = bucket;
    return bucket;
}

void RateLimiter::refillBucket(TokenBucket& bucket, const RateLimitConfig& config) {
    std::lock_guard<std::mutex> lock(bucket.mtx);

    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
        now - bucket.last_refill
    ).count();

    if (elapsed > 0) {
        // Calculate tokens to add based on elapsed time
        double tokens_to_add = (bucket.refill_rate * elapsed) / 1000.0;
        bucket.tokens = std::min(
            static_cast<double>(bucket.capacity),
            bucket.tokens + tokens_to_add
        );
        bucket.last_refill = now;
    }
}

bool RateLimiter::consumeTokens(TokenBucket& bucket, int tokens) {
    std::lock_guard<std::mutex> lock(bucket.mtx);

    if (bucket.tokens >= tokens) {
        bucket.tokens -= tokens;
        return true;
    }
    return false;
}

void RateLimiter::cleanupOldBuckets() {
    while (cleanup_running_) {
        std::this_thread::sleep_for(std::chrono::seconds(cleanup_interval_seconds_));

        std::lock_guard<std::mutex> lock(buckets_mutex_);

        auto now = std::chrono::steady_clock::now();

        // Clean up IP buckets not used in the last 10 minutes
        for (auto it = ip_buckets_.begin(); it != ip_buckets_.end();) {
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                now - it->second->last_refill
            ).count();

            if (elapsed > 600) { // 10 minutes
                it = ip_buckets_.erase(it);
            } else {
                ++it;
            }
        }

        // Clean up endpoint buckets
        for (auto it = endpoint_buckets_.begin(); it != endpoint_buckets_.end();) {
            auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                now - it->second->last_refill
            ).count();

            if (elapsed > 600) {
                it = endpoint_buckets_.erase(it);
            } else {
                ++it;
            }
        }
    }
}

int RateLimiter::calculateRetryAfter(TokenBucket& bucket, const RateLimitConfig& config) {
    std::lock_guard<std::mutex> lock(bucket.mtx);

    // Calculate how long until 1 token is available
    if (bucket.refill_rate > 0) {
        double seconds_per_token = 1.0 / bucket.refill_rate;
        return static_cast<int>(std::ceil(seconds_per_token));
    }

    return config.window; // Default to window duration
}

} // namespace gateway
