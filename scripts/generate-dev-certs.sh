#!/usr/bin/env bash
# =============================================================================
# Generate self-signed TLS certificates for development/staging
# Usage: ./scripts/generate-dev-certs.sh [domain]
# =============================================================================
set -euo pipefail

DOMAIN="${1:-localhost}"
CERTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
DAYS_VALID=365

echo "==> Generating self-signed TLS certificates for: ${DOMAIN}"
echo "    Output directory: ${CERTS_DIR}"

mkdir -p "${CERTS_DIR}"

# Generate CA private key
openssl genrsa -out "${CERTS_DIR}/ca.key" 4096 2>/dev/null

# Generate CA certificate
openssl req -new -x509 -days "${DAYS_VALID}" \
  -key "${CERTS_DIR}/ca.key" \
  -out "${CERTS_DIR}/ca.crt" \
  -subj "/C=US/ST=California/L=SanFrancisco/O=APIGateway-Dev/OU=Engineering/CN=API Gateway Dev CA" \
  2>/dev/null

# Generate server private key
openssl genrsa -out "${CERTS_DIR}/server.key" 2048 2>/dev/null

# Create certificate signing request with SANs
cat > "${CERTS_DIR}/server.cnf" <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = California
L = San Francisco
O = API Gateway
OU = Engineering
CN = ${DOMAIN}

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = *.${DOMAIN}
DNS.3 = localhost
DNS.4 = api-gateway
DNS.5 = gateway
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
IP.3 = ::1
EOF

# Generate CSR
openssl req -new \
  -key "${CERTS_DIR}/server.key" \
  -out "${CERTS_DIR}/server.csr" \
  -config "${CERTS_DIR}/server.cnf" \
  2>/dev/null

# Sign server certificate with CA
openssl x509 -req \
  -in "${CERTS_DIR}/server.csr" \
  -CA "${CERTS_DIR}/ca.crt" \
  -CAkey "${CERTS_DIR}/ca.key" \
  -CAcreateserial \
  -out "${CERTS_DIR}/server.crt" \
  -days "${DAYS_VALID}" \
  -extensions v3_req \
  -extfile "${CERTS_DIR}/server.cnf" \
  2>/dev/null

# Create fullchain (server cert + CA cert)
cat "${CERTS_DIR}/server.crt" "${CERTS_DIR}/ca.crt" > "${CERTS_DIR}/fullchain.pem"

# Create combined PEM (for tools that need key + cert in one file)
cat "${CERTS_DIR}/server.key" "${CERTS_DIR}/server.crt" > "${CERTS_DIR}/combined.pem"

# Set secure permissions
chmod 600 "${CERTS_DIR}/server.key" "${CERTS_DIR}/ca.key" "${CERTS_DIR}/combined.pem"
chmod 644 "${CERTS_DIR}/server.crt" "${CERTS_DIR}/ca.crt" "${CERTS_DIR}/fullchain.pem"

# Clean up intermediate files
rm -f "${CERTS_DIR}/server.csr" "${CERTS_DIR}/server.cnf" "${CERTS_DIR}/ca.srl"

echo ""
echo "==> Certificates generated successfully:"
echo "    CA Certificate:     ${CERTS_DIR}/ca.crt"
echo "    Server Certificate: ${CERTS_DIR}/server.crt"
echo "    Server Key:         ${CERTS_DIR}/server.key"
echo "    Full Chain:         ${CERTS_DIR}/fullchain.pem"
echo ""
echo "    Valid for: ${DAYS_VALID} days"
echo "    Domain:   ${DOMAIN} (+ localhost, api-gateway)"
echo ""
echo "    To trust the CA on macOS:"
echo "      sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CERTS_DIR}/ca.crt"
echo ""
echo "    To use with gateway, set in config:"
echo '      "tls": { "enabled": true, "cert_file": "certs/fullchain.pem", "key_file": "certs/server.key" }'
