#pragma once

#include <string>
#include <memory>
#include <map>
#include <atomic>
#include <thread>
#include <vector>
#include <mutex>
#include <functional>
#include <httplib.h>

namespace gateway {

/**
 * @brief WebSocket proxy for routing WebSocket connections to backend services
 *
 * Since cpp-httplib closes the socket after responding (even for 101),
 * this implementation runs a separate TCP listener for WebSocket traffic.
 * It performs the upgrade handshake and then relays raw WebSocket frames
 * bidirectionally between the client and backend.
 */
class WebSocketProxy {
public:
    WebSocketProxy() = default;
    ~WebSocketProxy();

    /**
     * @brief Check if request is a WebSocket upgrade request
     */
    bool isWebSocketUpgrade(const httplib::Request& req);

    /**
     * @brief Handle WebSocket upgrade via the httplib handler.
     * Sends the 101 response. Frame relay cannot happen here due to
     * httplib closing the socket, so this only completes the handshake.
     */
    bool handleWebSocketUpgrade(const httplib::Request& req, httplib::Response& res,
                                const std::string& backend_url);

    /**
     * @brief Start the standalone WebSocket proxy listener.
     * Runs on a separate port and handles full upgrade + frame relay.
     * @param host Bind address
     * @param port Bind port
     * @param route_resolver Callback: given a path, return backend ws:// URL or empty
     */
    using RouteResolver = std::function<std::string(const std::string& path)>;
    bool startListener(const std::string& host, int port, RouteResolver resolver);

    /**
     * @brief Stop the WebSocket proxy listener
     */
    void stopListener();

    /**
     * @brief Get active WebSocket connection count
     */
    int getActiveConnections() const { return active_connections_.load(); }

private:
    std::atomic<int> active_connections_{0};
    std::atomic<bool> running_{false};
    int listen_fd_ = -1;
    std::thread listener_thread_;
    std::vector<std::thread> connection_threads_;
    std::mutex threads_mutex_;
    RouteResolver route_resolver_;

    /**
     * @brief Generate WebSocket accept key from client key
     */
    std::string generateAcceptKey(const std::string& client_key);

    /**
     * @brief Accept loop for the standalone listener
     */
    void acceptLoop();

    /**
     * @brief Handle a single WebSocket client connection:
     *        parse the HTTP upgrade, connect to backend, relay frames.
     */
    void handleConnection(int client_fd);

    /**
     * @brief Parse the HTTP request from the client socket
     * @return Pair of (path, Sec-WebSocket-Key). Empty on failure.
     */
    std::pair<std::string, std::string> parseUpgradeRequest(int fd);

    /**
     * @brief Connect to a backend TCP endpoint (host:port)
     * @return socket fd, or -1 on failure
     */
    int connectToBackend(const std::string& url);

    /**
     * @brief Send the WebSocket upgrade to the backend and receive 101
     */
    bool upgradeBackend(int backend_fd, const std::string& host,
                        const std::string& path, const std::string& client_key);

    /**
     * @brief Relay data between two sockets until one closes.
     *        Uses select() for non-blocking bidirectional relay.
     */
    void relayFrames(int client_fd, int backend_fd);
};

} // namespace gateway
