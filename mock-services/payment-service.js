const express = require('express');
const app = express();
const PORT = 3004;

app.use(express.json());

// Mock transaction database
const transactions = [];
let nextTxId = 1000;

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'payment-service' });
});

// Process payment
app.post('/payments', requireAuth, (req, res) => {
    const { amount, currency = 'USD', user_id, description } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({
            error: 'Invalid amount',
            code: 'INVALID_AMOUNT'
        });
    }

    if (!user_id) {
        return res.status(400).json({
            error: 'User ID required',
            code: 'MISSING_USER_ID'
        });
    }

    // Simulate processing delay
    const processingTime = Math.random() * 200 + 50; // 50-250ms

    setTimeout(() => {
        // Simulate random failures (10% chance)
        if (Math.random() < 0.1) {
            return res.status(500).json({
                error: 'Payment processing failed',
                code: 'PROCESSING_FAILED'
            });
        }

        const transaction = {
            transaction_id: `tx_${nextTxId++}`,
            amount,
            currency,
            user_id,
            description: description || 'Payment',
            status: 'success',
            timestamp: new Date().toISOString(),
            processing_time_ms: Math.round(processingTime)
        };

        transactions.push(transaction);

        res.status(201).json(transaction);
    }, processingTime);
});

// Get transaction by ID
app.get('/payments/:id', requireAuth, (req, res) => {
    const txId = req.params.id;
    const transaction = transactions.find(t => t.transaction_id === txId);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
});

// Get all transactions for user
app.get('/payments', requireAuth, (req, res) => {
    const { user_id, limit = 10 } = req.query;

    if (!user_id) {
        return res.status(400).json({ error: 'User ID required' });
    }

    const userTransactions = transactions
        .filter(t => t.user_id === user_id)
        .slice(0, parseInt(limit));

    res.json({
        transactions: userTransactions,
        total: userTransactions.length
    });
});

// Refund payment
app.post('/payments/:id/refund', requireAuth, (req, res) => {
    const txId = req.params.id;
    const transaction = transactions.find(t => t.transaction_id === txId);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'refunded') {
        return res.status(400).json({
            error: 'Transaction already refunded',
            code: 'ALREADY_REFUNDED'
        });
    }

    // Simulate refund processing
    setTimeout(() => {
        transaction.status = 'refunded';
        transaction.refunded_at = new Date().toISOString();

        res.json({
            transaction_id: transaction.transaction_id,
            status: 'refunded',
            refunded_amount: transaction.amount,
            refunded_at: transaction.refunded_at
        });
    }, 100);
});

app.listen(PORT, () => {
    console.log(`╔════════════════════════════════════════╗`);
    console.log(`║  Payment Service running on port ${PORT} ║`);
    console.log(`╚════════════════════════════════════════╝`);
});
