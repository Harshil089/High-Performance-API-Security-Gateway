#pragma once

#include <string>
#include <memory>
#include <spdlog/spdlog.h>
#include <spdlog/async.h>
#include <spdlog/sinks/rotating_file_sink.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <nlohmann/json.hpp>

namespace gateway {

using json = nlohmann::json;

/**
 * @brief Log levels
 */
enum class LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
};

/**
 * @brief Async Logger with structured JSON logging
 *
 * Features:
 * - Non-blocking async logging
 * - Structured JSON format
 * - Log rotation
 * - Sensitive data masking
 */
class Logger {
public:
    /**
     * @brief Constructor
     * @param log_file Path to log file
     * @param max_file_size Maximum file size before rotation
     * @param max_files Maximum number of rotated files
     * @param async Enable async logging
     */
    Logger(
        const std::string& log_file = "logs/gateway.log",
        size_t max_file_size = 104857600,  // 100MB
        size_t max_files = 10,
        bool async = true
    );

    /**
     * @brief Destructor
     */
    ~Logger();

    /**
     * @brief Set log level
     */
    void setLevel(LogLevel level);

    /**
     * @brief Log request
     */
    void logRequest(
        const std::string& request_id,
        const std::string& client_ip,
        const std::string& method,
        const std::string& path,
        int status,
        long response_time_ms,
        const std::string& user_id = "",
        const std::string& backend = "",
        const std::string& error = ""
    );

    /**
     * @brief Log info message
     */
    void info(const std::string& message, const json& context = {});

    /**
     * @brief Log warning message
     */
    void warn(const std::string& message, const json& context = {});

    /**
     * @brief Log error message
     */
    void error(const std::string& message, const json& context = {});

    /**
     * @brief Log debug message
     */
    void debug(const std::string& message, const json& context = {});

    /**
     * @brief Flush all pending logs
     */
    void flush();

private:
    std::shared_ptr<spdlog::logger> logger_;
    bool async_;

    /**
     * @brief Create JSON log entry
     */
    std::string createLogEntry(const std::string& level, const std::string& message, const json& context);

    /**
     * @brief Get ISO 8601 timestamp
     */
    std::string getTimestamp();
};

} // namespace gateway
