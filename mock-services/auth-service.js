const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

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

    // Simulate JWT token generation (in real app, gateway would generate this)
    const token = `mock_jwt_token_${user.id}_${Date.now()}`;

    res.json({
        token: token,
        user_id: user.id,
        role: user.role,
        expires_in: 3600
    });
});

// Validate token endpoint (for testing)
app.post('/validate', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Mock validation
    if (token.startsWith('mock_jwt_token_')) {
        res.json({ valid: true, user_id: 'user_001' });
    } else {
        res.status(401).json({ valid: false, error: 'Invalid token' });
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
});
