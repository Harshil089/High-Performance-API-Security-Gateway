#include <gtest/gtest.h>
#include "../src/rate_limiter/RateLimiter.h"
#include <thread>
#include <chrono>

using namespace gateway;

class RateLimiterTest : public ::testing::Test {
protected:
    void SetUp() override {
        rate_limiter = std::make_unique<RateLimiter>();
    }

    std::unique_ptr<RateLimiter> rate_limiter;
};

TEST_F(RateLimiterTest, AllowsRequestsWithinLimit) {
    rate_limiter->setPerIPLimit(10, 60); // 10 requests per minute

    for (int i = 0; i < 10; i++) {
        auto [allowed, retry_after] = rate_limiter->allowRequest("127.0.0.1", "/api/test");
        EXPECT_TRUE(allowed) << "Request " << i << " should be allowed";
    }
}

TEST_F(RateLimiterTest, BlocksRequestsExceedingLimit) {
    rate_limiter->setPerIPLimit(10, 60);

    // Use up all tokens
    for (int i = 0; i < 10; i++) {
        rate_limiter->allowRequest("127.0.0.1", "/api/test");
    }

    // Next request should be blocked
    auto [allowed, retry_after] = rate_limiter->allowRequest("127.0.0.1", "/api/test");
    EXPECT_FALSE(allowed);
    EXPECT_GT(retry_after, 0);
}

TEST_F(RateLimiterTest, RefillsTokensOverTime) {
    rate_limiter->setPerIPLimit(2, 1); // 2 requests per second

    // Use all tokens
    rate_limiter->allowRequest("127.0.0.1", "/api/test");
    rate_limiter->allowRequest("127.0.0.1", "/api/test");

    // Should be blocked
    auto [allowed1, retry1] = rate_limiter->allowRequest("127.0.0.1", "/api/test");
    EXPECT_FALSE(allowed1);

    // Wait for refill
    std::this_thread::sleep_for(std::chrono::milliseconds(1100));

    // Should be allowed after refill
    auto [allowed2, retry2] = rate_limiter->allowRequest("127.0.0.1", "/api/test");
    EXPECT_TRUE(allowed2);
}

TEST_F(RateLimiterTest, DifferentIPsHaveSeparateLimits) {
    rate_limiter->setPerIPLimit(1, 60);

    auto [allowed1, _] = rate_limiter->allowRequest("192.168.1.1", "/api/test");
    EXPECT_TRUE(allowed1);

    auto [allowed2, __] = rate_limiter->allowRequest("192.168.1.2", "/api/test");
    EXPECT_TRUE(allowed2); // Different IP should have its own bucket
}

TEST_F(RateLimiterTest, EndpointSpecificLimits) {
    rate_limiter->setEndpointLimit("/api/login", 2, 60);

    // First 2 requests allowed
    auto [allowed1, _] = rate_limiter->allowRequest("127.0.0.1", "/api/login");
    auto [allowed2, __] = rate_limiter->allowRequest("127.0.0.1", "/api/login");

    EXPECT_TRUE(allowed1);
    EXPECT_TRUE(allowed2);

    // Third request blocked
    auto [allowed3, retry] = rate_limiter->allowRequest("127.0.0.1", "/api/login");
    EXPECT_FALSE(allowed3);
}

TEST_F(RateLimiterTest, GlobalLimitAffectsAllRequests) {
    rate_limiter->setGlobalLimit(3, 60);

    // Use global limit
    rate_limiter->allowRequest("192.168.1.1", "/api/test1");
    rate_limiter->allowRequest("192.168.1.2", "/api/test2");
    rate_limiter->allowRequest("192.168.1.3", "/api/test3");

    // Next request from any IP should be blocked
    auto [allowed, retry] = rate_limiter->allowRequest("192.168.1.4", "/api/test4");
    EXPECT_FALSE(allowed);
}

TEST_F(RateLimiterTest, ResetBucketWorks) {
    rate_limiter->setPerIPLimit(1, 60);

    // Use token
    rate_limiter->allowRequest("127.0.0.1", "/api/test");

    // Should be blocked
    auto [allowed1, _] = rate_limiter->allowRequest("127.0.0.1", "/api/test");
    EXPECT_FALSE(allowed1);

    // Reset bucket
    rate_limiter->resetBucket("127.0.0.1");

    // Should be allowed after reset
    auto [allowed2, __] = rate_limiter->allowRequest("127.0.0.1", "/api/test");
    EXPECT_TRUE(allowed2);
}
