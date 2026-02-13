#!/bin/bash
# Security validation script for API Gateway production deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "=================================="
echo "API Gateway Security Check"
echo "=================================="
echo ""

# Function to print error
error() {
    echo -e "${RED}✗ ERROR: $1${NC}"
    ((ERRORS++))
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠ WARNING: $1${NC}"
    ((WARNINGS++))
}

# Function to print success
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check JWT_SECRET
echo "Checking JWT Configuration..."
if [ -z "$JWT_SECRET" ]; then
    error "JWT_SECRET environment variable is not set"
else
    SECRET_LENGTH=${#JWT_SECRET}
    if [ $SECRET_LENGTH -lt 32 ]; then
        error "JWT_SECRET is too short ($SECRET_LENGTH chars). Minimum 32 characters required."
    else
        success "JWT_SECRET length is adequate ($SECRET_LENGTH chars)"
    fi

    # Check for common test values
    if [[ "$JWT_SECRET" == *"test"* ]] || [[ "$JWT_SECRET" == *"demo"* ]] || [[ "$JWT_SECRET" == *"example"* ]]; then
        error "JWT_SECRET appears to be a test/demo value. Use a cryptographically secure random string."
    else
        success "JWT_SECRET doesn't contain obvious test patterns"
    fi
fi

# Check TLS configuration
echo ""
echo "Checking TLS/SSL Configuration..."
if [ -f "config/gateway.json" ]; then
    TLS_ENABLED=$(jq -r '.server.tls.enabled' config/gateway.json 2>/dev/null || echo "false")
    if [ "$TLS_ENABLED" == "true" ]; then
        success "TLS is enabled in configuration"

        CERT_FILE=$(jq -r '.server.tls.cert_file' config/gateway.json)
        KEY_FILE=$(jq -r '.server.tls.key_file' config/gateway.json)

        if [ ! -f "$CERT_FILE" ]; then
            error "Certificate file not found: $CERT_FILE"
        else
            success "Certificate file exists: $CERT_FILE"

            # Check certificate expiry
            if command -v openssl &> /dev/null; then
                EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
                EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null)
                NOW_EPOCH=$(date +%s)
                DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

                if [ $DAYS_LEFT -lt 0 ]; then
                    error "Certificate has expired!"
                elif [ $DAYS_LEFT -lt 30 ]; then
                    warning "Certificate expires in $DAYS_LEFT days"
                else
                    success "Certificate valid for $DAYS_LEFT more days"
                fi
            fi
        fi

        if [ ! -f "$KEY_FILE" ]; then
            error "Private key file not found: $KEY_FILE"
        else
            success "Private key file exists: $KEY_FILE"

            # Check key permissions
            KEY_PERMS=$(stat -c %a "$KEY_FILE" 2>/dev/null || stat -f %A "$KEY_FILE" 2>/dev/null)
            if [ "$KEY_PERMS" != "600" ] && [ "$KEY_PERMS" != "400" ]; then
                warning "Private key permissions are $KEY_PERMS, should be 600 or 400"
            else
                success "Private key has secure permissions ($KEY_PERMS)"
            fi
        fi
    else
        warning "TLS is NOT enabled. This is insecure for production!"
    fi
else
    error "Configuration file not found: config/gateway.json"
fi

# Check CORS configuration
echo ""
echo "Checking CORS Configuration..."
if [ -f "config/gateway.json" ]; then
    CORS_ORIGINS=$(jq -r '.security.cors.allowed_origins[]' config/gateway.json 2>/dev/null)
    if echo "$CORS_ORIGINS" | grep -q '\*'; then
        error "CORS allows all origins (*). This is insecure for production!"
    else
        success "CORS is properly restricted"
        echo "  Allowed origins: $CORS_ORIGINS"
    fi
fi

# Check file permissions
echo ""
echo "Checking File Permissions..."
if [ -f "config/gateway.json" ]; then
    CONFIG_PERMS=$(stat -c %a "config/gateway.json" 2>/dev/null || stat -f %A "config/gateway.json" 2>/dev/null)
    if [ "$CONFIG_PERMS" -gt "600" ]; then
        warning "Configuration file permissions are $CONFIG_PERMS, consider 600 for better security"
    else
        success "Configuration file has secure permissions ($CONFIG_PERMS)"
    fi
fi

# Check for default credentials
echo ""
echo "Checking for Default Credentials..."
if [ -f "mock-services/auth-service.js" ]; then
    if grep -q "demo_admin\|demo_user" mock-services/auth-service.js; then
        if [ "${NODE_ENV}" == "production" ]; then
            error "Demo credentials found in production environment"
        else
            warning "Demo credentials present (acceptable for development)"
        fi
    fi
fi

# Check rate limiting configuration
echo ""
echo "Checking Rate Limiting..."
if [ -f "config/gateway.json" ]; then
    LOGIN_RATE=$(jq -r '.rate_limits.endpoints["/api/auth/login"].requests' config/gateway.json 2>/dev/null)
    if [ "$LOGIN_RATE" -gt 10 ]; then
        warning "Login endpoint allows $LOGIN_RATE requests per window. Consider reducing for brute force protection."
    else
        success "Login rate limit is appropriately restrictive ($LOGIN_RATE requests)"
    fi
fi

# Check security headers
echo ""
echo "Checking Security Headers..."
if [ -f "config/gateway.json" ]; then
    if jq -e '.security.headers' config/gateway.json > /dev/null 2>&1; then
        success "Security headers are configured"

        # Check for important headers
        if jq -e '.security.headers.strict_transport_security' config/gateway.json > /dev/null 2>&1; then
            success "HSTS header is configured"
        else
            warning "HSTS header not configured (important for HTTPS sites)"
        fi

        if jq -e '.security.headers.x_frame_options' config/gateway.json > /dev/null 2>&1; then
            success "X-Frame-Options header is configured"
        else
            warning "X-Frame-Options header not configured (protects against clickjacking)"
        fi
    else
        warning "Security headers are not configured"
    fi
fi

# Check environment
echo ""
echo "Checking Environment..."
if [ "$NODE_ENV" == "production" ]; then
    success "NODE_ENV is set to production"
else
    warning "NODE_ENV is not set to production (current: ${NODE_ENV:-not set})"
fi

# Check for .env file
if [ -f ".env" ]; then
    warning ".env file exists. Ensure it's not committed to version control"
    if git ls-files --error-unmatch .env > /dev/null 2>&1; then
        error ".env file is tracked by git! This is a security risk!"
    else
        success ".env file is not tracked by git"
    fi
fi

# Summary
echo ""
echo "=================================="
echo "Security Check Summary"
echo "=================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo "Review warnings before deploying to production"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo "Fix all errors before deploying to production!"
    exit 1
fi
