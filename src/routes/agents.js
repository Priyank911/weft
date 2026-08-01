import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createAgentProfile, getAgentById, updateAgentProfile, getTransactionsByAgent, getUsageByAgent } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.post('/register', async (req, res, next) => {
    try {
        const { user_id, agent_type, agent_name, capabilities } = req.body;
        const id = uuidv4();
        createAgentProfile.run(
            id,
            user_id,
            agent_type,
            agent_name,
            JSON.stringify(capabilities || []),
            0,
            '{}'
        );
        const agent = getAgentById.get(id);
        res.json({ data: { agent_id: agent.id, profile: agent } });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const agent = getAgentById.get(req.params.id);
        if (!agent) throw new AppError('NOT_FOUND', 404, 'Agent not found');
        const usage = getUsageByAgent.all(req.params.id, 50, 0);
        res.json({ data: { agent, usageHistory: usage } });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const existing = getAgentById.get(req.params.id);
        if (!existing) throw new AppError('NOT_FOUND', 404, 'Agent not found');
        
        const { agent_type, agent_name, capabilities, prava_wallet_linked, oauth_token_hash, metadata } = req.body;
        
        updateAgentProfile.run(
            agent_name || existing.agent_name,
            capabilities ? JSON.stringify(capabilities) : existing.capabilities,
            prava_wallet_linked !== undefined ? (prava_wallet_linked ? 1 : 0) : existing.prava_wallet_linked,
            metadata ? JSON.stringify(metadata) : existing.metadata,
            req.params.id
        );
        
        const updated = getAgentById.get(req.params.id);
        res.json({ data: updated });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/purchases', async (req, res, next) => {
    try {
        const transactions = getTransactionsByAgent.all(req.params.id);
        res.json({ data: transactions });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/usage', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const usage = getUsageByAgent.all(req.params.id, limit, offset);
        res.json({ data: usage });
    } catch (err) {
        next(err);
    }
});

export default router;
