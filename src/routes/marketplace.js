import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAgentById,
  getListingById,
  getUserById,
  searchListingsFTS,
  searchListingsByFilter,
  createTransaction,
  updateTransactionStatus,
  updateTransactionPrava,
  updateTransactionRental,
  activateTransactionMandate,
  getTransactionById,
  incrementDownloadCount,
  logAgentUsage,
  settleSellerCredit
} from '../db/index.js';
import {
  createPaymentSession,
  getPaymentStatus,
  reportPaymentStatus,
  createMandate,
  getMandateStatus,
  listActiveMandates,
  chargeMandate,
  reportMandateCharge
} from '../services/prava.js';
import { getDeliveryPayload } from '../services/asset-processor.js';
import {
  sendPurchaseConfirmation,
  sendRentalNotification,
  sendPurchaseCheckout,
  sendAssetSold,
  sendRentalConfirmation,
  sendRentalSold
} from '../services/linq.js';
import { sendTask, getTaskStatus, handleTaskResponse } from '../services/a2a-client.js';
import { semanticSearch } from '../services/openai.js';
import { aiSearchNanda } from '../services/weft-agent.js';
import { AppError } from '../middleware/errorHandler.js';

const LIVE_INTENT_PATTERN = /\b(rent|hire|live agent)\b/i;
const STOPWORDS = new Set([
  'a', 'an', 'the', 'i', 'need', 'to', 'for', 'of', 'in', 'on', 'is', 'am',
  'want', 'me', 'my', 'please', 'can', 'you', 'find', 'looking', 'that', 'this'
]);

const isMockPayment = (transaction) => transaction.prava_session_id?.startsWith('mock_');
const isMockMandate = (transaction) => transaction.prava_mandate_id?.startsWith('mock_');

function buildFtsQuery(query) {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term));
  return terms.length ? terms.map((term) => `"${term}"`).join(' OR ') : null;
}

function mockApprovalEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.PRAVA_ALLOW_MOCK_APPROVAL === 'true';
}

function mockFallbackEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.PRAVA_ENABLE_MOCK_FALLBACK === 'true';
}

function pravaCheckoutError(error) {
  const providerMessage = error?.message || 'Unknown Prava error';
  if (error?.providerCode === 'PRAVA_CONFIGURATION_ERROR') {
    return new AppError('PRAVA_CONFIGURATION_ERROR', 502, providerMessage);
  }
  const isAuthenticationError = /status:\s*401|invalid api key|auth_1001/i.test(providerMessage);
  const message = isAuthenticationError
    ? 'Prava rejected the sandbox API key. Set PRAVA_API_KEY to an active sandbox key and restart the server.'
    : 'Unable to create a Prava sandbox checkout. Verify PRAVA_API_URL and PRAVA_API_KEY, then try again.';

  return new AppError('PRAVA_CHECKOUT_UNAVAILABLE', 502, message, {
    provider_code: error?.code || null,
    provider_message: providerMessage
  });
}

function getBuyerUser(agent) {
  return agent ? getUserById.get(agent.user_id) : null;
}

function rentalDuration(value) {
  const duration = Number(value ?? 30);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 1440) {
    throw new AppError('VALIDATION_ERROR', 400, 'duration_minutes must be a whole number between 1 and 1440');
  }
  return duration;
}

function rentalAmountCents(listing, durationMinutes) {
  const price = Math.max(0, Number(listing.price_cents) || 0);
  return listing.rate_type === 'per_minute' ? price * durationMinutes : price;
}

function rentalRateLabel(listing) {
  const price = `$${((Number(listing.price_cents) || 0) / 100).toFixed(2)}`;
  return listing.rate_type === 'per_minute' ? `${price}/min` : `${price}/${listing.rate_type || 'session'}`;
}

function extractChargeId(charge) {
  return charge?.charge_id
    || charge?.id
    || charge?.transaction_id
    || charge?.payment_id
    || charge?.charge?.id
    || null;
}

