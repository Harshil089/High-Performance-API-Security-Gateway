#pragma once

#include <string>
#include <nlohmann/json.hpp>
#include <fstream>
#include <sstream>

namespace gateway {

using json = nlohmann::json;

/**
 * @brief Configuration Manager
 *
 * Loads and manages gateway configuration
 * Supports environment variable substitution
 */
class ConfigManager {
public:
    /**
     * @brief Load configuration from file
     * @param config_file Path to configuration file
     * @return true if loaded successfully
     */
    static bool loadConfig(const std::string& config_file, json& config);

    /**
     * @brief Load routes configuration
     * @param routes_file Path to routes file
     * @return true if loaded successfully
     */
    static bool loadRoutes(const std::string& routes_file, json& routes);

    /**
     * @brief Expand environment variables in string
     * @param input String with ${VAR_NAME} placeholders
     * @return Expanded string
     */
    static std::string expandEnvVars(const std::string& input);

    /**
     * @brief Get environment variable
     * @param var_name Variable name
     * @param default_value Default value if not found
     * @return Variable value
     */
    static std::string getEnvVar(const std::string& var_name, const std::string& default_value = "");

    /**
     * @brief Recursively expand environment variables in JSON
     */
    static void expandJsonEnvVars(json& j);

private:
    /**
     * @brief Read file contents
     */
    static std::string readFile(const std::string& file_path);
};

} // namespace gateway
