#include "rate_limiter/RedisRateLimiter.h"
#include <chrono>
#include <iostream>

namespace gateway {

RedisRateLimiter::RedisRateLimiter(const std::string& redis_uri, const std::string& key_prefix)
    : key_prefix_(key_prefix) {
    try {
        sw::redis::ConnectionOptions opts;
        opts.host = "127.0.0.1";
        opts.port = 6379;
        opts.socket_timeout = std::chrono::milliseconds(100);

        // Parse redis_uri if needed (tcp://host:port format)
        if (redis_uri.find("tcp://") == 0) {
            std::string host_port = redis_uri.substr(6);
            size_t colon_pos = host_port.find(':');
            if (colon_pos != std::string::npos) {
                opts.host = host_port.substr(0, colon_pos);
                opts.port = std::stoi(host_port.substr(colon_pos + 1));
            }
        }

        redis_ = std::make_unique<sw::redis::Redis>(opts);

        // Test connection
        redis_->ping();
        std::cout << "Connected to Redis at " << opts.host << ":" << opts.port << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Failed to connect to Redis: " << e.what() << std::endl;
        throw;
    }
}

bool RedisRateLimiter::allowRequest(const std::string& key, int max_requests, int window_seconds) {
    try {
        auto now = std::chrono::system_clock::now();
        auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()
        ).count();

        std::string full_key = getFullKey(key);

        // Start a pipeline for atomic operations
        auto pipe = redis_->pipeline();

        // Remove old entries outside the window
        auto window_start = timestamp - (window_seconds * 1000);
        pipe.zremrangebyscore(full_key, sw::redis::UnboundedInterval<double>{0, window_start});

        // Count current entries in window
        pipe.zcount(full_key, sw::redis::UnboundedInterval<double>{window_start, timestamp});

        // Add current request
        pipe.zadd(full_key, std::to_string(timestamp), timestamp);

        // Set expiry on the key (window + 1 second buffer)
        pipe.expire(full_key, std::chrono::seconds(window_seconds + 1));

        auto replies = pipe.exec();

        // Get the count from the second command (index 1)
        long long current_count = 0;
        if (replies.size() > 1) {
            auto count_reply = replies.get<long long>(1);
            current_count = count_reply;
        }

        // Allow if under limit (count before adding current request)
        return current_count < max_requests;

    } catch (const std::exception& e) {
        std::cerr << "Redis rate limiter error: " << e.what() << std::endl;
        // Fail open - allow request if Redis is down
        return true;
    }
}

int RedisRateLimiter::getCurrentCount(const std::string& key, int window_seconds) {
    try {
        auto now = std::chrono::system_clock::now();
        auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()
        ).count();

        std::string full_key = getFullKey(key);
        auto window_start = timestamp - (window_seconds * 1000);

        return redis_->zcount(full_key, sw::redis::UnboundedInterval<double>{window_start, timestamp});
    } catch (const std::exception& e) {
        std::cerr << "Error getting count from Redis: " << e.what() << std::endl;
        return 0;
    }
}

void RedisRateLimiter::resetKey(const std::string& key) {
    try {
        std::string full_key = getFullKey(key);
        redis_->del(full_key);
    } catch (const std::exception& e) {
        std::cerr << "Error resetting key in Redis: " << e.what() << std::endl;
    }
}

bool RedisRateLimiter::isConnected() {
    try {
        redis_->ping();
        return true;
    } catch (const std::exception&) {
        return false;
    }
}

std::string RedisRateLimiter::getFullKey(const std::string& key) const {
    return key_prefix_ + key;
}

} // namespace gateway
