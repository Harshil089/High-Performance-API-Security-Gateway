#include <gtest/gtest.h>
#include "../src/router/Router.h"

using namespace gateway;

class RouterTest : public ::testing::Test {
protected:
    void SetUp() override {
        router = std::make_unique<Router>();
    }

    std::unique_ptr<Router> router;
};

TEST_F(RouterTest, MatchesExactPath) {
    Route route;
    route.path_pattern = "/api/users";
    route.backends.push_back("http://localhost:3000");

    router->addRoute(route);

    auto match = router->matchRoute("/api/users");
    ASSERT_TRUE(match.has_value());
    EXPECT_EQ(match->backend_url, "http://localhost:3000");
}

TEST_F(RouterTest, MatchesWildcardPath) {
    Route route;
    route.path_pattern = "/api/users/*";
    route.backends.push_back("http://localhost:3000");

    router->addRoute(route);

    auto match1 = router->matchRoute("/api/users/123");
    ASSERT_TRUE(match1.has_value());

    auto match2 = router->matchRoute("/api/users/123/profile");
    ASSERT_TRUE(match2.has_value());
}

TEST_F(RouterTest, ReturnsNulloptForUnmatchedPath) {
    Route route;
    route.path_pattern = "/api/users";
    route.backends.push_back("http://localhost:3000");

    router->addRoute(route);

    auto match = router->matchRoute("/api/products");
    EXPECT_FALSE(match.has_value());
}

TEST_F(RouterTest, LoadsRoutesFromJSON) {
    std::string routes_json = R"({
        "routes": [
            {
                "path": "/api/users",
                "backend": "http://localhost:3000",
                "timeout": 5000,
                "require_auth": true
            },
            {
                "path": "/api/products/*",
                "backends": ["http://localhost:3001", "http://localhost:3002"],
                "load_balancing": "round_robin",
                "timeout": 3000
            }
        ]
    })";

    int count = router->loadRoutes(routes_json);
    EXPECT_EQ(count, 2);

    auto match1 = router->matchRoute("/api/users");
    ASSERT_TRUE(match1.has_value());
    EXPECT_TRUE(match1->route->require_auth);

    auto match2 = router->matchRoute("/api/products/123");
    ASSERT_TRUE(match2.has_value());
}

TEST_F(RouterTest, StripsPrefix) {
    Route route;
    route.path_pattern = "/api/users/*";
    route.backends.push_back("http://localhost:3000");
    route.strip_prefix = "/api";

    router->addRoute(route);

    auto match = router->matchRoute("/api/users/123");
    ASSERT_TRUE(match.has_value());
    EXPECT_EQ(match->rewritten_path, "/users/123");
}

TEST_F(RouterTest, RoundRobinLoadBalancing) {
    Route route;
    route.path_pattern = "/api/test";
    route.backends = {"http://localhost:3001", "http://localhost:3002", "http://localhost:3003"};
    route.load_balancing = "round_robin";

    router->addRoute(route);

    std::vector<std::string> backends;
    for (int i = 0; i < 6; i++) {
        auto match = router->matchRoute("/api/test");
        ASSERT_TRUE(match.has_value());
        backends.push_back(match->backend_url);
    }

    // Should cycle through backends
    EXPECT_EQ(backends[0], backends[3]);
    EXPECT_EQ(backends[1], backends[4]);
    EXPECT_EQ(backends[2], backends[5]);
}