async function notifyPurchaseSettlement(transaction, listing, settlement) {
  if (!settlement.credited) return;

  const amount = `$${(transaction.amount_cents / 100).toFixed(2)}`;
  const buyer = getBuyerUser(getAgentById.get(transaction.buyer_agent_id));
  const seller = getUserById.get(settlement.seller.user_id);

  if (buyer?.phone) {
    await sendPurchaseConfirmation(buyer.phone, {
      assetName: listing.title,
      amount,
      transactionId: transaction.id
    });
  }
  if (seller?.phone) {
    await sendAssetSold(seller.phone, {
      assetName: listing.title,
      amount,
      transactionId: transaction.id
    });
  }
}

async function notifyRentalSettlement(transaction, listing, settlement) {
  if (!settlement.credited) return;

  const amount = `$${(transaction.amount_cents / 100).toFixed(2)}`;
  const buyer = getBuyerUser(getAgentById.get(transaction.buyer_agent_id));
  const seller = getUserById.get(settlement.seller.user_id);

  if (buyer?.phone) {
    await sendRentalConfirmation(buyer.phone, {
      agentName: listing.title,
      amount,
      transactionId: transaction.id
    });
  }
  if (seller?.phone) {
    await sendRentalSold(seller.phone, {
      agentName: listing.title,
      amount,
      transactionId: transaction.id
    });
  }
}

/**
 * Charges only after the A2A task completed, then atomically marks the
 * transaction captured and credits the seller. A stable idempotency key protects
 * retries after a Prava/network failure.
 */
async function settleCompletedRental(transaction, listing) {
  if (transaction.status === 'captured') {
    return {
      already_settled: true,
      settlement_mode: isMockMandate(transaction) ? 'mock' : 'prava',
      seller_credited: false
    };
  }
  if (transaction.status !== 'approved') {
    throw new AppError('PAYMENT_REQUIRED', 402, 'Rental mandate has not been approved yet.');
  }

  let chargeId = null;
  let settlementMode = 'mock';
  if (!isMockMandate(transaction)) {
    settlementMode = 'prava';
    const charge = await chargeMandate(transaction.prava_mandate_id, {
      amount: (transaction.amount_cents / 100).toFixed(2),
      merchantName: process.env.WEFT_MERCHANT_NAME || 'Weft Marketplace',
      merchantUrl: process.env.WEFT_MERCHANT_URL || 'https://weft.marketplace',
      merchantCountry: process.env.WEFT_MERCHANT_COUNTRY || 'US',
      products: [{
        description: `Completed rental: ${listing.title}`,
        unit_price: (transaction.amount_cents / 100).toFixed(2),
        quantity: 1
      }],
      idempotencyKey: `weft-rental-${transaction.id}`
    });

    chargeId = extractChargeId(charge);
    if (!chargeId || charge.status !== 'awaiting_result' || charge.fetchStatus !== 'SUCCESS') {
      throw new AppError('PRAVA_CHARGE_FAILED', 502, 'Prava did not create a reportable mandate charge.', {
        provider_status: charge.status || null,
        provider_fetch_status: charge.fetchStatus || null
      });
    }
    await reportMandateCharge(transaction.prava_mandate_id, chargeId, {
      txn_status: 'APPROVED',
      response_code: '00',
      amount_paid: (transaction.amount_cents / 100).toFixed(2)
    });
  }

  const settlement = settleSellerCredit({
    transactionId: transaction.id,
    sellerId: listing.seller_id,
    amountCents: transaction.amount_cents,
    description: `Live agent rental: ${listing.title}`,
    status: 'captured'
  });

  if (settlement.credited) {
    incrementDownloadCount.run(listing.id);
    await notifyRentalSettlement(transaction, listing, settlement);
  }

  return {
    already_settled: false,
    settlement_mode: settlementMode,
    charge_id: chargeId,
    seller_credited: settlement.credited
  };
}

