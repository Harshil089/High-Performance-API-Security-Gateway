#pragma once

#include <string>
#include <map>
#include <vector>

namespace gateway {

/**
 * @brief HTTP Request representation
 */
struct HttpRequest {
    std::string method;
    std::string path;
    std::string query_string;
    std::map<std::string, std::string> headers;
    std::map<std::string, std::string> query_params;
    std::string body;
    std::string client_ip;

    /**
     * @brief Get header value
     */
    std::string getHeader(const std::string& name, const std::string& default_value = "") const {
        auto it = headers.find(name);
        return (it != headers.end()) ? it->second : default_value;
    }

    /**
     * @brief Get query parameter
     */
    std::string getQueryParam(const std::string& name, const std::string& default_value = "") const {
        auto it = query_params.find(name);
        return (it != query_params.end()) ? it->second : default_value;
    }

    /**
     * @brief Get total header size
     */
    size_t headerSize() const {
        size_t total = 0;
        for (const auto& [key, value] : headers) {
            total += key.size() + value.size() + 4; // key: value\r\n
        }
        return total;
    }
};

/**
 * @brief HTTP Response representation
 */
struct HttpResponse {
    int status_code;
    std::map<std::string, std::string> headers;
    std::string body;

    HttpResponse() : status_code(200) {}

    /**
     * @brief Set header
     */
    void setHeader(const std::string& name, const std::string& value) {
        headers[name] = value;
    }

    /**
     * @brief Set JSON body and Content-Type
     */
    void setJsonBody(const std::string& json) {
        body = json;
        headers["Content-Type"] = "application/json";
    }

    /**
     * @brief Set text body and Content-Type
     */
    void setTextBody(const std::string& text) {
        body = text;
        headers["Content-Type"] = "text/plain";
    }
};

} // namespace gateway
