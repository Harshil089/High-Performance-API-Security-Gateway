#!/usr/bin/env bash
# =============================================================================
# Let's Encrypt Certificate Setup for Production
# Usage: ./scripts/setup-letsencrypt.sh <domain> [email]
#
# Prerequisites:
#   - Domain DNS must point to this server's public IP
#   - Port 80 must be accessible (for HTTP-01 challenge)
#   - certbot must be installed (apt install certbot)
#
# This script:
#   1. Obtains certificates via Let's Encrypt
#   2. Copies them to the gateway certs directory
#   3. Sets up auto-renewal via cron
# =============================================================================
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> [email]}"
EMAIL="${2:-admin@${DOMAIN}}"
CERTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
LE_DIR="/etc/letsencrypt/live/${DOMAIN}"

echo "==> Let's Encrypt Certificate Setup"
echo "    Domain: ${DOMAIN}"
echo "    Email:  ${EMAIL}"
echo ""

# Check if certbot is installed
if ! command -v certbot &>/dev/null; then
    echo "ERROR: certbot is not installed."
    echo ""
    echo "Install it with:"
    echo "  Ubuntu/Debian: sudo apt update && sudo apt install -y certbot"
    echo "  CentOS/RHEL:   sudo yum install -y certbot"
    echo "  macOS:          brew install certbot"
    exit 1
fi

# Check if running as root (required for certbot)
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run as root (required by certbot)"
    echo "  sudo $0 ${DOMAIN} ${EMAIL}"
    exit 1
fi

# Stop gateway temporarily if running on port 80 (for standalone mode)
GATEWAY_PID=$(lsof -ti:80 2>/dev/null || true)
if [ -n "${GATEWAY_PID}" ]; then
    echo "==> Port 80 is in use (PID: ${GATEWAY_PID}). Stopping temporarily..."
    echo "    NOTE: If this is your gateway or web server, it will be stopped briefly."
    read -rp "    Continue? [y/N] " confirm
    if [[ "${confirm}" != [yY] ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Obtain certificate
echo "==> Requesting certificate from Let's Encrypt..."
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    --domain "${DOMAIN}" \
    --preferred-challenges http

# Verify certificate was obtained
if [ ! -f "${LE_DIR}/fullchain.pem" ]; then
    echo "ERROR: Certificate files not found at ${LE_DIR}"
    echo "       Check certbot logs: /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi

# Copy certificates to gateway certs directory
echo "==> Copying certificates to ${CERTS_DIR}..."
mkdir -p "${CERTS_DIR}"
cp "${LE_DIR}/fullchain.pem" "${CERTS_DIR}/fullchain.pem"
cp "${LE_DIR}/privkey.pem" "${CERTS_DIR}/server.key"
cp "${LE_DIR}/cert.pem" "${CERTS_DIR}/server.crt"
cp "${LE_DIR}/chain.pem" "${CERTS_DIR}/ca.crt"

# Set permissions
chmod 644 "${CERTS_DIR}/fullchain.pem" "${CERTS_DIR}/server.crt" "${CERTS_DIR}/ca.crt"
chmod 600 "${CERTS_DIR}/server.key"

# Setup auto-renewal hook to copy certs and reload gateway
RENEWAL_HOOK="/etc/letsencrypt/renewal-hooks/deploy/api-gateway-reload.sh"
echo "==> Setting up auto-renewal hook..."
cat > "${RENEWAL_HOOK}" <<HOOK
#!/usr/bin/env bash
# Auto-renewal hook: copy new certs and reload gateway
CERTS_DIR="${CERTS_DIR}"
LE_DIR="${LE_DIR}"

cp "\${LE_DIR}/fullchain.pem" "\${CERTS_DIR}/fullchain.pem"
cp "\${LE_DIR}/privkey.pem" "\${CERTS_DIR}/server.key"
cp "\${LE_DIR}/cert.pem" "\${CERTS_DIR}/server.crt"
cp "\${LE_DIR}/chain.pem" "\${CERTS_DIR}/ca.crt"

chmod 644 "\${CERTS_DIR}/fullchain.pem" "\${CERTS_DIR}/server.crt" "\${CERTS_DIR}/ca.crt"
chmod 600 "\${CERTS_DIR}/server.key"

# Reload gateway (send SIGHUP or restart container)
if command -v docker &>/dev/null; then
    docker restart api-gateway 2>/dev/null || true
fi

logger "API Gateway: TLS certificates renewed for ${DOMAIN}"
HOOK
chmod +x "${RENEWAL_HOOK}"

# Test renewal (dry run)
echo "==> Testing auto-renewal (dry run)..."
certbot renew --dry-run --quiet 2>/dev/null && echo "    Renewal test passed." || echo "    WARNING: Renewal dry-run failed. Check certbot config."

echo ""
echo "==> Let's Encrypt setup complete!"
echo ""
echo "    Certificate:  ${CERTS_DIR}/fullchain.pem"
echo "    Private Key:  ${CERTS_DIR}/server.key"
echo "    CA Chain:     ${CERTS_DIR}/ca.crt"
echo ""
echo "    Auto-renewal: Certbot runs via systemd timer (certbot.timer)"
echo "    Renewal hook: ${RENEWAL_HOOK}"
echo ""
echo "    Verify renewal timer:"
echo "      systemctl list-timers certbot.timer"
echo ""
echo "    Update gateway config:"
echo '      "tls": { "enabled": true, "cert_file": "certs/fullchain.pem", "key_file": "certs/server.key" }'
