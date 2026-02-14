#include "router/WebSocketProxy.h"
#include <openssl/sha.h>
#include <openssl/bio.h>
#include <openssl/evp.h>
#include <openssl/buffer.h>
#include <iostream>
#include <cstring>

namespace gateway {

bool WebSocketProxy::isWebSocketUpgrade(const httplib::Request& req) {
    // Check for WebSocket upgrade headers
    if (req.get_header_value("Upgrade") == "websocket" &&
        req.get_header_value("Connection").find("Upgrade") != std::string::npos &&
        req.has_header("Sec-WebSocket-Key") &&
        req.get_header_value("Sec-WebSocket-Version") == "13") {
        return true;
    }
    return false;
}

bool WebSocketProxy::handleWebSocketUpgrade(const httplib::Request& req, httplib::Response& res,
                                           const std::string& backend_url) {
    // Note: cpp-httplib doesn't have built-in WebSocket support
    // This is a simplified implementation that handles the upgrade response
    // For production, you'd need a full WebSocket library like websocketpp

    std::string client_key = req.get_header_value("Sec-WebSocket-Key");
    if (client_key.empty()) {
        res.status = 400;
        res.set_content("Bad Request: Missing Sec-WebSocket-Key", "text/plain");
        return false;
    }

    // Generate accept key
    std::string accept_key = generateAcceptKey(client_key);

    // Set WebSocket upgrade response headers
    res.status = 101; // Switching Protocols
    res.set_header("Upgrade", "websocket");
    res.set_header("Connection", "Upgrade");
    res.set_header("Sec-WebSocket-Accept", accept_key);

    // Copy protocol if requested
    if (req.has_header("Sec-WebSocket-Protocol")) {
        res.set_header("Sec-WebSocket-Protocol", req.get_header_value("Sec-WebSocket-Protocol"));
    }

    active_connections_++;

    std::cout << "WebSocket: Upgraded connection to " << backend_url
              << " (active: " << active_connections_ << ")" << std::endl;

    // Note: Actual WebSocket frame proxying would happen here
    // This requires low-level socket programming or a WebSocket library
    // For now, we just return the upgrade response

    return true;
}

std::string WebSocketProxy::generateAcceptKey(const std::string& client_key) {
    // WebSocket accept key = base64(SHA1(client_key + magic_string))
    const std::string magic_string = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    std::string combined = client_key + magic_string;

    // Compute SHA1
    unsigned char hash[SHA_DIGEST_LENGTH];
    SHA1(reinterpret_cast<const unsigned char*>(combined.c_str()),
         combined.length(), hash);

    // Base64 encode
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
