#include "JWTManager.h"
#include <jwt-cpp/jwt.h>
#include <iostream>

namespace gateway {

JWTManager::JWTManager(
    const std::string& secret,
    const std::string& issuer,
    const std::string& audience,
    Algorithm algorithm
) : secret_(secret)
  , issuer_(issuer)
  , audience_(audience)
  , algorithm_(algorithm) {
    if (secret_.empty()) {
        throw std::invalid_argument("JWT secret cannot be empty");
    }
    if (secret_.size() < 32 && algorithm == Algorithm::HS256) {
        std::cerr << "Warning: JWT secret should be at least 32 bytes for HS256\n";
    }
}

std::string JWTManager::generateToken(
    const std::string& user_id,
    const std::map<std::string, std::string>& custom_claims,
    int expires_in_seconds
) {
    auto now = std::chrono::system_clock::now();
    auto expiry = now + std::chrono::seconds(expires_in_seconds);

    try {
        auto token = jwt::create()
            .set_issuer(issuer_)
            .set_audience(audience_)
            .set_issued_at(now)
            .set_expires_at(expiry)
            .set_subject(user_id);

        // Add custom claims
        for (const auto& [key, value] : custom_claims) {
            token.set_payload_claim(key, jwt::claim(value));
        }

        // Sign token based on algorithm
        if (algorithm_ == Algorithm::HS256) {
            return token.sign(jwt::algorithm::hs256{secret_});
        } else {
            // RS256 would require private key
            throw std::runtime_error("RS256 not yet implemented");
        }
    } catch (const std::exception& e) {
        std::cerr << "Error generating JWT token: " << e.what() << "\n";
        return "";
    }
}

JWTValidationResult JWTManager::validateToken(const std::string& token) {
    JWTValidationResult result;
    result.is_valid = false;

    if (token.empty()) {
        result.error = "Token is empty";
        return result;
    }

    try {
        // Decode and verify token
        auto decoded = jwt::decode(token);

        // Create verifier
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{secret_})
            .with_issuer(issuer_)
            .with_audience(audience_);

        // Verify signature and claims
        verifier.verify(decoded);

        // Extract claims
        result.claims.user_id = decoded.get_subject();
        result.claims.issuer = decoded.get_issuer();

        if (decoded.has_payload_claim("aud")) {
            auto aud_claim = decoded.get_payload_claim("aud");
            if (aud_claim.get_type() == jwt::json::type::string) {
                result.claims.audience = aud_claim.as_string();
            }
        }

        if (decoded.has_issued_at()) {
            result.claims.issued_at = decoded.get_issued_at();
        }

        if (decoded.has_expires_at()) {
            result.claims.expires_at = decoded.get_expires_at();
        }

        // Extract custom claims
        for (const auto& claim : decoded.get_payload_claims()) {
            if (claim.first != "iss" && claim.first != "aud" &&
                claim.first != "sub" && claim.first != "iat" && claim.first != "exp") {
                if (claim.second.get_type() == jwt::json::type::string) {
                    result.claims.custom_claims[claim.first] = claim.second.as_string();
                }
            }
        }

        result.is_valid = true;

    } catch (const jwt::error::token_verification_exception& e) {
        result.error = "Token verification failed: ";
        result.error += e.what();
    } catch (const std::exception& e) {
        result.error = "Invalid token: ";
        result.error += e.what();
    }

    return result;
}

std::optional<JWTClaims> JWTManager::extractClaims(const std::string& token) {
    try {
        auto decoded = jwt::decode(token);

        JWTClaims claims;
        claims.user_id = decoded.get_subject();
        claims.issuer = decoded.get_issuer();

        if (decoded.has_issued_at()) {
            claims.issued_at = decoded.get_issued_at();
        }

        if (decoded.has_expires_at()) {
            claims.expires_at = decoded.get_expires_at();
        }

        return claims;
    } catch (const std::exception&) {
        return std::nullopt;
    }
}

bool JWTManager::verifySignature(const std::string& token) {
    try {
        auto decoded = jwt::decode(token);
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{secret_});
        verifier.verify(decoded);
        return true;
    } catch (const std::exception&) {
        return false;
    }
}

bool JWTManager::isExpired(const JWTClaims& claims) {
    auto now = std::chrono::system_clock::now();
    return now >= claims.expires_at;
}

} // namespace gateway
