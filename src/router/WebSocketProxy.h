#pragma once

#include <string>
#include <memory>
#include <map>
#include <httplib.h>

namespace gateway {

/**
 * @brief WebSocket proxy for routing WebSocket connections to backend services
 *
 * Handles WebSocket upgrade requests and proxies messages bidirectionally
 */
class WebSocketProxy {
public:
    WebSocketProxy() = default;
    ~WebSocketProxy() = default;

    /**
     * @brief Check if request is a WebSocket upgrade request
     * @param req HTTP request
     * @return true if WebSocket upgrade, false otherwise
     */
    bool isWebSocketUpgrade(const httplib::Request& req);

    /**
     * @brief Handle WebSocket upgrade and proxy to backend
     * @param req HTTP request
     * @param res HTTP response
     * @param backend_url Backend WebSocket URL
     * @return true if upgrade successful, false otherwise
     */
    bool handleWebSocketUpgrade(const httplib::Request& req, httplib::Response& res,
                                const std::string& backend_url);

    /**
     * @brief Get active WebSocket connection count
     */
    int getActiveConnections() const { return active_connections_; }

private:
    int active_connections_ = 0;

    /**
     * @brief Generate WebSocket accept key from client key
     * @param client_key Client WebSocket key from Sec-WebSocket-Key header
     * @return Accept key for Sec-WebSocket-Accept header
     */
    std::string generateAcceptKey(const std::string& client_key);
};

} // namespace gateway
