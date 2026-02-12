#include <gtest/gtest.h>
#include "../src/security/SecurityValidator.h"

using namespace gateway;

class SecurityValidatorTest : public ::testing::Test {
protected:
    void SetUp() override {
        validator = std::make_unique<SecurityValidator>();
    }

    std::unique_ptr<SecurityValidator> validator;
};

TEST_F(SecurityValidatorTest, ValidatesCorrectPath) {
    auto result = validator->validatePath("/api/users");
    EXPECT_TRUE(result.valid);
}

TEST_F(SecurityValidatorTest, RejectsPathTraversal) {
    auto result1 = validator->validatePath("/api/../etc/passwd");
    EXPECT_FALSE(result1.valid);

    auto result2 = validator->validatePath("/api/./secret");
    EXPECT_FALSE(result2.valid);

    auto result3 = validator->validatePath("/api\\windows");
    EXPECT_FALSE(result3.valid);
}

TEST_F(SecurityValidatorTest, RejectsEmptyPath) {
    auto result = validator->validatePath("");
    EXPECT_FALSE(result.valid);
}

TEST_F(SecurityValidatorTest, RejectsPathNotStartingWithSlash) {
    auto result = validator->validatePath("api/users");
    EXPECT_FALSE(result.valid);
}

TEST_F(SecurityValidatorTest, RejectsTooLongPath) {
    std::string long_path(3000, 'a');
    auto result = validator->validatePath(long_path);
    EXPECT_FALSE(result.valid);
}

TEST_F(SecurityValidatorTest, DetectsSQLInjection) {
    EXPECT_TRUE(validator->containsSQLInjection("' OR '1'='1"));
    EXPECT_TRUE(validator->containsSQLInjection("'; DROP TABLE users;"));
    EXPECT_TRUE(validator->containsSQLInjection("UNION SELECT * FROM"));
    EXPECT_FALSE(validator->containsSQLInjection("normal query string"));
}

TEST_F(SecurityValidatorTest, DetectsXSS) {
    EXPECT_TRUE(validator->containsXSS("<script>alert('xss')</script>"));
    EXPECT_TRUE(validator->containsXSS("javascript:alert(1)"));
    EXPECT_TRUE(validator->containsXSS("<img onerror='alert(1)'>"));
    EXPECT_FALSE(validator->containsXSS("normal HTML text"));
}

TEST_F(SecurityValidatorTest, ValidatesHTTPMethod) {
    EXPECT_TRUE(validator->validateMethod("GET").valid);
    EXPECT_TRUE(validator->validateMethod("POST").valid);
    EXPECT_TRUE(validator->validateMethod("PUT").valid);
    EXPECT_TRUE(validator->validateMethod("DELETE").valid);
    EXPECT_FALSE(validator->validateMethod("INVALID").valid);
}

TEST_F(SecurityValidatorTest, ValidatesHeaders) {
    std::map<std::string, std::string> headers = {
        {"Content-Type", "application/json"},
        {"Authorization", "Bearer token"}
    };

    auto result = validator->validateHeaders(headers);
    EXPECT_TRUE(result.valid);
}

TEST_F(SecurityValidatorTest, RejectsTooLargeHeaders) {
    std::map<std::string, std::string> headers;
    std::string large_value(10000, 'a');
    headers["X-Large-Header"] = large_value;

    auto result = validator->validateHeaders(headers);
    EXPECT_FALSE(result.valid);
}

TEST_F(SecurityValidatorTest, MasksSensitiveData) {
    std::string input = R"({"password": "secret123", "api_key": "abc123"})";
    std::string masked = validator->maskSensitiveData(input);

    EXPECT_NE(masked.find("***"), std::string::npos);
    EXPECT_EQ(masked.find("secret123"), std::string::npos);
}

TEST_F(SecurityValidatorTest, MasksAuthorizationHeader) {
    std::string input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    std::string masked = validator->maskSensitiveData(input);

    EXPECT_NE(masked.find("***MASKED***"), std::string::npos);
}

TEST_F(SecurityValidatorTest, TracksConnectionsPerIP) {
    validator->setMaxConnectionsPerIP(2);

    EXPECT_TRUE(validator->allowConnection("192.168.1.1"));
    EXPECT_TRUE(validator->allowConnection("192.168.1.1"));
    EXPECT_FALSE(validator->allowConnection("192.168.1.1")); // Third connection should fail

    // Different IP should work
    EXPECT_TRUE(validator->allowConnection("192.168.1.2"));
}

TEST_F(SecurityValidatorTest, ReleasesConnections) {
    validator->setMaxConnectionsPerIP(1);

    EXPECT_TRUE(validator->allowConnection("192.168.1.1"));
    EXPECT_FALSE(validator->allowConnection("192.168.1.1"));

    validator->releaseConnection("192.168.1.1");
    EXPECT_TRUE(validator->allowConnection("192.168.1.1"));
}
