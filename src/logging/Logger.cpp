#include "Logger.h"
#include <iomanip>
#include <sstream>

namespace gateway {

Logger::Logger(
    const std::string& log_file,
    size_t max_file_size,
    size_t max_files,
    bool async
) : async_(async) {
    try {
        if (async) {
            // Create async logger with thread pool
            spdlog::init_thread_pool(8192, 1);

            auto file_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
                log_file, max_file_size, max_files
            );

            auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();

            std::vector<spdlog::sink_ptr> sinks{file_sink, console_sink};

            logger_ = std::make_shared<spdlog::async_logger>(
                "gateway",
                sinks.begin(),
                sinks.end(),
                spdlog::thread_pool(),
                spdlog::async_overflow_policy::block
            );
        } else {
            // Create synchronous logger
            auto file_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
                log_file, max_file_size, max_files
            );

            auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();

            logger_ = std::make_shared<spdlog::logger>(
                "gateway",
                spdlog::sinks_init_list{file_sink, console_sink}
            );
        }

        spdlog::register_logger(logger_);
        logger_->set_level(spdlog::level::info);
        logger_->flush_on(spdlog::level::err);

    } catch (const spdlog::spdlog_ex& ex) {
        std::cerr << "Logger initialization failed: " << ex.what() << "\n";
    }
}

Logger::~Logger() {
    if (logger_) {
        logger_->flush();
    }
    spdlog::shutdown();
}

void Logger::setLevel(LogLevel level) {
    if (!logger_) return;

    switch (level) {
        case LogLevel::DEBUG:
            logger_->set_level(spdlog::level::debug);
            break;
        case LogLevel::INFO:
            logger_->set_level(spdlog::level::info);
            break;
        case LogLevel::WARN:
            logger_->set_level(spdlog::level::warn);
            break;
        case LogLevel::ERROR:
            logger_->set_level(spdlog::level::err);
            break;
    }
}

void Logger::logRequest(
    const std::string& request_id,
    const std::string& client_ip,
    const std::string& method,
    const std::string& path,
    int status,
    long response_time_ms,
    const std::string& user_id,
    const std::string& backend,
    const std::string& error
) {
    json log_entry;
    log_entry["timestamp"] = getTimestamp();
    log_entry["request_id"] = request_id;
    log_entry["client_ip"] = client_ip;
    log_entry["method"] = method;
    log_entry["path"] = path;
    log_entry["status"] = status;
    log_entry["response_time_ms"] = response_time_ms;

    if (!user_id.empty()) {
        log_entry["user_id"] = user_id;
    }

    if (!backend.empty()) {
        log_entry["backend"] = backend;
    }

    if (!error.empty()) {
        log_entry["error"] = error;
    }

    if (logger_) {
        logger_->info(log_entry.dump());
    }
}

void Logger::info(const std::string& message, const json& context) {
    if (!logger_) return;

    std::string log_msg = createLogEntry("INFO", message, context);
    logger_->info(log_msg);
}

void Logger::warn(const std::string& message, const json& context) {
    if (!logger_) return;

    std::string log_msg = createLogEntry("WARN", message, context);
    logger_->warn(log_msg);
}

void Logger::error(const std::string& message, const json& context) {
    if (!logger_) return;

    std::string log_msg = createLogEntry("ERROR", message, context);
    logger_->error(log_msg);
}

void Logger::debug(const std::string& message, const json& context) {
    if (!logger_) return;

    std::string log_msg = createLogEntry("DEBUG", message, context);
    logger_->debug(log_msg);
}

void Logger::flush() {
    if (logger_) {
        logger_->flush();
    }
}

std::string Logger::createLogEntry(
    const std::string& level,
    const std::string& message,
    const json& context
) {
    json log_entry;
    log_entry["timestamp"] = getTimestamp();
    log_entry["level"] = level;
    log_entry["message"] = message;

    if (!context.empty()) {
        log_entry["context"] = context;
    }

    return log_entry.dump();
}

std::string Logger::getTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto time_t_now = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ) % 1000;

    std::stringstream ss;
    ss << std::put_time(std::gmtime(&time_t_now), "%Y-%m-%dT%H:%M:%S");
    ss << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z';

    return ss.str();
}

} // namespace gateway
