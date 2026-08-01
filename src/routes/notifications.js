import { Router } from 'express';
import { sendPurchaseConfirmation, sendRentalNotification } from '../services/linq.js';

const router = Router();

router.post('/send', async (req, res, next) => {
    try {
        const { target, message, type, details } = req.body;
        let result;
        if (type === 'rental') {
            result = await sendRentalNotification(target, details);
        } else {
            result = await sendPurchaseConfirmation(target, details || { message });
        }
        res.json({ data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/webhook', async (req, res, next) => {
    try {
        console.log('Linq Webhook received:', req.body);
        res.json({ data: { success: true } });
    } catch (err) {
        next(err);
    }
});

export default router;
