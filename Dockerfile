# Multi-stage Dockerfile for High-Performance API Gateway
FROM ubuntu:22.04 AS builder

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libssl-dev \
    uuid-dev \
    pkg-config \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy source code
COPY . .

# Build the gateway
RUN mkdir -p build && \
    cd build && \
    cmake .. && \
    make -j$(nproc)

# Production stage
FROM ubuntu:22.04

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libssl3 \
    uuid-runtime \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r gateway && useradd -r -g gateway gateway

# Create directories
RUN mkdir -p /etc/api-gateway/certs \
             /var/log/api-gateway \
             /app && \
    chown -R gateway:gateway /var/log/api-gateway /app

# Copy binary from builder
COPY --from=builder /build/build/api-gateway /app/api-gateway

# Copy configuration templates
COPY --from=builder /build/config/*.json /etc/api-gateway/

# Set working directory
WORKDIR /app

# Switch to non-root user
USER gateway

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the gateway
CMD ["/app/api-gateway", "--config", "/etc/api-gateway/gateway.json", "--routes", "/etc/api-gateway/routes.json"]
