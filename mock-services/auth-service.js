const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = 3001;

app.use(express.json());

// JWT configuration - must match gateway configuration
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-min-32-characters-long';
const JWT_ISSUER = 'api-gateway';
const JWT_AUDIENCE = 'api-clients';

// Mock user database
const users = {
    'admin': { password: 'secret', id: 'user_001', role: 'admin' },
    'user': { password: 'password', id: 'user_002', role: 'user' }
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'auth-service' });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    console.log(`Login attempt: ${username}`);

    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password required'
        });
    }

    const user = users[username];
    if (!user || user.password !== password) {
        return res.status(401).json({
            error: 'Invalid credentials'
        });
    }

    try {
        // Generate real JWT token compatible with the C++ gateway
        const token = jwt.sign(
            {
                sub: user.id,
                role: user.role,
                username: username
            },
            JWT_SECRET,
            {
                algorithm: 'HS256',
                expiresIn: '1h',
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE
            }
        );

        console.log(`✓ Generated JWT token for ${username} (${user.role})`);

        res.json({
            token: token,
            user_id: user.id,
            role: user.role,
            expires_in: 3600
        });
    } catch (error) {
        console.error('JWT generation error:', error);
        res.status(500).json({
            error: 'Token generation failed'
        });
    }
});

// Validate token endpoint (for testing)
app.post('/validate', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            algorithms: ['HS256']
        });

        res.json({
            valid: true,
            user_id: decoded.sub,
            role: decoded.role,
            username: decoded.username
        });
    } catch (error) {
        console.error('Token validation error:', error.message);
        res.status(401).json({
            valid: false,
            error: error.message
        });
    }
});

// Refresh token endpoint
app.post('/refresh', (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    // Mock refresh
    const new_token = `mock_jwt_token_refreshed_${Date.now()}`;

    res.json({
        token: new_token,
        expires_in: 3600
    });
});

app.listen(PORT, () => {
    console.log(`╔════════════════════════════════════════╗`);
    console.log(`║  Auth Service running on port ${PORT}   ║`);
    console.log(`╚════════════════════════════════════════╝`);
    console.log(`JWT_SECRET: ${JWT_SECRET.substring(0, 10)}...`);
});
