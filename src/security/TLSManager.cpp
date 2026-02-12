#include "TLSManager.h"
#include <iostream>

namespace gateway {

TLSManager::TLSManager() : ctx_(nullptr) {
    initializeOpenSSL();
}

TLSManager::~TLSManager() {
    if (ctx_) {
        SSL_CTX_free(ctx_);
    }
    cleanupOpenSSL();
}

bool TLSManager::initialize(const std::string& cert_file, const std::string& key_file) {
    // Create SSL context
    const SSL_METHOD* method = TLS_server_method();
    ctx_ = SSL_CTX_new(method);

    if (!ctx_) {
        std::cerr << "Unable to create SSL context\n";
        ERR_print_errors_fp(stderr);
        return false;
    }

    // Set minimum TLS version to 1.2
    SSL_CTX_set_min_proto_version(ctx_, TLS1_2_VERSION);

    // Load certificate
    if (SSL_CTX_use_certificate_file(ctx_, cert_file.c_str(), SSL_FILETYPE_PEM) <= 0) {
        std::cerr << "Error loading certificate file\n";
        ERR_print_errors_fp(stderr);
        return false;
    }

    // Load private key
    if (SSL_CTX_use_PrivateKey_file(ctx_, key_file.c_str(), SSL_FILETYPE_PEM) <= 0) {
        std::cerr << "Error loading private key file\n";
        ERR_print_errors_fp(stderr);
        return false;
    }

    // Verify private key
    if (!SSL_CTX_check_private_key(ctx_)) {
        std::cerr << "Private key does not match the certificate\n";
        return false;
    }

    // Set cipher suites (secure ciphers only)
    if (!SSL_CTX_set_cipher_list(ctx_, "HIGH:!aNULL:!MD5:!RC4")) {
        std::cerr << "Error setting cipher list\n";
        return false;
    }

    return true;
}

bool TLSManager::verifyCertificate(const std::string& cert_file) {
    FILE* fp = fopen(cert_file.c_str(), "r");
    if (!fp) {
        return false;
    }

    X509* cert = PEM_read_X509(fp, nullptr, nullptr, nullptr);
    fclose(fp);

    if (!cert) {
        return false;
    }

    // Basic verification - check if certificate can be loaded
    X509_free(cert);
    return true;
}

void TLSManager::initializeOpenSSL() {
    SSL_load_error_strings();
    OpenSSL_add_ssl_algorithms();
}

void TLSManager::cleanupOpenSSL() {
    EVP_cleanup();
}

} // namespace gateway
