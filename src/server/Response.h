#pragma once

#include <string>

namespace gateway {

/**
 * @brief HTTP Status codes
 */
namespace StatusCode {
    constexpr int OK = 200;
    constexpr int CREATED = 201;
    constexpr int NO_CONTENT = 204;
    constexpr int BAD_REQUEST = 400;
    constexpr int UNAUTHORIZED = 401;
    constexpr int FORBIDDEN = 403;
    constexpr int NOT_FOUND = 404;
    constexpr int METHOD_NOT_ALLOWED = 405;
    constexpr int TOO_MANY_REQUESTS = 429;
    constexpr int INTERNAL_SERVER_ERROR = 500;
    constexpr int BAD_GATEWAY = 502;
    constexpr int SERVICE_UNAVAILABLE = 503;
    constexpr int GATEWAY_TIMEOUT = 504;
}

/**
 * @brief Common response builders
 */
class ResponseBuilder {
public:
    static std::string errorJson(const std::string& message, const std::string& code = "") {
        std::string json = "{\"error\":\"" + message + "\"";
        if (!code.empty()) {
            json += ",\"code\":\"" + code + "\"";
        }
        json += "}";
        return json;
    }

    static std::string successJson(const std::string& message) {
        return "{\"message\":\"" + message + "\"}";
    }
};

} // namespace gateway
