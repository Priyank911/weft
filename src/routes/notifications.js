import { Router } from 'express';
import { sendPurchaseConfirmation, sendRentalNotification, sendActivationSuccess } from '../services/linq.js';
import db from '../db/index.js';

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
        console.log('[Linq Webhook] Incoming event:', JSON.stringify(req.body, null, 2));
        const data = req.body.data || {};
        
        // Extract sender handle / phone number
        const senderPhone = data.from || 
                            data.from_handle?.handle || 
                            data.sender_handle?.handle || 
                            data.message?.from;

        // Extract text message parts
        let messageText = '';
        if (data.parts && Array.isArray(data.parts)) {
            messageText = data.parts.map(p => p.value || '').join(' ');
        } else if (data.message && data.message.parts && Array.isArray(data.message.parts)) {
            messageText = data.message.parts.map(p => p.value || '').join(' ');
        }

        if (senderPhone) {
            const cleanPhone = senderPhone.replace(/[^0-9+]/g, '');
            const lowerText = messageText.toLowerCase();

            console.log(`[Linq Webhook] Extracted Sender: ${cleanPhone}, Text: "${messageText}"`);

            if (lowerText.includes('activate') || lowerText.includes('weft') || lowerText.includes('hello')) {
                console.log(`[Linq Webhook] Activating account for phone ${cleanPhone}...`);
                try {
                    // Update user activation status in DB
                    db.prepare(`
                        UPDATE users 
                        SET phone = ? 
                        WHERE phone = ? OR phone LIKE ?
                    `).run(cleanPhone, cleanPhone, `%${cleanPhone.slice(-10)}%`);
                } catch (dbErr) {
                    console.warn('[Linq Webhook] DB update warning:', dbErr.message);
                }

                // Send confirmation text back to sender
                await sendActivationSuccess(cleanPhone);
            }
        }

        res.json({ data: { success: true } });
    } catch (err) {
        console.error('[Linq Webhook] Processing error:', err);
        next(err);
    }
});

export default router;
