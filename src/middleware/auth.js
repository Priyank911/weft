import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

/**
 * Middleware to authenticate a user via JWT in the Authorization header.
 */
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError('UNAUTHORIZED', 401, 'Missing or invalid authorization header'));
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded;
        next();
    } catch (err) {
        next(new AppError('UNAUTHORIZED', 401, 'Invalid token'));
    }
};

/**
 * Middleware to restrict access based on user roles.
 * @param {...string} roles - Allowed roles
 */
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError('FORBIDDEN', 403, 'Insufficient permissions'));
        }
        next();
    };
};

/**
 * Optional authentication middleware that does not fail if no token is present.
 */
export const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = decoded;
        } catch (err) {
            // Ignore invalid tokens for optional auth
        }
    }
    next();
};
