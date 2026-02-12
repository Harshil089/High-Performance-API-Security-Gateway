# API Gateway - API Documentation

## Overview

This document describes all available endpoints exposed by the API Gateway and how to interact with them.

## Base URL

```
http://localhost:8080
```

For HTTPS (when TLS enabled):
```
https://localhost:8080
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Health Check

Check gateway health status.

**Endpoint**: `GET /health`

**Authentication**: Not required

**Response**:
```json
{
  "status": "healthy",
  "service": "api-gateway"
}
```

**Example**:
```bash
curl http://localhost:8080/health
```

---

### Authentication

#### Login

Authenticate user and receive JWT token.

**Endpoint**: `POST /api/auth/login`

**Authentication**: Not required

**Rate Limit**: 5 requests per 60 seconds per IP

**Request Body**:
```json
{
  "username": "admin",
  "password": "secret"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user_001",
  "role": "admin",
  "expires_in": 3600
}
```

**Error Responses**:
- `400 Bad Request`: Missing username or password
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded

**Example**:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'
```

---

#### Validate Token

Validate a JWT token (for testing).

**Endpoint**: `POST /api/auth/validate`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "valid": true,
  "user_id": "user_001"
}
```

---

### User Management

#### List Users

Get paginated list of users.

**Endpoint**: `GET /api/users`

**Authentication**: Required

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)

**Response** (200 OK):
```json
{
  "users": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "role": "admin"
    },
    {
      "id": 2,
      "name": "Bob Smith",
      "email": "bob@example.com",
      "role": "user"
    }
  ],
  "total": 4,
  "page": 1,
  "limit": 10
}
```

**Example**:
```bash
TOKEN="your_jwt_token"
curl http://localhost:8080/api/users?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Get User by ID

Retrieve specific user details.

**Endpoint**: `GET /api/users/:id`

**Authentication**: Required

**Path Parameters**:
- `id`: User ID

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "role": "admin"
}
```

**Error Responses**:
- `404 Not Found`: User not found

**Example**:
```bash
curl http://localhost:8080/api/users/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Create User

Create a new user.

**Endpoint**: `POST /api/users`

**Authentication**: Required

**Request Body**:
```json
{
  "name": "New User",
  "email": "newuser@example.com",
  "role": "user"
}
```

**Response** (201 Created):
```json
{
  "id": 5,
  "name": "New User",
  "email": "newuser@example.com",
  "role": "user"
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields

**Example**:
```bash
curl -X POST http://localhost:8080/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New User","email":"newuser@example.com","role":"user"}'
```

---

#### Update User

Update existing user.

**Endpoint**: `PUT /api/users/:id`

**Authentication**: Required

**Request Body**:
```json
{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "Updated Name",
  "email": "updated@example.com",
  "role": "admin"
}
```

---

#### Delete User

Delete a user.

**Endpoint**: `DELETE /api/users/:id`

**Authentication**: Required

**Response**: `204 No Content`

**Error Responses**:
- `404 Not Found`: User not found

---

### Payment Processing

#### Process Payment

Create a new payment transaction.

**Endpoint**: `POST /api/payment/payments`

**Authentication**: Required

**Rate Limit**: 10 requests per 60 seconds per IP

**Request Body**:
```json
{
  "amount": 99.99,
  "currency": "USD",
  "user_id": "user_001",
  "description": "Product purchase"
}
```

**Response** (201 Created):
```json
{
  "transaction_id": "tx_1000",
  "amount": 99.99,
  "currency": "USD",
  "user_id": "user_001",
  "description": "Product purchase",
  "status": "success",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "processing_time_ms": 120
}
```

**Error Responses**:
- `400 Bad Request`: Invalid amount or missing fields
- `500 Internal Server Error`: Payment processing failed

**Example**:
```bash
curl -X POST http://localhost:8080/api/payment/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 99.99,
    "currency": "USD",
    "user_id": "user_001",
    "description": "Product purchase"
  }'
