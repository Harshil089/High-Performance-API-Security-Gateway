#include "SecurityValidator.h"
#include <algorithm>
#include <cctype>
#include <regex>

namespace gateway {

SecurityValidator::SecurityValidator(size_t max_header_size, size_t max_body_size)
    : max_header_size_(max_header_size)
    , max_body_size_(max_body_size)
    , max_connections_per_ip_(10) {

    initializePatterns();

    // Set default allowed methods
    allowed_methods_ = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"};
}

void SecurityValidator::initializePatterns() {
    // SQL injection patterns
    sql_injection_patterns_ = {
        "' OR '1'='1",
        "' OR 1=1",
        "'; DROP TABLE",
        "'; DELETE FROM",
        "UNION SELECT",
        "' UNION SELECT",
        "--",
        "/*",
        "*/",
        "xp_cmdshell",
        "exec(",
        "execute("
    };

    // XSS patterns
    xss_patterns_ = {
        "<script",
        "</script>",
        "javascript:",
        "onerror=",
        "onload=",
        "onclick=",
        "<iframe",
        "<object",
        "<embed"
    };
}

ValidationResult SecurityValidator::validatePath(const std::string& path) {
    // Check for empty path
    if (path.empty()) {
        return ValidationResult(false, "Path cannot be empty", "INVALID_PATH");
    }

    // Check for path traversal
    if (containsPathTraversal(path)) {
        return ValidationResult(false, "Path traversal attempt detected", "PATH_TRAVERSAL");
    }

    // Check for null bytes
    if (containsNullBytes(path)) {
        return ValidationResult(false, "Null bytes not allowed in path", "NULL_BYTE");
    }

    // Check path length
    if (path.length() > 2048) {
        return ValidationResult(false, "Path too long", "PATH_TOO_LONG");
    }

    // Must start with /
    if (path[0] != '/') {
        return ValidationResult(false, "Path must start with /", "INVALID_PATH");
    }

    return ValidationResult();
}

ValidationResult SecurityValidator::validateHeaders(
    const std::map<std::string, std::string>& headers
) {
    // Check total header size
    size_t total_size = calculateHeaderSize(headers);
    if (total_size > max_header_size_) {
        return ValidationResult(false, "Headers too large", "HEADERS_TOO_LARGE");
    }

    // Validate individual headers
    for (const auto& [key, value] : headers) {
        // Check for null bytes
        if (containsNullBytes(key) || containsNullBytes(value)) {
            return ValidationResult(false, "Null bytes in headers", "NULL_BYTE");
        }

        // Check for control characters in header names
        for (char c : key) {
            if (std::iscntrl(c)) {
                return ValidationResult(false, "Control characters in header name", "INVALID_HEADER");
            }
        }
    }

    return ValidationResult();
}

ValidationResult SecurityValidator::validateBody(
    const std::string& body,
    const std::string& content_type
) {
    // Check body size
    if (body.size() > max_body_size_) {
        return ValidationResult(false, "Request body too large", "BODY_TOO_LARGE");
    }

    // Check for null bytes
    if (containsNullBytes(body)) {
        return ValidationResult(false, "Null bytes in body", "NULL_BYTE");
    }

    // Basic SQL injection check
    if (containsSQLInjection(body)) {
        return ValidationResult(false, "Suspicious SQL patterns detected", "SQL_INJECTION");
    }

    return ValidationResult();
}

ValidationResult SecurityValidator::validateMethod(const std::string& method) {
    if (allowed_methods_.find(method) == allowed_methods_.end()) {
        return ValidationResult(false, "HTTP method not allowed", "METHOD_NOT_ALLOWED");
    }

    return ValidationResult();
}

bool SecurityValidator::containsSQLInjection(const std::string& input) {
    std::string lower_input = input;
    std::transform(lower_input.begin(), lower_input.end(), lower_input.begin(), ::tolower);

    for (const auto& pattern : sql_injection_patterns_) {
        std::string lower_pattern = pattern;
        std::transform(lower_pattern.begin(), lower_pattern.end(), lower_pattern.begin(), ::tolower);

        if (lower_input.find(lower_pattern) != std::string::npos) {
            return true;
        }
    }

    return false;
}

bool SecurityValidator::containsXSS(const std::string& input) {
    std::string lower_input = input;
    std::transform(lower_input.begin(), lower_input.end(), lower_input.begin(), ::tolower);

    for (const auto& pattern : xss_patterns_) {
        std::string lower_pattern = pattern;
        std::transform(lower_pattern.begin(), lower_pattern.end(), lower_pattern.begin(), ::tolower);

        if (lower_input.find(lower_pattern) != std::string::npos) {
            return true;
        }
    }

    return false;
}

std::string SecurityValidator::sanitizeForLogging(const std::string& input) {
    std::string result = input;

    // Remove control characters except newline and tab
    result.erase(
        std::remove_if(result.begin(), result.end(), [](char c) {
            return std::iscntrl(c) && c != '\n' && c != '\t';
        }),
        result.end()
    );

    // Limit length
    if (result.length() > 1000) {
        result = result.substr(0, 1000) + "... (truncated)";
    }

    return result;
}

std::string SecurityValidator::maskSensitiveData(const std::string& input) {
    std::string result = input;

    // Mask Authorization header
    std::regex auth_regex(R"((Authorization:\s*Bearer\s+)([^\s]+))", std::regex::icase);
    result = std::regex_replace(result, auth_regex, "$1***MASKED***");

    // Mask password fields
    std::regex password_regex(R"(("password"\s*:\s*")[^"]*(")", std::regex::icase);
    result = std::regex_replace(result, password_regex, "$1***$2");

    // Mask credit card numbers (basic pattern)
    std::regex cc_regex(R"(\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b)");
    result = std::regex_replace(result, cc_regex, "****-****-****-****");

    // Mask API keys (common patterns)
    std::regex api_key_regex(R"(("api[_-]?key"\s*:\s*")[^"]*(")", std::regex::icase);
    result = std::regex_replace(result, api_key_regex, "$1***$2");

    return result;
}

bool SecurityValidator::allowConnection(const std::string& client_ip) {
    std::lock_guard<std::mutex> lock(connection_mutex_);

    int& count = connection_count_[client_ip];
    if (count >= max_connections_per_ip_) {
        return false;
    }

    count++;
    return true;
}

void SecurityValidator::releaseConnection(const std::string& client_ip) {
    std::lock_guard<std::mutex> lock(connection_mutex_);

    auto it = connection_count_.find(client_ip);
    if (it != connection_count_.end() && it->second > 0) {
        it->second--;

        // Remove entry if count is 0
        if (it->second == 0) {
            connection_count_.erase(it);
        }
    }
}

void SecurityValidator::setAllowedMethods(const std::vector<std::string>& methods) {
    allowed_methods_ = std::set<std::string>(methods.begin(), methods.end());
}

void SecurityValidator::setMaxConnectionsPerIP(int max_connections) {
    max_connections_per_ip_ = max_connections;
}

void SecurityValidator::setIPWhitelist(const std::vector<std::string>& ips) {
    ip_whitelist_ = std::set<std::string>(ips.begin(), ips.end());
}

void SecurityValidator::setIPBlacklist(const std::vector<std::string>& ips) {
    ip_blacklist_ = std::set<std::string>(ips.begin(), ips.end());
}

bool SecurityValidator::isIPAllowed(const std::string& ip) {
    // Blacklist takes priority — always reject blacklisted IPs
    if (!ip_blacklist_.empty() && ip_blacklist_.count(ip)) {
        return false;
    }

    // If whitelist is set, only allow whitelisted IPs
    if (!ip_whitelist_.empty()) {
        return ip_whitelist_.count(ip) > 0;
    }

    return true;
}

void SecurityValidator::setAPIKeys(const std::map<std::string, std::string>& api_keys) {
    api_keys_ = api_keys;
}

bool SecurityValidator::validateAPIKey(const std::string& api_key) {
    if (api_key.empty() || api_keys_.empty()) {
        return false;
    }
    return api_keys_.count(api_key) > 0;
}

bool SecurityValidator::containsPathTraversal(const std::string& path) {
    return path.find("..") != std::string::npos ||
           path.find("./") != std::string::npos ||
           path.find("\\") != std::string::npos;
}

bool SecurityValidator::containsNullBytes(const std::string& input) {
    return input.find('\0') != std::string::npos;
}

size_t SecurityValidator::calculateHeaderSize(
    const std::map<std::string, std::string>& headers
) {
    size_t total = 0;
    for (const auto& [key, value] : headers) {
        total += key.size() + value.size() + 4; // key: value\r\n
    }
    return total;
}

} // namespace gateway
