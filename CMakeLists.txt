cmake_minimum_required(VERSION 3.25)
project(APIGateway VERSION 1.0.0 LANGUAGES CXX)

# Set policy for FetchContent timestamps
if(POLICY CMP0135)
    cmake_policy(SET CMP0135 NEW)
endif()

# Set C++17 standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler flags
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -O3 -pthread")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0 -fsanitize=address -fno-omit-frame-pointer")

# Find required packages
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)

# External dependencies via FetchContent
include(FetchContent)

# cpp-httplib for HTTP server
FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.15.3
)

# nlohmann/json for JSON parsing - fetch first so jwt-cpp can find it
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(json)

# Make nlohmann_json available to jwt-cpp
set(nlohmann_json_DIR ${json_BINARY_DIR})

# jwt-cpp for JWT handling
set(JWT_BUILD_EXAMPLES OFF)
FetchContent_Declare(
    jwt-cpp
    GIT_REPOSITORY https://github.com/Thalhammer/jwt-cpp.git
    GIT_TAG v0.6.0
)

# spdlog for logging
FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.13.0
)

# Google Test for testing
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.14.0
)

FetchContent_MakeAvailable(httplib jwt-cpp spdlog googletest)

# Get httplib source directory
FetchContent_GetProperties(httplib)

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/src
    ${OPENSSL_INCLUDE_DIR}
    ${httplib_SOURCE_DIR}
)

# Source files
set(GATEWAY_SOURCES
    src/main.cpp
    src/server/HttpServer.cpp
    src/auth/JWTManager.cpp
    src/rate_limiter/RateLimiter.cpp
    src/router/Router.cpp
    src/router/ProxyManager.cpp
    src/security/SecurityValidator.cpp
    src/security/TLSManager.cpp
    src/logging/Logger.cpp
    src/config/ConfigManager.cpp
)

# Main executable
add_executable(api-gateway ${GATEWAY_SOURCES})

target_link_libraries(api-gateway
    PRIVATE
        OpenSSL::SSL
        OpenSSL::Crypto
        Threads::Threads
        nlohmann_json::nlohmann_json
        jwt-cpp::jwt-cpp
        spdlog::spdlog
)

# Enable testing
enable_testing()

# Test executable
add_executable(gateway-tests
    tests/test_jwt.cpp
    tests/test_rate_limiter.cpp
    tests/test_router.cpp
    tests/test_security.cpp
    tests/test_http_parser.cpp
    src/auth/JWTManager.cpp
    src/rate_limiter/RateLimiter.cpp
    src/router/Router.cpp
    src/security/SecurityValidator.cpp
    src/logging/Logger.cpp
    src/config/ConfigManager.cpp
)

target_link_libraries(gateway-tests
    PRIVATE
        GTest::gtest_main
        OpenSSL::SSL
        OpenSSL::Crypto
        Threads::Threads
        nlohmann_json::nlohmann_json
        jwt-cpp::jwt-cpp
        spdlog::spdlog
)

include(GoogleTest)
gtest_discover_tests(gateway-tests)

# Installation
install(TARGETS api-gateway DESTINATION bin)
install(DIRECTORY config/ DESTINATION etc/api-gateway)
