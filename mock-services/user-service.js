const express = require('express');
const app = express();
const PORT = 3002;

app.use(express.json());

// Mock user database
const users = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
    { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' },
    { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'moderator' }
];

let nextId = 5;

// Middleware to check authentication (mock)
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // In real app, gateway would validate JWT
    next();
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'user-service' });
});

// Get all users
app.get('/users', requireAuth, (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);

    res.json({
        users: users.slice(start, end),
        total: users.length,
        page: parseInt(page),
        limit: parseInt(limit)
    });
});

// Get user by ID
app.get('/users/:id', requireAuth, (req, res) => {
    const userId = parseInt(req.params.id);
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
});

// Create new user
app.post('/users', requireAuth, (req, res) => {
    const { name, email, role = 'user' } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email required' });
    }

    const newUser = {
        id: nextId++,
        name,
        email,
        role
    };

    users.push(newUser);

    res.status(201).json(newUser);
});

// Update user
app.put('/users/:id', requireAuth, (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    users[userIndex] = { ...users[userIndex], ...req.body, id: userId };

    res.json(users[userIndex]);
});

// Delete user
app.delete('/users/:id', requireAuth, (req, res) => {
    const userId = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    users.splice(userIndex, 1);

    res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`╔════════════════════════════════════════╗`);
    console.log(`║  User Service running on port ${PORT}   ║`);
    console.log(`╚════════════════════════════════════════╝`);
});
