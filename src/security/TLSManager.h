#pragma once

#include <string>
#include <openssl/ssl.h>
#include <openssl/err.h>

namespace gateway {

/**
 * @brief TLS/SSL Manager
 *
 * Manages SSL/TLS certificates and encryption
 */
class TLSManager {
public:
    /**
     * @brief Constructor
     */
    TLSManager();

    /**
     * @brief Destructor
     */
    ~TLSManager();

    /**
     * @brief Initialize TLS context
     * @param cert_file Path to certificate file
     * @param key_file Path to private key file
     * @return true if initialization successful
     */
    bool initialize(const std::string& cert_file, const std::string& key_file);

    /**
     * @brief Verify certificate
     * @param cert_file Certificate file path
     * @return true if valid
     */
    bool verifyCertificate(const std::string& cert_file);

    /**
     * @brief Get SSL context
     */
    SSL_CTX* getContext() const { return ctx_; }

private:
    SSL_CTX* ctx_;

    /**
     * @brief Initialize OpenSSL library
     */
    void initializeOpenSSL();

    /**
     * @brief Cleanup OpenSSL library
     */
    void cleanupOpenSSL();
};

} // namespace gateway
