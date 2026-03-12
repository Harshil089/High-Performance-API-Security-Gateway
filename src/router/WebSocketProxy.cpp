#include "router/WebSocketProxy.h"
#include <openssl/sha.h>
#include <openssl/bio.h>
#include <openssl/evp.h>
#include <openssl/buffer.h>
#include <iostream>
#include <cstring>
#include <sstream>
#include <algorithm>

#include <sys/socket.h>
#include <sys/select.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>
#include <fcntl.h>
#include <cerrno>

namespace gateway {

WebSocketProxy::~WebSocketProxy() {
    stopListener();
}

bool WebSocketProxy::isWebSocketUpgrade(const httplib::Request& req) {
    if (req.get_header_value("Upgrade") == "websocket" &&
        req.get_header_value("Connection").find("Upgrade") != std::string::npos &&
        req.has_header("Sec-WebSocket-Key") &&
        req.get_header_value("Sec-WebSocket-Version") == "13") {
        return true;
    }
    return false;
}

bool WebSocketProxy::handleWebSocketUpgrade(const httplib::Request& req, httplib::Response& res,
                                           const std::string& /*backend_url*/) {
    // cpp-httplib closes the socket after the handler returns,
    // so we can only send the 101 response here — no frame relay.
    // The standalone listener (startListener) handles full proxying.
    std::string client_key = req.get_header_value("Sec-WebSocket-Key");
    if (client_key.empty()) {
        res.status = 400;
        res.set_content("Bad Request: Missing Sec-WebSocket-Key", "text/plain");
        return false;
    }

    std::string accept_key = generateAcceptKey(client_key);

    res.status = 101;
    res.set_header("Upgrade", "websocket");
    res.set_header("Connection", "Upgrade");
    res.set_header("Sec-WebSocket-Accept", accept_key);

    if (req.has_header("Sec-WebSocket-Protocol")) {
        res.set_header("Sec-WebSocket-Protocol", req.get_header_value("Sec-WebSocket-Protocol"));
    }

    active_connections_++;
    return true;
}

// ─── Standalone listener ─────────────────────────────────────────────

bool WebSocketProxy::startListener(const std::string& host, int port, RouteResolver resolver) {
    if (running_.load()) return false;

    route_resolver_ = std::move(resolver);

    listen_fd_ = ::socket(AF_INET, SOCK_STREAM, 0);
    if (listen_fd_ < 0) {
        std::cerr << "WebSocketProxy: socket() failed: " << strerror(errno) << "\n";
        return false;
    }

    int opt = 1;
    setsockopt(listen_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<uint16_t>(port));
    if (host == "0.0.0.0" || host.empty()) {
        addr.sin_addr.s_addr = INADDR_ANY;
    } else {
        inet_pton(AF_INET, host.c_str(), &addr.sin_addr);
    }

    if (::bind(listen_fd_, reinterpret_cast<struct sockaddr*>(&addr), sizeof(addr)) < 0) {
        std::cerr << "WebSocketProxy: bind() failed on port " << port << ": " << strerror(errno) << "\n";
        ::close(listen_fd_);
        listen_fd_ = -1;
        return false;
    }

    if (::listen(listen_fd_, 64) < 0) {
        std::cerr << "WebSocketProxy: listen() failed: " << strerror(errno) << "\n";
        ::close(listen_fd_);
        listen_fd_ = -1;
        return false;
    }

    running_.store(true);
    listener_thread_ = std::thread(&WebSocketProxy::acceptLoop, this);

    std::cout << "WebSocket proxy listening on " << host << ":" << port << "\n";
    return true;
}

void WebSocketProxy::stopListener() {
    running_.store(false);

    if (listen_fd_ >= 0) {
        ::shutdown(listen_fd_, SHUT_RDWR);
        ::close(listen_fd_);
        listen_fd_ = -1;
    }

    if (listener_thread_.joinable()) {
        listener_thread_.join();
    }

    std::lock_guard<std::mutex> lock(threads_mutex_);
    for (auto& t : connection_threads_) {
        if (t.joinable()) t.join();
    }
    connection_threads_.clear();
}

void WebSocketProxy::acceptLoop() {
    while (running_.load()) {
        struct sockaddr_in client_addr{};
        socklen_t addr_len = sizeof(client_addr);

        int client_fd = ::accept(listen_fd_, reinterpret_cast<struct sockaddr*>(&client_addr), &addr_len);
        if (client_fd < 0) {
            if (running_.load()) {
                std::cerr << "WebSocketProxy: accept() error: " << strerror(errno) << "\n";
            }
            continue;
        }

        std::lock_guard<std::mutex> lock(threads_mutex_);
        // Clean up finished threads
        connection_threads_.erase(
            std::remove_if(connection_threads_.begin(), connection_threads_.end(),
                [](std::thread& t) {
                    if (t.joinable()) {
                        // Simple approach: try_join is not standard, so we skip cleanup here.
                        // Threads self-terminate; we clean up on stopListener().
                        return false;
                    }
                    return true;
                }),
            connection_threads_.end());

        connection_threads_.emplace_back(&WebSocketProxy::handleConnection, this, client_fd);
    }
}

// ─── Single connection handler ───────────────────────────────────────

void WebSocketProxy::handleConnection(int client_fd) {
    active_connections_++;

    // 1. Parse the HTTP upgrade request from the client
    auto [path, ws_key] = parseUpgradeRequest(client_fd);
    if (path.empty() || ws_key.empty()) {
        const char* bad = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n";
        ::send(client_fd, bad, strlen(bad), 0);
        ::close(client_fd);
        active_connections_--;
        return;
    }

    // 2. Resolve path → backend URL
    std::string backend_url;
    if (route_resolver_) {
        backend_url = route_resolver_(path);
    }
    if (backend_url.empty()) {
        const char* nf = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nNo backend for path";
        ::send(client_fd, nf, strlen(nf), 0);
        ::close(client_fd);
        active_connections_--;
        return;
    }

    // 3. Connect to backend
    int backend_fd = connectToBackend(backend_url);
    if (backend_fd < 0) {
        const char* bg = "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n";
        ::send(client_fd, bg, strlen(bg), 0);
        ::close(client_fd);
        active_connections_--;
        return;
    }

    // 4. Parse host from backend_url for the upgrade request
    // URL format: http://host:port or ws://host:port
    std::string host_part;
    std::string path_part = "/";
    {
        std::string url = backend_url;
        // Strip scheme
        auto scheme_end = url.find("://");
        if (scheme_end != std::string::npos) url = url.substr(scheme_end + 3);
        auto slash = url.find('/');
        if (slash != std::string::npos) {
            host_part = url.substr(0, slash);
            path_part = url.substr(slash);
        } else {
            host_part = url;
        }
    }

    // 5. Send WebSocket upgrade to backend
    if (!upgradeBackend(backend_fd, host_part, path_part, ws_key)) {
        const char* bg = "HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n";
        ::send(client_fd, bg, strlen(bg), 0);
        ::close(backend_fd);
        ::close(client_fd);
        active_connections_--;
        return;
    }

    // 6. Send 101 to client
    std::string accept_key = generateAcceptKey(ws_key);
    std::string upgrade_resp =
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: " + accept_key + "\r\n"
        "\r\n";
    ::send(client_fd, upgrade_resp.c_str(), upgrade_resp.size(), 0);

    // 7. Relay frames bidirectionally
    relayFrames(client_fd, backend_fd);

    ::close(backend_fd);
    ::close(client_fd);
    active_connections_--;
}

std::pair<std::string, std::string> WebSocketProxy::parseUpgradeRequest(int fd) {
    // Read the HTTP request (max 8KB for the upgrade request)
    char buf[8192];
    std::string data;

    // Set a read timeout of 5 seconds
    struct timeval tv{5, 0};
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    while (data.size() < sizeof(buf)) {
        ssize_t n = ::recv(fd, buf, sizeof(buf) - 1, 0);
        if (n <= 0) break;
        data.append(buf, static_cast<size_t>(n));
        if (data.find("\r\n\r\n") != std::string::npos) break;
    }

    if (data.empty()) return {};

    // Parse first line: "GET /path HTTP/1.1\r\n"
    auto first_line_end = data.find("\r\n");
    if (first_line_end == std::string::npos) return {};

    std::string first_line = data.substr(0, first_line_end);
    // Expect "GET <path> HTTP/1.1"
    if (first_line.substr(0, 4) != "GET ") return {};
    auto space = first_line.find(' ', 4);
    if (space == std::string::npos) return {};
    std::string path = first_line.substr(4, space - 4);

    // Parse headers
    std::string ws_key;
    std::string headers_part = data.substr(first_line_end + 2);
    std::istringstream iss(headers_part);
    std::string line;
    bool has_upgrade = false;

    while (std::getline(iss, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) break;

        auto colon = line.find(':');
        if (colon == std::string::npos) continue;

        std::string name = line.substr(0, colon);
        std::string value = line.substr(colon + 1);
        // Trim leading spaces
        while (!value.empty() && value[0] == ' ') value.erase(value.begin());

        // Case-insensitive compare for header names
        std::string lower_name = name;
        std::transform(lower_name.begin(), lower_name.end(), lower_name.begin(), ::tolower);

        if (lower_name == "sec-websocket-key") {
            ws_key = value;
        } else if (lower_name == "upgrade" && value == "websocket") {
            has_upgrade = true;
        }
    }

    if (!has_upgrade || ws_key.empty()) return {};
    return {path, ws_key};
}

int WebSocketProxy::connectToBackend(const std::string& url) {
    // Parse URL: http://host:port or ws://host:port
    std::string work = url;
    auto scheme_end = work.find("://");
    if (scheme_end != std::string::npos) work = work.substr(scheme_end + 3);

    // Strip path
    auto slash = work.find('/');
    if (slash != std::string::npos) work = work.substr(0, slash);

    std::string host;
    int port = 80;
    auto colon = work.find(':');
    if (colon != std::string::npos) {
        host = work.substr(0, colon);
        port = std::stoi(work.substr(colon + 1));
    } else {
        host = work;
    }

    struct addrinfo hints{}, *res = nullptr;
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;

    if (getaddrinfo(host.c_str(), std::to_string(port).c_str(), &hints, &res) != 0 || !res) {
        return -1;
    }

    int fd = ::socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (fd < 0) {
        freeaddrinfo(res);
        return -1;
    }

    // Set connect timeout
    struct timeval tv{5, 0};
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    if (::connect(fd, res->ai_addr, res->ai_addrlen) < 0) {
        ::close(fd);
        freeaddrinfo(res);
        return -1;
    }

    freeaddrinfo(res);
    return fd;
}

bool WebSocketProxy::upgradeBackend(int backend_fd, const std::string& host,
                                    const std::string& path, const std::string& /*client_key*/) {
    // Send a WebSocket upgrade request to the backend
    // Use a fresh key for the backend connection
    std::string backend_key = "dGhlIHNhbXBsZSBub25jZQ=="; // standard test key

    std::string req =
        "GET " + path + " HTTP/1.1\r\n"
        "Host: " + host + "\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: " + backend_key + "\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n";

    ssize_t sent = ::send(backend_fd, req.c_str(), req.size(), 0);
    if (sent <= 0) return false;

    // Read the 101 response
    char buf[4096];
    std::string response;
    while (response.size() < sizeof(buf)) {
        ssize_t n = ::recv(backend_fd, buf, sizeof(buf) - 1, 0);
        if (n <= 0) return false;
        response.append(buf, static_cast<size_t>(n));
        if (response.find("\r\n\r\n") != std::string::npos) break;
    }

    // Check for 101
    return response.find("101") != std::string::npos;
}

void WebSocketProxy::relayFrames(int client_fd, int backend_fd) {
    // Bidirectional relay using select()
    char buf[65536]; // Max WebSocket frame payload size for most uses

    while (running_.load()) {
        fd_set readfds;
        FD_ZERO(&readfds);
        FD_SET(client_fd, &readfds);
        FD_SET(backend_fd, &readfds);

        int maxfd = std::max(client_fd, backend_fd) + 1;

        struct timeval tv{1, 0}; // 1 second timeout for checking running_ flag
        int sel = ::select(maxfd, &readfds, nullptr, nullptr, &tv);
        if (sel < 0) break;
        if (sel == 0) continue; // timeout, loop to check running_

        // Client -> Backend
        if (FD_ISSET(client_fd, &readfds)) {
            ssize_t n = ::recv(client_fd, buf, sizeof(buf), 0);
            if (n <= 0) break; // connection closed or error
            ssize_t total_sent = 0;
            while (total_sent < n) {
                ssize_t s = ::send(backend_fd, buf + total_sent, static_cast<size_t>(n - total_sent), 0);
                if (s <= 0) return; // backend write error
                total_sent += s;
            }
        }

        // Backend -> Client
        if (FD_ISSET(backend_fd, &readfds)) {
            ssize_t n = ::recv(backend_fd, buf, sizeof(buf), 0);
            if (n <= 0) break; // connection closed or error
            ssize_t total_sent = 0;
            while (total_sent < n) {
                ssize_t s = ::send(client_fd, buf + total_sent, static_cast<size_t>(n - total_sent), 0);
                if (s <= 0) return; // client write error
                total_sent += s;
            }
        }
    }
}

std::string WebSocketProxy::generateAcceptKey(const std::string& client_key) {
    const std::string magic_string = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    std::string combined = client_key + magic_string;

    unsigned char hash[SHA_DIGEST_LENGTH];
    SHA1(reinterpret_cast<const unsigned char*>(combined.c_str()),
         combined.length(), hash);

    BIO* b64 = BIO_new(BIO_f_base64());
    BIO* bmem = BIO_new(BIO_s_mem());
    b64 = BIO_push(b64, bmem);
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    BIO_write(b64, hash, SHA_DIGEST_LENGTH);
    BIO_flush(b64);

    BUF_MEM* bptr;
    BIO_get_mem_ptr(b64, &bptr);

    std::string result(bptr->data, bptr->length);
    BIO_free_all(b64);

    return result;
}

} // namespace gateway