async function requireCompletedRentalTask(transaction, listing) {
  if (!transaction.rental_task_id) {
    throw new AppError('VALIDATION_ERROR', 400, 'No rental task exists to settle.');
  }

  const response = await getTaskStatus(listing.a2a_endpoint_url, transaction.rental_task_id);
  const task = handleTaskResponse(response);
  if (task.status !== 'completed') {
    throw new AppError('CONFLICT', 409, `Rental task is not complete. Current status: ${task.status || 'unknown'}`);
  }
  return task;
}

const router = Router();

// ID-based search: validates agent_id, logs usage, returns metadata only.
router.post('/search', async (req, res, next) => {
  try {
    const { agent_id, query, category, listing_type, max_price_cents } = req.body;
    if (!agent_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id is required');
    if (!getAgentById.get(agent_id)) {
      throw new AppError('NOT_FOUND', 404, 'Agent not found. Please register first using register_agent.');
    }

    const limit = 20;
    let results = [];
    if (query && process.env.OPENAI_API_KEY) {
      try {
        const nandaIds = await aiSearchNanda(query);
        results = (nandaIds || [])
          .map((id) => getListingById.get(id.replace(/^(skill|agent|tool)-/, '')))
          .filter(Boolean);
      } catch (error) {
        console.warn('[Marketplace] NANDA AI search failed; falling back to local FTS:', error.message);
      }
    }

    if (results.length === 0 && query) {
      try {
        const ftsQuery = buildFtsQuery(query);
        results = ftsQuery ? searchListingsFTS.all(ftsQuery, limit, 0) : [];
      } catch (error) {
        results = searchListingsByFilter.all(
          category || null, category || null,
          listing_type || null, listing_type || null,
          max_price_cents || null, max_price_cents || null,
          limit, 0
        );
      }
    }
    if (!query) {
      results = searchListingsByFilter.all(
        category || null, category || null,
        listing_type || null, listing_type || null,
        max_price_cents || null, max_price_cents || null,
        limit, 0
      );
    }

    if (query && results.length && (results.some((result) => result.listing_type === 'live') || LIVE_INTENT_PATTERN.test(query))) {
      try {
        results = await semanticSearch(query, results);
      } catch (error) {
        console.warn('[Marketplace] Semantic ranking failed; keeping FTS order:', error.message);
      }
    }

    logAgentUsage.run(uuidv4(), agent_id, 'search', null, query || 'browse', `Found ${results.length} results`);
    const safeResults = results.map((result) => ({
      id: result.id,
      title: result.title,
      description: result.description,
      category: result.category,
      listing_type: result.listing_type,
      price_cents: result.price_cents,
      currency: result.currency,
      rate_type: result.rate_type,
      tags: result.tags,
      capabilities: result.capabilities,
      sample_description: result.sample_description,
      download_count: result.download_count,
      is_free: result.price_cents === 0,
      guidance: result.price_cents === 0
        ? "Free asset. Use 'install' to get it immediately."
        : `Premium asset ($${(result.price_cents / 100).toFixed(2)}). Use 'purchase' and obtain human approval.`
    }));

    res.json({ data: { agent_id, results: safeResults, total: safeResults.length } });
  } catch (error) {
    next(error);
  }
});

// Create a Prava payment session for a premium static asset.
router.post('/purchase', async (req, res, next) => {
  try {
    const { agent_id, listing_id } = req.body;
    if (!agent_id || !listing_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id and listing_id required');

    const agent = getAgentById.get(agent_id);
    if (!agent) throw new AppError('NOT_FOUND', 404, 'Agent not found');
    const listing = getListingById.get(listing_id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    if (listing.price_cents <= 0) throw new AppError('VALIDATION_ERROR', 400, 'This listing is free. Use /install instead.');

    const buyer = getBuyerUser(agent);
    let session;
    let isMock = false;
    try {
      session = await createPaymentSession({
        totalAmount: (listing.price_cents / 100).toFixed(2),
        currency: listing.currency || 'USD',
        merchantName: process.env.WEFT_MERCHANT_NAME || 'Weft Marketplace',
        merchantUrl: process.env.WEFT_MERCHANT_URL || 'https://weft.marketplace',
        merchantCountry: process.env.WEFT_MERCHANT_COUNTRY || 'US',
        products: [{ description: listing.title, unit_price: (listing.price_cents / 100).toFixed(2), quantity: 1 }],
        userId: agent.user_id,
        userEmail: buyer?.email || 'buyer@weft.marketplace'
      });
    } catch (error) {
      if (!mockFallbackEnabled()) throw pravaCheckoutError(error);
      console.warn('[Marketplace] Prava session failed; using explicitly enabled local mock:', error.message);
      isMock = true;
      session = {
        session_id: `mock_${uuidv4()}`,
        payment_url: `https://checkout.prava.space/mock/${uuidv4()}`
      };
    }

    const transactionId = uuidv4();
    const paymentUrl = session.payment_url || session.iframe_url || null;
    createTransaction.run(
      transactionId, agent_id, listing_id,
      listing.price_cents, listing.currency || 'USD',
      'purchase', 'awaiting_approval',
      session.session_id, paymentUrl,
      null, null
    );

    let notification = { sent: false, skipped: true, reason: 'Buyer has no registered phone number' };
    if (buyer?.phone && !isMock) {
      notification = await sendPurchaseCheckout(buyer.phone, {
        assetName: listing.title,
        amount: `$${(listing.price_cents / 100).toFixed(2)}`,
        transactionId,
        paymentUrl
      });
    }

    logAgentUsage.run(uuidv4(), agent_id, 'purchase', listing_id, `Purchase ${listing.title}`, 'awaiting_approval');
    res.json({
      data: {
        transaction_id: transactionId,
        payment_url: paymentUrl,
        amount_cents: listing.price_cents,
        currency: listing.currency || 'USD',
        status: 'awaiting_approval',
        is_mock: isMock,
        notification,
        message: isMock
          ? 'Prava is unavailable, so this is a sandbox mock session. Use the explicit simulate-approval action to continue.'
          : `Please approve payment of $${(listing.price_cents / 100).toFixed(2)} at the payment_url.`
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/purchase/:txId/status', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');

    let status = tx.status;
    if (tx.status === 'awaiting_approval' && tx.prava_session_id && !isMockPayment(tx)) {
      try {
        const prava = await getPaymentStatus(tx.prava_session_id);
        if (prava.payment_ready || prava.payment_succeeded) {
          updateTransactionPrava.run(tx.prava_session_id, tx.prava_payment_url, 'approved', tx.id);
          status = 'approved';
        }
      } catch (error) {
        console.warn('[Marketplace] Prava status check failed:', error.message);
      }
    }

    res.json({ data: { transaction_id: tx.id, status, payment_url: tx.prava_payment_url, is_mock: isMockPayment(tx) } });
  } catch (error) {
    next(error);
  }
});

// This cannot approve a real Prava session. It exists solely for a locally-created
// mock session and is disabled by default in production.
router.post('/purchase/:txId/simulate-approval', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    if (tx.type !== 'purchase') throw new AppError('VALIDATION_ERROR', 400, 'Transaction is not a marketplace purchase');
    if (!isMockPayment(tx)) throw new AppError('VALIDATION_ERROR', 400, 'Only mock payment sessions can be simulated');
    if (!mockApprovalEnabled()) throw new AppError('FORBIDDEN', 403, 'Mock payment approval is disabled in this environment');

    if (tx.status !== 'delivered') updateTransactionStatus.run('approved', tx.id);
    res.json({ data: { transaction_id: tx.id, status: tx.status === 'delivered' ? 'delivered' : 'approved', simulated: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/purchase/:txId/deliver', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    const listing = getListingById.get(tx.listing_id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');

    if (tx.status === 'delivered') {
      const payload = await getDeliveryPayload(tx.listing_id);
      return res.json({ data: { ...payload, transaction_id: tx.id, already_delivered: true } });
    }

    let prava;
    if (!isMockPayment(tx) && tx.prava_session_id) {
      prava = await getPaymentStatus(tx.prava_session_id);
      if (!prava.payment_ready && !prava.payment_succeeded) {
        throw new AppError('PAYMENT_REQUIRED', 402, `Payment not approved yet. Prava status: ${prava.raw_status}.`);
      }
      updateTransactionPrava.run(tx.prava_session_id, tx.prava_payment_url, 'approved', tx.id);
      tx.status = 'approved';
    }

    if (isMockPayment(tx) && tx.status === 'awaiting_approval') {
      throw new AppError('PAYMENT_REQUIRED', 402, 'Mock payment has not been approved. Use the sandbox simulation action first.');
    }
    if (tx.status !== 'approved') {
      throw new AppError('PAYMENT_REQUIRED', 402, `Payment not approved yet. Current status: ${tx.status}`);
    }

    const payload = await getDeliveryPayload(tx.listing_id);
    if (prava?.payment_ready && !prava.payment_succeeded) {
      if (!prava.transaction_reference) {
        throw new AppError('PRAVA_PAYMENT_UNREPORTABLE', 502, 'Prava returned an approved checkout without a transaction reference.');
      }
      await reportPaymentStatus(tx.prava_session_id, prava.transaction_reference, {
        txn_status: 'APPROVED',
        response_code: '00',
        amount_paid: (tx.amount_cents / 100).toFixed(2)
      });
    }
    const settlement = settleSellerCredit({
      transactionId: tx.id,
      sellerId: listing.seller_id,
      amountCents: tx.amount_cents,
      description: `Sale: ${listing.title}`,
      status: 'delivered'
    });
    if (settlement.credited) {
      incrementDownloadCount.run(tx.listing_id);
      await notifyPurchaseSettlement(tx, listing, settlement);
    }

    logAgentUsage.run(uuidv4(), tx.buyer_agent_id, 'download', tx.listing_id, 'Delivered', 'success');
    res.json({ data: { ...payload, transaction_id: tx.id, already_delivered: false } });
  } catch (error) {
    next(error);
  }
});

router.post('/install', async (req, res, next) => {
  try {
    const { agent_id, listing_id } = req.body;
    if (!agent_id || !listing_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id and listing_id required');
    if (!getAgentById.get(agent_id)) throw new AppError('NOT_FOUND', 404, 'Agent not found');

    const listing = getListingById.get(listing_id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    if (listing.price_cents > 0) throw new AppError('PAYMENT_REQUIRED', 402, 'This listing is not free. Use /purchase instead.');

    const transactionId = uuidv4();
    createTransaction.run(
      transactionId, agent_id, listing_id,
      0, listing.currency || 'USD',
      'free_install', 'delivered',
      null, null, null, null
    );

    const payload = await getDeliveryPayload(listing_id);
    incrementDownloadCount.run(listing_id);
    logAgentUsage.run(uuidv4(), agent_id, 'install', listing_id, `Install ${listing.title}`, 'delivered');
    res.json({ data: { ...payload, transaction_id: transactionId } });
  } catch (error) {
    next(error);
  }
});

// Create a single-charge mandate. The estimated amount is priced per minute only
// when the listing declares rate_type=per_minute; all other rate types are fixed.
router.post('/rent', async (req, res, next) => {
  try {
    const { agent_id, listing_id, duration_minutes, task_description } = req.body;
    if (!agent_id || !listing_id) throw new AppError('VALIDATION_ERROR', 400, 'agent_id and listing_id required');

    const agent = getAgentById.get(agent_id);
    if (!agent) throw new AppError('NOT_FOUND', 404, 'Agent not found');
    const listing = getListingById.get(listing_id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    if (listing.listing_type !== 'live') throw new AppError('VALIDATION_ERROR', 400, 'This listing is not a live agent');

    const duration = rentalDuration(duration_minutes);
    const estimatedCost = rentalAmountCents(listing, duration);
    const buyer = getBuyerUser(agent);
    let mandate;
    let isMock = false;
    try {
      mandate = await createMandate({
        amount: (estimatedCost / 100).toFixed(2),
        currency: listing.currency || 'USD',
        merchantName: process.env.WEFT_MERCHANT_NAME || 'Weft Marketplace',
        merchantUrl: process.env.WEFT_MERCHANT_URL || 'https://weft.marketplace',
        merchantCountry: process.env.WEFT_MERCHANT_COUNTRY || 'US',
        frequency: 'one_time',
        maxCharges: 1,
        products: [{
          description: `Rental: ${listing.title} for up to ${duration} minutes`,
          unit_price: (estimatedCost / 100).toFixed(2),
          quantity: 1
        }],
        userId: agent.user_id,
        userEmail: buyer?.email || 'buyer@weft.marketplace'
      });
    } catch (error) {
      if (!mockFallbackEnabled()) throw pravaCheckoutError(error);
      console.warn('[Marketplace] Prava mandate failed; using explicitly enabled local mock:', error.message);
      isMock = true;
      mandate = {
        mandate_id: `mock_mdt_${uuidv4()}`,
        approval_url: `https://checkout.prava.space/mock/${uuidv4()}`
      };
    }

    const transactionId = uuidv4();
    const mandateId = mandate.mandate_id || null;
    const approvalUrl = mandate.approval_url || mandate.payment_url || mandate.iframe_url || null;
    createTransaction.run(
      transactionId, agent_id, listing_id,
      estimatedCost, listing.currency || 'USD',
      'rental', 'awaiting_approval',
      mandate.session_id || null, approvalUrl,
      mandateId, duration
    );

    // LINQ_PHONE_NUMBER is always the sender. The buyer's registered phone is the recipient.
    let notification = { sent: false, skipped: true, reason: 'Buyer has no registered phone number' };
    if (buyer?.phone && !isMock) {
      notification = await sendRentalNotification(buyer.phone, {
        agentName: listing.title,
        duration: `${duration} minutes`,
        rate: rentalRateLabel(listing),
        maxAmount: `$${(estimatedCost / 100).toFixed(2)}`,
        approvalUrl
      });
    }

    logAgentUsage.run(uuidv4(), agent_id, 'rent', listing_id, task_description || 'Rental request', 'awaiting_approval');
    res.json({
      data: {
        transaction_id: transactionId,
        approval_url: approvalUrl,
        estimated_cost_cents: estimatedCost,
        currency: listing.currency || 'USD',
        duration_minutes: duration,
        status: 'awaiting_approval',
        is_mock: isMock,
        notification,
        message: isMock
          ? `Mock rental created for ${listing.title}. Approve it with the sandbox simulation action.`
          : `Rental of ${listing.title} for ${duration} minutes. Approve at the approval_url.`
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/rent/:txId/status', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');

    let status = tx.status;
    if (tx.status === 'awaiting_approval' && !isMockMandate(tx)) {
      try {
        const buyerAgent = getAgentById.get(tx.buyer_agent_id);
        let mandateId = tx.prava_mandate_id;

        if (!mandateId && tx.prava_session_id) {
          const session = await getPaymentStatus(tx.prava_session_id);
          mandateId = session.mandate_id;
        }
        if (!mandateId) {
          const candidates = await listActiveMandates(buyerAgent?.user_id || tx.buyer_agent_id, {
            merchantName: process.env.WEFT_MERCHANT_NAME || 'Weft Marketplace',
            amount: (tx.amount_cents / 100).toFixed(2)
          });
          mandateId = candidates[0]?.id || null;
        }

        if (mandateId) {
          const mandate = await getMandateStatus(mandateId);
          const mandateStatus = mandate?.status || mandate?.mandate_status;
          if (['completed', 'confirmed', 'approved', 'active'].includes(mandateStatus)) {
            activateTransactionMandate.run(mandateId, tx.id);
            status = 'approved';
          } else if (['failed', 'declined', 'cancelled'].includes(mandateStatus)) {
            updateTransactionStatus.run('failed', tx.id);
            status = 'failed';
          }
        }
      } catch (error) {
        console.warn('[Marketplace] Prava mandate status check failed:', error.message);
      }
    }

    res.json({
      data: {
        transaction_id: tx.id,
        status,
        approval_url: tx.prava_payment_url,
        is_mock: isMockMandate(tx)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/rent/:txId/simulate-approval', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    if (tx.type !== 'rental') throw new AppError('VALIDATION_ERROR', 400, 'Transaction is not a live-agent rental');
    if (!isMockMandate(tx)) throw new AppError('VALIDATION_ERROR', 400, 'Only mock rental mandates can be simulated');
    if (!mockApprovalEnabled()) throw new AppError('FORBIDDEN', 403, 'Mock mandate approval is disabled in this environment');

    if (tx.status === 'awaiting_approval') updateTransactionStatus.run('approved', tx.id);
    res.json({ data: { transaction_id: tx.id, status: tx.status === 'awaiting_approval' ? 'approved' : tx.status, simulated: true } });
  } catch (error) {
    next(error);
  }
});

// Retries settlement without running the live agent again. This is useful if an
// A2A task completed but Prava returned a transient network/provider error.
router.post('/rent/:txId/settle', async (req, res, next) => {
  try {
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    const listing = getListingById.get(tx.listing_id);
    if (!listing || !listing.a2a_endpoint_url) throw new AppError('VALIDATION_ERROR', 400, 'No A2A endpoint configured for this listing');

    await requireCompletedRentalTask(tx, listing);
    const settlement = await settleCompletedRental(tx, listing);
    res.json({ data: { transaction_id: tx.id, task_id: tx.rental_task_id, status: 'completed', settlement } });
  } catch (error) {
    next(error);
  }
});

router.post('/rent/:txId/execute', async (req, res, next) => {
  try {
    const { message } = req.body;
    const tx = getTransactionById.get(req.params.txId);
    if (!tx) throw new AppError('NOT_FOUND', 404, 'Transaction not found');
    if (tx.status === 'captured') {
      return res.json({
        data: {
          task_id: tx.rental_task_id,
          status: 'completed',
          already_settled: true,
          message: 'This rental has already completed and been settled. Use a new rental for another task.'
        }
      });
    }
    if (tx.status !== 'approved') {
      throw new AppError('PAYMENT_REQUIRED', 402, 'Rental mandate has not been approved yet. Check status before executing tasks.');
    }

    const listing = getListingById.get(tx.listing_id);
    if (!listing || !listing.a2a_endpoint_url) {
      throw new AppError('VALIDATION_ERROR', 400, 'No A2A endpoint configured for this listing');
    }
    if (typeof message !== 'string' || !message.trim()) {
      throw new AppError('VALIDATION_ERROR', 400, 'message is required to execute a rental task');
    }

    const taskId = tx.rental_task_id || uuidv4();
    const result = await sendTask(listing.a2a_endpoint_url, { taskId, message });
    const task = handleTaskResponse(result);

    // Preserve the task ID synchronously before attempting any payment call so a
    // settlement retry can inspect the completed task without re-running it.
    updateTransactionRental.run(taskId, 'approved', tx.id);

    const response = {
      task_id: taskId,
      status: task.status,
      result: task.output ?? (task.artifacts?.length ? task.artifacts : null),
      clarification_needed: task.status === 'input-required',
      question: task.clarificationQuestion || null
    };

    if (task.status !== 'completed') {
      return res.json({ data: response });
    }

    try {
      response.settlement = await settleCompletedRental({ ...tx, rental_task_id: taskId }, listing);
      response.settlement_status = 'captured';
      return res.json({ data: response });
    } catch (settlementError) {
      console.error('[Marketplace] Rental task completed but settlement failed:', settlementError.message);
      return res.status(502).json({
        data: {
          ...response,
          settlement_status: 'failed',
          settlement_error: settlementError.message,
          retry_endpoint: `/api/marketplace/rent/${tx.id}/settle`
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
