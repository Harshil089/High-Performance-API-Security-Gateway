# Multi-stage Dockerfile for High-Performance API Gateway
FROM ubuntu:22.04 AS builder

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    libssl-dev \
    uuid-dev \
    pkg-config \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install CMake 3.25+ from Kitware's repository
RUN wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | tee /usr/share/keyrings/kitware-archive-keyring.gpg >/dev/null && \
    echo 'deb [signed-by=/usr/share/keyrings/kitware-archive-keyring.gpg] https://apt.kitware.com/ubuntu/ jammy main' | tee /etc/apt/sources.list.d/kitware.list >/dev/null && \
    apt-get update && \
    apt-get install -y cmake && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy source code
COPY . .

# Build the gateway
ARG BUILD_TYPE=Release
RUN mkdir -p build && \
    cd build && \
    cmake -DCMAKE_BUILD_TYPE=${BUILD_TYPE} .. && \
    make -j$(nproc)

# Production stage
FROM ubuntu:22.04

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libssl3 \
    uuid-runtime \
    ca-certificates \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r gateway && useradd -r -g gateway gateway

# Create directories
RUN mkdir -p /app/config \
             /app/logs \
             /app/certs && \
    chown -R gateway:gateway /app

# Copy binary from builder
COPY --from=builder /build/build/api-gateway /app/api-gateway

# Copy configuration files
COPY --chown=gateway:gateway config/*.json /app/config/

# Set working directory
WORKDIR /app

# Switch to non-root user
USER gateway

# Expose ports
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Run the gateway - use Docker-specific routes if available, fallback to routes.json
CMD ["/app/api-gateway", "--config", "/app/config/gateway.json", "--routes", "/app/config/routes.docker.json"]
