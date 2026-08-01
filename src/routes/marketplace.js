import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAgentById, getListingById, getSellerById, searchListingsFTS, searchListingsByFilter, createTransaction, updateTransactionStatus, updateTransactionPrava, getTransactionById, createLedgerEntry, incrementDownloadCount, logAgentUsage } from '../db/index.js';
import { createPaymentSession, getPaymentStatus, getMandateStatus } from '../services/prava.js';
import { getDeliveryPayload } from '../services/asset-processor.js';
import { sendPurchaseConfirmation, sendRentalNotification } from '../services/linq.js';
import { createMandate } from '../services/prava.js';
import { sendTask, getAgentCard, handleTaskResponse } from '../services/a2a-client.js';
import { semanticSearch } from '../services/openai.js';
import { AppError } from '../middleware/errorHandler.js';

const LIVE_INTENT_PATTERN = /\b(rent|hire|live agent)\b/i;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'need', 'to', 'for', 'of', 'in', 'on', 'is', 'am',
  'want', 'me', 'my', 'please', 'can', 'you', 'find', 'looking', 'that', 'this'
]);

// Build an FTS5 MATCH expression from a free-text query: drop stopwords and
// OR-join the remaining terms so natural-language queries still match
// listings that don't contain every word (FTS5 barewords default to AND).
function buildFtsQuery(query) {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
  if (terms.length === 0) return null;
  return terms.map(t => `"${t}"`).join(' OR ');
}

const router = Router();

// ID-based search: validates agent_id, logs usage, returns metadata only
router.post('/search', async (req, res, next) => {
  try {
    const { agent_id, query, category, listing_type, max_price_cents } = req.body;
    
    // 1. Validate agent_id
    if (!agent_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id is required');
    const agent = getAgentById.get(agent_id);
    if (!agent) throw new AppError('NOT_FOUND', 404, 'Agent not found. Please register first using register_agent.');
    
    // 2. Search listings
    const limit = 20;
    const offset = 0;
    let results = [];
    
    if (query) {
      try {
        const ftsQuery = buildFtsQuery(query);
        results = ftsQuery ? searchListingsFTS.all(ftsQuery, limit, offset) : [];
      } catch (e) {
        // FTS fallback
        results = searchListingsByFilter.all(
          category || null, category || null,
          listing_type || null, listing_type || null,
          max_price_cents || null, max_price_cents || null,
          limit, offset
        );
      }
    } else {
      results = searchListingsByFilter.all(
        category || null, category || null,
        listing_type || null, listing_type || null,
        max_price_cents || null, max_price_cents || null,
        limit, offset
      );
    }
    
    // 3. Rank live-agent results semantically when relevant (relevance ranking, not raw SQL order)
    const hasLiveResults = results.some(r => r.listing_type === 'live');
    const suggestsLiveIntent = query && LIVE_INTENT_PATTERN.test(query);
    if (query && (hasLiveResults || suggestsLiveIntent) && results.length > 0) {
      try {
        results = await semanticSearch(query, results);
      } catch (e) {
        console.warn('[Marketplace] Semantic search ranking failed, using raw order:', e.message);
      }
    }

    // 4. Log usage
    const usageId = uuidv4();
    logAgentUsage.run(usageId, agent_id, 'search', null, query || 'browse', `Found ${results.length} results`);

    // 5. Return METADATA ONLY (no download URLs)
    const safeResults = results.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      listing_type: r.listing_type,
      price_cents: r.price_cents,
      currency: r.currency,
      rate_type: r.rate_type,
      tags: r.tags,
      capabilities: r.capabilities,
      sample_description: r.sample_description,
      download_count: r.download_count,
      is_free: r.price_cents === 0,
      guidance: r.price_cents === 0 
        ? "Free asset. Use 'install' tool to get it immediately."
        : `Premium asset ($${(r.price_cents / 100).toFixed(2)}). Use 'purchase' tool — user must approve payment.`
    }));
    
    res.json({ data: { agent_id, results: safeResults, total: safeResults.length } });
  } catch (err) {
    next(err);
  }
});

