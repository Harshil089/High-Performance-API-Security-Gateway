#include <gtest/gtest.h>
#include "../src/server/Request.h"
#include "../src/server/Response.h"

using namespace gateway;

TEST(HttpRequestTest, GetsHeaderValue) {
    HttpRequest req;
    req.headers["Content-Type"] = "application/json";
    req.headers["Authorization"] = "Bearer token123";

    EXPECT_EQ(req.getHeader("Content-Type"), "application/json");
    EXPECT_EQ(req.getHeader("Authorization"), "Bearer token123");
    EXPECT_EQ(req.getHeader("Non-Existent", "default"), "default");
}

TEST(HttpRequestTest, GetsQueryParam) {
    HttpRequest req;
    req.query_params["page"] = "1";
    req.query_params["limit"] = "10";

    EXPECT_EQ(req.getQueryParam("page"), "1");
    EXPECT_EQ(req.getQueryParam("limit"), "10");
    EXPECT_EQ(req.getQueryParam("offset", "0"), "0");
}

TEST(HttpRequestTest, CalculatesHeaderSize) {
    HttpRequest req;
    req.headers["Content-Type"] = "application/json";
    req.headers["Authorization"] = "Bearer token";

    size_t expected =
        std::string("Content-Type").size() + std::string("application/json").size() + 4 +
        std::string("Authorization").size() + std::string("Bearer token").size() + 4;

    EXPECT_EQ(req.headerSize(), expected);
}

TEST(HttpResponseTest, SetsHeaders) {
    HttpResponse res;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Custom-Header", "value");

    EXPECT_EQ(res.headers["Content-Type"], "application/json");
    EXPECT_EQ(res.headers["X-Custom-Header"], "value");
}

TEST(HttpResponseTest, SetsJsonBody) {
    HttpResponse res;
    res.setJsonBody("{\"message\": \"success\"}");

    EXPECT_EQ(res.body, "{\"message\": \"success\"}");
    EXPECT_EQ(res.headers["Content-Type"], "application/json");
}

TEST(HttpResponseTest, SetsTextBody) {
    HttpResponse res;
    res.setTextBody("Hello, World!");

    EXPECT_EQ(res.body, "Hello, World!");
    EXPECT_EQ(res.headers["Content-Type"], "text/plain");
}

TEST(ResponseBuilderTest, CreatesErrorJson) {
    std::string error_json = ResponseBuilder::errorJson("Invalid request", "BAD_REQUEST");

    EXPECT_NE(error_json.find("Invalid request"), std::string::npos);
    EXPECT_NE(error_json.find("BAD_REQUEST"), std::string::npos);
}

TEST(ResponseBuilderTest, CreatesSuccessJson) {
    std::string success_json = ResponseBuilder::successJson("Operation completed");

    EXPECT_NE(success_json.find("Operation completed"), std::string::npos);
}
