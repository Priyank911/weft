import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createSellerProfile, getSellerById, getSellerByUserId, getListingsBySeller, getLedgerBySeller } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.post('/profile', authenticate, requireRole('seller', 'both'), async (req, res, next) => {
    try {
        const existing = getSellerByUserId.get(req.user.id);
        if (existing) {
            return res.json({ data: existing });
        }

        const { business_name, description } = req.body;
        const id = uuidv4();
        createSellerProfile.run(
            id,
            req.user.id,
            business_name || '',
            description || ''
        );
        const profile = getSellerById.get(id);
        res.json({ data: profile });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const seller = getSellerById.get(req.params.id);
        if (!seller) throw new AppError('NOT_FOUND', 404, 'Seller not found');
        res.json({ data: seller });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/listings', async (req, res, next) => {
    try {
        const listings = getListingsBySeller.all(req.params.id);
        res.json({ data: listings });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/earnings', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const ledger = getLedgerBySeller.all(req.params.id, limit, offset);
        res.json({ data: ledger });
    } catch (err) {
        next(err);
    }
});

export default router;