// Purchase premium asset
router.post('/purchase', async (req, res, next) => {
  try {
    const { agent_id, listing_id } = req.body;
    if (!agent_id || !listing_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id and listing_id required');
    
    const agent = getAgentById.get(agent_id);
    if (!agent) throw new AppError('NOT_FOUND', 404, 'Agent not found');
    
    const listing = getListingById.get(listing_id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    if (listing.price_cents <= 0) throw new AppError('VALIDATION_ERROR', 400, 'This listing is free. Use /install instead.');
    
    // Create Prava payment session
    let session;
    try {
      session = await createPaymentSession({
        totalAmount: (listing.price_cents / 100).toFixed(2),
        currency: listing.currency || 'USD',
        merchantName: process.env.WEFT_MERCHANT_NAME || 'Weft Marketplace',
        merchantUrl: process.env.WEFT_MERCHANT_URL || 'https://weft.marketplace',
        merchantCountry: process.env.WEFT_MERCHANT_COUNTRY || 'US',
        products: [{ description: listing.title, unit_price: (listing.price_cents / 100).toFixed(2), quantity: 1 }],
        userId: agent.user_id,
        userEmail: 'buyer@weft.marketplace'
      });
    } catch (e) {
      console.warn('[Marketplace] Prava session failed, creating mock:', e.message);
      session = { session_id: `mock_${uuidv4()}`, payment_url: `https://checkout.prava.space/mock/${uuidv4()}` };
    }
    
    // Create transaction
    const txId = uuidv4();
    createTransaction.run(
      txId, agent_id, listing_id,
      listing.price_cents, listing.currency || 'USD',
      'purchase', 'awaiting_approval',
      session.session_id, session.payment_url,
      null, null
    );
    
    // Log usage
    const usageId = uuidv4();
    logAgentUsage.run(usageId, agent_id, 'purchase', listing_id, `Purchase ${listing.title}`, 'awaiting_approval');
    
    res.json({
      data: {
        transaction_id: txId,
        payment_url: session.payment_url,
        amount_cents: listing.price_cents,
        currency: listing.currency || 'USD',
        status: 'awaiting_approval',
        message: `Please approve payment of $${(listing.price_cents / 100).toFixed(2)} at the payment_url`
      }
    });
  } catch (err) {
    next(err);
  }
});

// Check purchase status
router.get('/purchase/:txId/status', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    
    // Try checking Prava status
    let currentStatus = tx.status;
    if (tx.prava_session_id && tx.status === 'awaiting_approval') {
      try {
        const pravaStatus = await getPaymentStatus(tx.prava_session_id);
        if (pravaStatus.status === 'completed') {
          currentStatus = 'approved';
          updateTransactionStatus.run('approved', tx.id);
        } else if (pravaStatus.status === 'failed') {
          currentStatus = 'failed';
          updateTransactionStatus.run('failed', tx.id);
        }
      } catch (e) {
        console.warn('[Marketplace] Prava status check failed:', e.message);
      }
    }
    
    res.json({ data: { transaction_id: tx.id, status: currentStatus, payment_url: tx.prava_payment_url } });
  } catch (err) {
    next(err);
  }
});

