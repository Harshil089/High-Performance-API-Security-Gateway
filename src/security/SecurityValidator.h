#pragma once

#include <string>
#include <vector>
#include <set>
#include <map>
#include <mutex>

namespace gateway {

/**
 * @brief Validation result
 */
struct ValidationResult {
    bool valid;
    std::string error;
    std::string error_code;

    ValidationResult() : valid(true) {}
    ValidationResult(bool v, const std::string& err, const std::string& code = "")
        : valid(v), error(err), error_code(code) {}
};

/**
 * @brief Security Validator
 *
 * Features:
 * - Input validation and sanitization
 * - Path traversal prevention
 * - Header size limits
 * - Body size limits
 * - SQL injection pattern detection
 * - XSS prevention
 * - DoS protection
 */
class SecurityValidator {
public:
    /**
     * @brief Constructor
     * @param max_header_size Maximum header size in bytes
     * @param max_body_size Maximum body size in bytes
     */
    SecurityValidator(size_t max_header_size = 8192, size_t max_body_size = 10485760);

    /**
     * @brief Validate request path
     * @param path Request path
     * @return Validation result
     */
    ValidationResult validatePath(const std::string& path);

    /**
     * @brief Validate request headers
     * @param headers Request headers
     * @return Validation result
     */
    ValidationResult validateHeaders(const std::map<std::string, std::string>& headers);

    /**
     * @brief Validate request body
     * @param body Request body
     * @param content_type Content-Type header
     * @return Validation result
     */
    ValidationResult validateBody(const std::string& body, const std::string& content_type);

    /**
     * @brief Validate HTTP method
     * @param method HTTP method
     * @return Validation result
     */
    ValidationResult validateMethod(const std::string& method);

    /**
     * @brief Check for SQL injection patterns
     * @param input Input string
     * @return true if suspicious patterns detected
     */
    bool containsSQLInjection(const std::string& input);

    /**
     * @brief Check for XSS patterns
     * @param input Input string
     * @return true if suspicious patterns detected
     */
    bool containsXSS(const std::string& input);

    /**
     * @brief Sanitize string for logging
     * @param input Input string
     * @return Sanitized string
     */
    std::string sanitizeForLogging(const std::string& input);

    /**
     * @brief Mask sensitive data
     * @param input Input string
     * @return Masked string
     */
    std::string maskSensitiveData(const std::string& input);

    /**
     * @brief Track connection per IP
     * @param client_ip Client IP
     * @return true if connection allowed
     */
    bool allowConnection(const std::string& client_ip);

    /**
     * @brief Release connection for IP
     * @param client_ip Client IP
     */
    void releaseConnection(const std::string& client_ip);

    /**
     * @brief Set allowed HTTP methods
     */
    void setAllowedMethods(const std::vector<std::string>& methods);

    /**
     * @brief Set maximum connections per IP
     */
    void setMaxConnectionsPerIP(int max_connections);

private:
    size_t max_header_size_;
    size_t max_body_size_;
    int max_connections_per_ip_;

    std::set<std::string> allowed_methods_;
    std::map<std::string, int> connection_count_;
    std::mutex connection_mutex_;

    std::vector<std::string> sql_injection_patterns_;
    std::vector<std::string> xss_patterns_;

    /**
     * @brief Initialize security patterns
     */
    void initializePatterns();

    /**
     * @brief Check if path contains traversal attempts
     */
    bool containsPathTraversal(const std::string& path);

    /**
     * @brief Check for null bytes
     */
    bool containsNullBytes(const std::string& input);

    /**
     * @brief Calculate total header size
     */
    size_t calculateHeaderSize(const std::map<std::string, std::string>& headers);
};

} // namespace gateway
