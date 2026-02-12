#pragma once

#include <string>
#include <map>
#include <optional>
#include <chrono>

namespace gateway {

/**
 * @brief JWT token payload structure
 */
struct JWTClaims {
    std::string user_id;
    std::map<std::string, std::string> custom_claims;
    std::chrono::system_clock::time_point issued_at;
    std::chrono::system_clock::time_point expires_at;
    std::string issuer;
    std::string audience;
};

/**
 * @brief JWT validation result
 */
struct JWTValidationResult {
    bool is_valid;
    std::string error;
    JWTClaims claims;
};

/**
 * @brief JWT Manager for token generation and validation
 *
 * Supports HS256 and RS256 algorithms
 * Thread-safe implementation
 */
class JWTManager {
public:
    enum class Algorithm {
        HS256,  // HMAC with SHA-256
        RS256   // RSA Signature with SHA-256
    };

    /**
     * @brief Constructor for HMAC (HS256)
     * @param secret Secret key (min 32 bytes recommended)
     * @param issuer Token issuer
     * @param audience Token audience
     * @param algorithm Algorithm to use (default HS256)
     */
    JWTManager(
        const std::string& secret,
        const std::string& issuer = "api-gateway",
        const std::string& audience = "api-clients",
        Algorithm algorithm = Algorithm::HS256
    );

    /**
     * @brief Generate JWT token
     * @param user_id User identifier
     * @param custom_claims Additional claims
     * @param expires_in_seconds Token expiration time in seconds
     * @return JWT token string
     */
    std::string generateToken(
        const std::string& user_id,
        const std::map<std::string, std::string>& custom_claims = {},
        int expires_in_seconds = 3600
    );

    /**
     * @brief Validate JWT token
     * @param token JWT token string
     * @return Validation result with claims if valid
     */
    JWTValidationResult validateToken(const std::string& token);

    /**
     * @brief Extract claims without validation (for debugging)
     * @param token JWT token string
     * @return Claims if parseable
     */
    std::optional<JWTClaims> extractClaims(const std::string& token);

private:
    std::string secret_;
    std::string issuer_;
    std::string audience_;
    Algorithm algorithm_;

    /**
     * @brief Verify token signature
     */
    bool verifySignature(const std::string& token);

    /**
     * @brief Check token expiration
     */
    bool isExpired(const JWTClaims& claims);
};

} // namespace gateway
