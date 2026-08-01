import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createUser, getUserByEmail, getUserById, getAgentsByUserId, getSellerByUserId } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

router.post('/register', async (req, res, next) => {
    try {
        const { email, password, role, phone } = req.body;
        if (!email || !password) throw new AppError('VALIDATION_ERROR', 400, 'Email and password are required');
        
        const existing = getUserByEmail.get(email);
        if (existing) throw new AppError('CONFLICT', 409, 'Email already in use');

        const id = uuidv4();
        createUser.run(id, email, hashPassword(password), role || 'buyer', phone || null, null);
        const user = getUserById.get(id);

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        res.json({ data: { user, token } });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = getUserByEmail.get(email);
        if (!user || user.password_hash !== hashPassword(password)) {
            throw new AppError('UNAUTHORIZED', 401, 'Invalid credentials');
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        res.json({ data: { user, token } });
    } catch (err) {
        next(err);
    }
});

router.get('/me', authenticate, async (req, res, next) => {
    try {
        const user = getUserById.get(req.user.id);
        const agents = getAgentsByUserId.all(req.user.id);
        const sellerProfile = getSellerByUserId.get(req.user.id);
        
        res.json({ data: { user, agents, sellerProfile } });
    } catch (err) {
        next(err);
    }
});

export default router;