// Deliver purchased asset
router.post('/purchase/:txId/deliver', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    if (!['approved', 'captured'].includes(tx.status)) {
      throw new AppError('PAYMENT_REQUIRED', 402, `Payment not approved yet. Current status: ${tx.status}`);
    }
    
    // Prepare delivery
    const deliveryPayload = await getDeliveryPayload(tx.listing_id);
    
    // Update transaction
    updateTransactionStatus.run('delivered', tx.id);
    
    // Credit seller
    const listing = getListingById.get(tx.listing_id);
    if (listing) {
      const seller = getSellerById.get(listing.seller_id);
      if (seller) {
        const newBalance = seller.payout_balance_cents + tx.amount_cents;
        const ledgerId = uuidv4();
        createLedgerEntry.run(ledgerId, listing.seller_id, tx.id, tx.amount_cents, 'credit', newBalance, `Sale: ${listing.title}`);
        // Update seller balance via direct SQL since we need to set specific value
        import('../db/index.js').then(db => {
          db.updateSellerBalance.run(newBalance, listing.seller_id);
        });
      }
      incrementDownloadCount.run(tx.listing_id);
    }
    
    // Log usage
    const usageId = uuidv4();
    logAgentUsage.run(usageId, tx.buyer_agent_id, 'download', tx.listing_id, 'Delivered', 'success');
    
    res.json({ data: deliveryPayload });
  } catch (err) {
    next(err);
  }
});

