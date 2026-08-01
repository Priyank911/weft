import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import sellerRoutes from './routes/sellers.js';
import listingRoutes from './routes/listings.js';
import marketplaceRoutes from './routes/marketplace.js';
import paymentRoutes from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';

const app = express();

app.use(cors());
app.use(express.json());

const uploadDir = './uploads/temp';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/health', (req, res) => {
    res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.get('/SKILL.md', (req, res) => {
    res.sendFile('SKILL.md', { root: '.' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Mounted routes:');
    console.log(' - /api/auth');
    console.log(' - /api/agents');
    console.log(' - /api/sellers');
    console.log(' - /api/listings');
    console.log(' - /api/marketplace');
    console.log(' - /api/payments');
    console.log(' - /api/notifications');
    console.log(' - /health');
});