```

---

#### Get Transaction

Retrieve transaction details.

**Endpoint**: `GET /api/payment/payments/:id`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "transaction_id": "tx_1000",
  "amount": 99.99,
  "currency": "USD",
  "user_id": "user_001",
  "description": "Product purchase",
  "status": "success",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

#### List User Transactions

Get transactions for a user.

**Endpoint**: `GET /api/payment/payments?user_id=:id`

**Authentication**: Required

**Query Parameters**:
- `user_id` (required): User ID
- `limit` (optional): Max results (default: 10)

**Response** (200 OK):
```json
{
  "transactions": [
    {
      "transaction_id": "tx_1000",
      "amount": 99.99,
      "status": "success"
    }
  ],
  "total": 1
}
```

---

#### Refund Payment

Process a refund for a transaction.

**Endpoint**: `POST /api/payment/payments/:id/refund`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "transaction_id": "tx_1000",
  "status": "refunded",
  "refunded_amount": 99.99,
  "refunded_at": "2024-01-15T11:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found`: Transaction not found
- `400 Bad Request`: Already refunded

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_PATH` | 400 | Path validation failed |
| `PATH_TRAVERSAL` | 400 | Path traversal attempt detected |
| `HEADERS_TOO_LARGE` | 400 | Request headers exceed size limit |
| `BODY_TOO_LARGE` | 400 | Request body exceeds size limit |
| `SQL_INJECTION` | 400 | SQL injection pattern detected |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method not allowed |
| `UNAUTHORIZED` | 401 | Authentication required or invalid token |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `NOT_FOUND` | 404 | Resource not found |
| `BACKEND_ERROR` | 502 | Backend service error |
| `SERVICE_UNAVAILABLE` | 503 | Circuit breaker open or service down |

---

## Rate Limiting

The gateway implements rate limiting at multiple levels:

### Global Limit
- **Limit**: 10,000 requests per 60 seconds
- **Applies to**: All requests across all clients

### Per-IP Limit
- **Limit**: 100 requests per 60 seconds
- **Applies to**: All requests from a single IP

### Endpoint-Specific Limits

| Endpoint | Limit |
|----------|-------|
| `/api/auth/login` | 5 req/60s per IP |
| `/api/payment/*` | 10 req/60s per IP |

### Rate Limit Headers

When rate limited, the response includes:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/json

{
  "error": "Rate limit exceeded"
}
```

The `Retry-After` header indicates seconds to wait before retrying.

---

## CORS

The gateway supports CORS for cross-origin requests:

### Preflight Request

```
OPTIONS /api/users HTTP/1.1
Origin: https://example.com
```

### Response

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: *
```

---

## Request/Response Examples

### Successful Request Flow

```bash
# 1. Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'

# Response:
# {
#   "token": "eyJhbGc...",
#   "user_id": "user_001"
# }

# 2. Use token for authenticated request
TOKEN="eyJhbGc..."
curl http://localhost:8080/api/users \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "users": [...],
#   "total": 4
# }
```

### Rate Limit Example

```bash
# Rapidly send requests to trigger rate limit
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"secret"}'
done

# After 5 requests:
# HTTP/1.1 429 Too Many Requests
# Retry-After: 60
# {
#   "error": "Rate limit exceeded"
# }
```

### Security Validation Example

```bash
# Attempt path traversal (will be blocked)
curl http://localhost:8080/api/../etc/passwd

# Response:
# HTTP/1.1 400 Bad Request
# {
#   "error": "Path traversal attempt detected",
#   "code": "PATH_TRAVERSAL"
# }
```

---

## Testing with cURL

### Set Environment Variables

```bash
export GATEWAY_URL="http://localhost:8080"
export TOKEN=""
```

### Get Token

```bash
TOKEN=$(curl -s -X POST $GATEWAY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}' | \
  jq -r '.token')

echo "Token: $TOKEN"
```

### Make Authenticated Request

```bash
curl $GATEWAY_URL/api/users \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## WebSocket Support

WebSocket support is planned for future releases.

---

## Versioning

API versioning will be supported in future releases via:
- URL path: `/v1/api/users`
- Header: `Accept: application/vnd.api+json; version=1`

---

## Support

For issues or questions:
- GitHub Issues: [repo-url]/issues
- Documentation: [docs-url]
