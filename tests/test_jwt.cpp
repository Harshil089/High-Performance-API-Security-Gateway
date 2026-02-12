#include <gtest/gtest.h>
#include "../src/auth/JWTManager.h"
#include <thread>
#include <chrono>

using namespace gateway;

class JWTManagerTest : public ::testing::Test {
protected:
    void SetUp() override {
        jwt_manager = std::make_unique<JWTManager>(
            "test-secret-key-min-32-characters-long",
            "test-issuer",
            "test-audience"
        );
    }

    std::unique_ptr<JWTManager> jwt_manager;
};

TEST_F(JWTManagerTest, GeneratesValidToken) {
    auto token = jwt_manager->generateToken("user123", {{"role", "admin"}}, 3600);
    ASSERT_FALSE(token.empty());
}

TEST_F(JWTManagerTest, ValidatesCorrectToken) {
    auto token = jwt_manager->generateToken("user123", {{"role", "admin"}}, 3600);
    auto result = jwt_manager->validateToken(token);

    ASSERT_TRUE(result.is_valid);
    EXPECT_EQ(result.claims.user_id, "user123");
    EXPECT_EQ(result.claims.issuer, "test-issuer");
}

TEST_F(JWTManagerTest, RejectsExpiredToken) {
    auto token = jwt_manager->generateToken("user123", {}, -10); // Expired 10 sec ago
    auto result = jwt_manager->validateToken(token);

    ASSERT_FALSE(result.is_valid);
    EXPECT_FALSE(result.error.empty());
}

TEST_F(JWTManagerTest, RejectsTamperedToken) {
    auto token = jwt_manager->generateToken("user123", {}, 3600);

    // Tamper with token by modifying a character
    if (!token.empty()) {
        token[token.length() / 2] = 'X';
    }

    auto result = jwt_manager->validateToken(token);
    ASSERT_FALSE(result.is_valid);
}

TEST_F(JWTManagerTest, RejectsEmptyToken) {
    auto result = jwt_manager->validateToken("");
    ASSERT_FALSE(result.is_valid);
    EXPECT_EQ(result.error, "Token is empty");
}

TEST_F(JWTManagerTest, ExtractsCustomClaims) {
    std::map<std::string, std::string> custom_claims = {
        {"role", "admin"},
        {"department", "engineering"}
    };

    auto token = jwt_manager->generateToken("user123", custom_claims, 3600);
    auto result = jwt_manager->validateToken(token);

    ASSERT_TRUE(result.is_valid);
    EXPECT_EQ(result.claims.custom_claims["role"], "admin");
    EXPECT_EQ(result.claims.custom_claims["department"], "engineering");
}

TEST_F(JWTManagerTest, RejectsInvalidSignature) {
    auto token = jwt_manager->generateToken("user123", {}, 3600);

    // Create manager with different secret
    JWTManager different_manager("different-secret-key-32-chars-min", "test-issuer", "test-audience");

    auto result = different_manager.validateToken(token);
    ASSERT_FALSE(result.is_valid);
}