// Install free asset
router.post('/install', async (req, res, next) => {
  try {
    const { agent_id, listing_id } = req.body;
    if (!agent_id || !listing_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id and listing_id required');
    
    const agent = getAgentById.get(agent_id);
    if (!agent) throw new AppError('NOT_FOUND', 404, 'Agent not found');
    
    const listing = getListingById.get(listing_id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    if (listing.price_cents > 0) throw new AppError('PAYMENT_REQUIRED', 402, 'This listing is not free. Use /purchase instead.');
    
    // Create transaction record
    const txId = uuidv4();
    createTransaction.run(
      txId, agent_id, listing_id,
      0, listing.currency || 'USD',
      'free_install', 'delivered',
      null, null, null, null
    );
    
    // Deliver immediately
    const deliveryPayload = await getDeliveryPayload(listing_id);
    incrementDownloadCount.run(listing_id);
    
    // Log usage
    const usageId = uuidv4();
    logAgentUsage.run(usageId, agent_id, 'install', listing_id, `Install ${listing.title}`, 'delivered');
    
    res.json({ data: deliveryPayload });
  } catch (err) {
    next(err);
  }
});

// Rent live agent
router.post('/rent', async (req, res, next) => {
  try {
    const { agent_id, listing_id, duration_minutes, task_description } = req.body;
    if (!agent_id || !listing_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id and listing_id required');
    
    const agent = getAgentById.get(agent_id);
    if (!agent) throw new AppError('NOT_FOUND', 404, 'Agent not found');
    
    const listing = getListingById.get(listing_id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    if (listing.listing_type !== 'live') throw new AppError('VALIDATION_ERROR', 400, 'This listing is not a live agent');
    
    const estimatedCost = Math.ceil((listing.price_cents / 60) * (duration_minutes || 30));
    
    // Create mandate via Prava
    let mandate;
    try {
      mandate = await createMandate({
        amount: (estimatedCost / 100).toFixed(2),
        currency: listing.currency || 'USD',
        merchantName: process.env.WEFT_MERCHANT_NAME || 'Weft Marketplace',
        merchantUrl: process.env.WEFT_MERCHANT_URL || 'https://weft.marketplace',
        merchantCountry: process.env.WEFT_MERCHANT_COUNTRY || 'US',
        frequency: 'one_time',
        maxCharges: 1,
        products: [{ description: `Rental: ${listing.title} for ${duration_minutes || 30} minutes` }],
        userId: agent.user_id,
        userEmail: 'buyer@weft.marketplace'
      });
    } catch (e) {
      console.warn('[Marketplace] Prava mandate failed, creating mock:', e.message);
      mandate = { session_id: `mock_mdt_${uuidv4()}`, approval_url: `https://checkout.prava.space/mock/${uuidv4()}` };
    }
    
    // Create transaction
    const txId = uuidv4();
    createTransaction.run(
      txId, agent_id, listing_id,
      estimatedCost, listing.currency || 'USD',
      'rental', 'pending',
      null, null,
      mandate.session_id || mandate.mandate_id,
      duration_minutes || 30
    );
    
    // Send Linq notification
    try {
      await sendRentalNotification(process.env.LINQ_PHONE_NUMBER, {
        agentName: listing.title,
        duration: `${duration_minutes || 30} minutes`,
        rate: `$${(listing.price_cents / 100).toFixed(2)}/hr`,
        maxAmount: `$${(estimatedCost / 100).toFixed(2)}`,
        approvalUrl: mandate.approval_url || mandate.payment_url || ''
      });
    } catch (e) {
      console.warn('[Marketplace] Linq notification failed:', e.message);
    }
    
    // Log usage
    const usageId = uuidv4();
    logAgentUsage.run(usageId, agent_id, 'rent', listing_id, task_description || 'Rental request', 'pending');
    
    res.json({
      data: {
        transaction_id: txId,
        approval_url: mandate.approval_url || mandate.payment_url || '',
        estimated_cost_cents: estimatedCost,
        currency: listing.currency || 'USD',
        duration_minutes: duration_minutes || 30,
        message: `Rental of ${listing.title} for ${duration_minutes || 30} min. Approve at the approval_url.`
      }
    });
  } catch (err) {
    next(err);
  }
});

// Check rental mandate status
router.get('/rent/:txId/status', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');

    // Try checking Prava mandate status
    let currentStatus = tx.status;
    if (tx.prava_mandate_id && tx.status === 'pending') {
      try {
        const mandateStatus = await getMandateStatus(tx.prava_mandate_id);
        const status = mandateStatus?.status || mandateStatus?.mandate_status;
        if (status === 'completed' || status === 'confirmed' || status === 'approved' || status === 'active') {
          currentStatus = 'approved';
          updateTransactionStatus.run('approved', tx.id);
        } else if (status === 'failed' || status === 'declined' || status === 'cancelled') {
          currentStatus = 'failed';
          updateTransactionStatus.run('failed', tx.id);
        }
      } catch (e) {
        console.warn('[Marketplace] Prava mandate status check failed:', e.message);
      }
    }

    res.json({ data: { transaction_id: tx.id, status: currentStatus, approval_url: tx.prava_payment_url } });
  } catch (err) {
    next(err);
  }
});

// Execute task on rented live agent (A2A)
router.post('/rent/:txId/execute', async (req, res, next) => {
  try {
    const { message } = req.body;
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    if (!['approved', 'captured'].includes(tx.status)) {
      throw new AppError('PAYMENT_REQUIRED', 402, 'Rental payment has not been approved yet. Check status with get_rental_status before executing tasks.');
    }

    const listing = getListingById.get(tx.listing_id);
    if (!listing || !listing.a2a_endpoint_url) {
      throw new AppError('VALIDATION_ERROR', 400, 'No A2A endpoint configured for this listing');
    }
    
    // Send A2A task
    const taskId = tx.rental_task_id || uuidv4();
    try {
      const result = await sendTask(listing.a2a_endpoint_url, {
        taskId,
        message: message || 'Execute task'
      });
      
      const parsed = handleTaskResponse(result);
      
      // Update transaction with task ID
      if (!tx.rental_task_id) {
        import('../db/index.js').then(db => {
          db.updateTransactionRental.run(taskId, parsed.status === 'completed' ? 'captured' : 'approved', tx.id);
        });
      }
      
      res.json({
        data: {
          task_id: taskId,
          status: parsed.status,
          result: parsed.output ?? (parsed.artifacts && parsed.artifacts.length ? parsed.artifacts : null),
          clarification_needed: parsed.status === 'input-required',
          question: parsed.clarificationQuestion || null
        }
      });
    } catch (e) {
      console.error('[Marketplace] A2A task error:', e.message);
      res.json({
        data: {
          task_id: taskId,
          status: 'failed',
          error: e.message,
          message: 'Failed to communicate with the live agent. It may be offline.'
        }
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
