-- wrk Lua script for POST requests to login endpoint

wrk.method = "POST"
wrk.body   = '{"username":"admin","password":"secret"}'
wrk.headers["Content-Type"] = "application/json"

-- Optional: Randomize usernames to test different rate limit buckets
-- local counter = 1
-- request = function()
--    local username = "user" .. (counter % 100)
--    counter = counter + 1
--    wrk.body = '{"username":"' .. username .. '","password":"test123"}'
--    return wrk.format()
-- end
