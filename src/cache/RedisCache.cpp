#include "cache/RedisCache.h"
#include <nlohmann/json.hpp>
#include <chrono>
#include <iostream>

using json = nlohmann::json;

namespace gateway {

RedisCache::RedisCache(const std::string& redis_uri, const std::string& key_prefix)
    : key_prefix_(key_prefix) {
    try {
        sw::redis::ConnectionOptions opts;
        opts.host = "127.0.0.1";
        opts.port = 6379;
        opts.socket_timeout = std::chrono::milliseconds(100);

        // Parse redis_uri (tcp://host:port format)
        if (redis_uri.find("tcp://") == 0) {
            std::string host_port = redis_uri.substr(6);
            size_t colon_pos = host_port.find(':');
            if (colon_pos != std::string::npos) {
                opts.host = host_port.substr(0, colon_pos);
                opts.port = std::stoi(host_port.substr(colon_pos + 1));
            }
        }

        redis_ = std::make_unique<sw::redis::Redis>(opts);
        redis_->ping();
        std::cout << "Cache: Connected to Redis at " << opts.host << ":" << opts.port << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Failed to connect to Redis for caching: " << e.what() << std::endl;
        throw;
    }
}

std::optional<RedisCache::CachedResponse> RedisCache::get(const std::string& key) {
    try {
        std::string full_key = getFullKey(key);
        auto value = redis_->get(full_key);

        if (value) {
            return deserializeResponse(*value);
        }
        return std::nullopt;
    } catch (const std::exception& e) {
        std::cerr << "Cache get error: " << e.what() << std::endl;
        return std::nullopt;
    }
}

void RedisCache::set(const std::string& key, const CachedResponse& response, int ttl_seconds) {
    try {
        std::string full_key = getFullKey(key);
        std::string serialized = serializeResponse(response);

        redis_->setex(full_key, std::chrono::seconds(ttl_seconds), serialized);
    } catch (const std::exception& e) {
        std::cerr << "Cache set error: " << e.what() << std::endl;
    }
}

void RedisCache::invalidate(const std::string& key) {
    try {
        std::string full_key = getFullKey(key);
        redis_->del(full_key);
    } catch (const std::exception& e) {
        std::cerr << "Cache invalidate error: " << e.what() << std::endl;
    }
}

void RedisCache::invalidatePattern(const std::string& pattern) {
    try {
        std::string full_pattern = getFullKey(pattern);
        std::vector<std::string> keys;

        // Scan for matching keys
        auto cursor = 0LL;
        while (true) {
            cursor = redis_->scan(cursor, full_pattern, 100,
                                 std::back_inserter(keys));
            if (cursor == 0) {
                break;
            }
        }

        // Delete all matching keys
        if (!keys.empty()) {
            redis_->del(keys.begin(), keys.end());
            std::cout << "Cache: Invalidated " << keys.size() << " keys matching " << pattern << std::endl;
        }
    } catch (const std::exception& e) {
        std::cerr << "Cache invalidate pattern error: " << e.what() << std::endl;
    }
}

void RedisCache::clear() {
    try {
        invalidatePattern("*");
    } catch (const std::exception& e) {
        std::cerr << "Cache clear error: " << e.what() << std::endl;
    }
}

bool RedisCache::isConnected() {
    try {
        redis_->ping();
        return true;
    } catch (const std::exception&) {
        return false;
    }
}

RedisCache::Stats RedisCache::getStats() {
    Stats stats{0, 0};
    try {
        // Count keys with our prefix
        std::string pattern = key_prefix_ + "*";
        std::vector<std::string> keys;
        auto cursor = 0LL;
        while (true) {
            cursor = redis_->scan(cursor, pattern, 1000,
                                 std::back_inserter(keys));
            if (cursor == 0) {
                break;
            }
        }
        stats.total_keys = keys.size();

        // Get memory usage (approximate)
        for (const auto& key : keys) {
            auto value = redis_->get(key);
            if (value) {
                stats.memory_usage += value->size();
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Cache stats error: " << e.what() << std::endl;
    }
    return stats;
}

std::string RedisCache::getFullKey(const std::string& key) const {
    return key_prefix_ + key;
}

std::string RedisCache::serializeResponse(const CachedResponse& response) {
    auto now = std::chrono::system_clock::now();
    auto cached_at = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ).count();

    json j;
    j["body"] = response.body;
    j["content_type"] = response.content_type;
    j["status_code"] = response.status_code;
    j["cached_at"] = cached_at;

    return j.dump();
}

std::optional<RedisCache::CachedResponse> RedisCache::deserializeResponse(const std::string& data) {
    try {
        json j = json::parse(data);

        CachedResponse response;
        response.body = j["body"].get<std::string>();
        response.content_type = j["content_type"].get<std::string>();
        response.status_code = j["status_code"].get<int>();
        response.cached_at = j["cached_at"].get<long long>();

        return response;
    } catch (const std::exception& e) {
        std::cerr << "Cache deserialize error: " << e.what() << std::endl;
        return std::nullopt;
    }
}

} // namespace gateway
