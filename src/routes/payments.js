import { Router } from 'express';
import { createPaymentSession, getPaymentStatus as checkPaymentStatus, createMandate } from '../services/prava.js';
import { updateTransactionStatus } from '../db/index.js';

const router = Router();

router.post('/create-session', async (req, res, next) => {
    try {
        const { amount, currency } = req.body;
        const session = await createPaymentSession({ totalAmount: amount, currency });
        res.json({ data: session });
    } catch (err) {
        next(err);
    }
});

router.get('/session/:id/status', async (req, res, next) => {
    try {
        const status = await checkPaymentStatus(req.params.id);
        res.json({ data: status });
    } catch (err) {
        next(err);
    }
});

router.post('/create-mandate', async (req, res, next) => {
    try {
        const mandate = await createMandate({ amount: req.body.amount });
        res.json({ data: mandate });
    } catch (err) {
        next(err);
    }
});

router.post('/webhook', async (req, res, next) => {
    try {
        const { transaction_id, status } = req.body;
        updateTransactionStatus.run(status, transaction_id);
        res.json({ data: { success: true } });
    } catch (err) {
        next(err);
    }
});

export default router;
