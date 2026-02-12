#include "ConfigManager.h"
#include <iostream>
#include <cstdlib>

namespace gateway {

bool ConfigManager::loadConfig(const std::string& config_file, json& config) {
    try {
        std::string content = readFile(config_file);
        config = json::parse(content);

        // Expand environment variables
        expandJsonEnvVars(config);

        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error loading config: " << e.what() << "\n";
        return false;
    }
}

bool ConfigManager::loadRoutes(const std::string& routes_file, json& routes) {
    try {
        std::string content = readFile(routes_file);
        routes = json::parse(content);

        // Expand environment variables
        expandJsonEnvVars(routes);

        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error loading routes: " << e.what() << "\n";
        return false;
    }
}

std::string ConfigManager::expandEnvVars(const std::string& input) {
    std::string result = input;
    size_t pos = 0;

    while ((pos = result.find("${", pos)) != std::string::npos) {
        size_t end_pos = result.find("}", pos);
        if (end_pos == std::string::npos) {
            break;
        }

        std::string var_name = result.substr(pos + 2, end_pos - pos - 2);
        std::string var_value = getEnvVar(var_name);

        result.replace(pos, end_pos - pos + 1, var_value);
        pos += var_value.length();
    }

    return result;
}

std::string ConfigManager::getEnvVar(const std::string& var_name, const std::string& default_value) {
    const char* value = std::getenv(var_name.c_str());
    if (value != nullptr) {
        return std::string(value);
    }
    return default_value;
}

void ConfigManager::expandJsonEnvVars(json& j) {
    if (j.is_string()) {
        std::string value = j.get<std::string>();
        j = expandEnvVars(value);
    } else if (j.is_object()) {
        for (auto& [key, value] : j.items()) {
            expandJsonEnvVars(value);
        }
    } else if (j.is_array()) {
        for (auto& element : j) {
            expandJsonEnvVars(element);
        }
    }
}

std::string ConfigManager::readFile(const std::string& file_path) {
    std::ifstream file(file_path);
    if (!file.is_open()) {
        throw std::runtime_error("Could not open file: " + file_path);
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

} // namespace gateway
