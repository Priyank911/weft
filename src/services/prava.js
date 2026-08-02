import fetch from 'node-fetch';

if (!process.env.PRAVA_API_URL) {
  console.warn('[PravaService] PRAVA_API_URL not set in .env — falling back to default, this will likely fail against real sandbox');
}

const PRAVA_API_URL = (process.env.PRAVA_API_URL || 'https://sandbox.api.prava.space').replace(/\/$/, '');
const PRAVA_API_KEY = process.env.PRAVA_API_KEY || '';

function providerError(code, error) {
  const wrapped = new Error(error?.message || String(error));
  wrapped.code = code;
  wrapped.providerCode = error?.code || null;
  wrapped.cause = error;
  return wrapped;
}

function requirePravaConfiguration() {
  if (!PRAVA_API_KEY || PRAVA_API_KEY.includes('your_key_here')) {
    const error = new Error('Prava sandbox API key is missing. Set PRAVA_API_KEY to an active sandbox key from your Prava dashboard.');
    error.code = 'PRAVA_CONFIGURATION_ERROR';
    throw error;
  }
  if (PRAVA_API_URL.includes('sandbox.') && !PRAVA_API_KEY.startsWith('sk_test_')) {
    const error = new Error('Prava sandbox requires an sk_test_* secret key. Create a fresh sandbox key in the Prava dashboard and restart the server.');
    error.code = 'PRAVA_CONFIGURATION_ERROR';
    throw error;
  }
}

function getHeaders() {
  return {
    'Authorization': `Bearer ${PRAVA_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function createPaymentSession({ totalAmount, currency, merchantName, merchantUrl, merchantCountry, products, userId, userEmail, idempotencyKey }) {
  try {
    requirePravaConfiguration();
    const body = {
      user_id: userId,
      user_email: userEmail,
      total_amount: totalAmount,
      currency: currency,
      purchase_context: [{
        merchant_details: {
          name: merchantName,
          url: merchantUrl,
          country_code_iso2: merchantCountry
        },
        product_details: products.map(p => ({
          description: p.description,
          unit_price: p.unit_price || p.unitPrice,
          quantity: p.quantity || 1
        }))
      }]
    };

    const headers = getHeaders();
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(`${PRAVA_API_URL}/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    return {
      session_id: data.session_id,
      payment_url: data.payment_url,
      iframe_url: data.iframe_url,
      expires_at: data.expires_at
    };
  } catch (error) {
    console.error('[PravaService] Error in createPaymentSession:', error);
    throw providerError('PRAVA_SESSION_ERROR', error);
  }
}

export async function getPaymentStatus(sessionId) {
  if (!sessionId || sessionId.startsWith('mock_')) {
    return { status: 'mock_sandbox', paymentSucceeded: true, paymentReady: true, raw: { isMock: true } };
  }

  try {
    requirePravaConfiguration();
    const response = await fetch(`${PRAVA_API_URL}/v1/sessions/${sessionId}/payment-result`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'session_not_found', paymentSucceeded: false, paymentReady: false };
      }
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    // Prava returns session-level status AND line-item statuses
    // We check line items for 'credentials_generated' which means payment succeeded
    let paymentSucceeded = false;
    let paymentReady = false;
    let transactionReference = null;
    if (data.transactions && data.transactions.length > 0) {
      for (const txn of data.transactions) {
        if (txn.line_items && txn.line_items.length > 0) {
          for (const item of txn.line_items) {
            if (item.status === 'awaiting_result' && item.token && item.dynamic_cvv) {
              paymentReady = true;
              transactionReference ||= item.txn_ref_id || null;
            }
            if (item.status === 'credentials_generated' || item.status === 'approved' || item.status === 'captured') {
              paymentSucceeded = true;
            }
          }
        }
        if (txn.status === 'approved' || txn.status === 'captured' || txn.status === 'completed') {
          paymentSucceeded = true;
        }
      }
    }
    // Also check top-level status
    if (data.status === 'approved' || data.status === 'captured' || data.status === 'completed') {
      paymentSucceeded = true;
    }

    return {
      raw_status: data.status,
      order_id: data.order_id || null,
      payment_succeeded: paymentSucceeded,
      payment_ready: paymentReady,
      transaction_reference: transactionReference,
      mandate_id: data.mandate_id || data.mandate?.id || null,
      data
    };
  } catch (error) {
    console.error('[PravaService] Error in getPaymentStatus:', error);
    throw providerError('PRAVA_STATUS_ERROR', error);
  }
}

export async function getMandateStatus(mandateId) {
  try {
    requirePravaConfiguration();
    const response = await fetch(`${PRAVA_API_URL}/v1/mandates/${mandateId}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.json(); // raw payload; caller inspects the returned status field
  } catch (error) {
    console.error('[PravaService] Error in getMandateStatus:', error);
    throw providerError('PRAVA_MANDATE_STATUS_ERROR', error);
  }
}

export async function createMandate({ amount, currency, merchantName, merchantUrl, merchantCountry, frequency, validUntil, maxCharges, products, userId, userEmail }) {
  try {
    requirePravaConfiguration();
    const body = {
      user_id: userId,
      user_email: userEmail,
      total_amount: amount,
      currency: currency,
      mandate_setup: {
        intent: 'mandate_setup',
        recurring_frequency: frequency,
        merchant_scope: 'listed',
        max_charges: maxCharges,
        ...(validUntil ? { valid_until: validUntil } : {})
      },
      purchase_context: [{
        merchant_details: {
          name: merchantName,
          url: merchantUrl,
          country_code_iso2: merchantCountry
        },
        product_details: products.map(p => ({
          description: p.description,
          unit_price: p.unit_price || p.unitPrice,
          quantity: p.quantity || 1
        }))
      }]
    };

    const response = await fetch(`${PRAVA_API_URL}/v1/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    return {
      ...data,
      session_id: data.session_id || data.id || null,
      mandate_id: data.mandate_id || data.mandate?.id || null,
      approval_url: data.approval_url || data.payment_url || data.iframe_url || null
    };
  } catch (error) {
    console.error('[PravaService] Error in createMandate:', error);
    throw providerError('PRAVA_MANDATE_ERROR', error);
  }
}

export async function chargeMandate(mandateId, { amount, merchantName, merchantUrl, merchantCountry, products, idempotencyKey }) {
  try {
    requirePravaConfiguration();
    const body = {
      amount: amount,
      ...(idempotencyKey ? { reference: idempotencyKey } : {}),
      purchase_context: [{
        merchant_details: {
          name: merchantName,
          url: merchantUrl,
          country_code_iso2: merchantCountry
        },
        product_details: products.map(p => ({
          description: p.description,
          unit_price: p.unit_price || p.unitPrice,
          quantity: p.quantity || 1
        }))
      }]
    };

    const response = await fetch(`${PRAVA_API_URL}/v1/mandates/${mandateId}/charge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[PravaService] Error in chargeMandate:', error);
    throw providerError('PRAVA_CHARGE_ERROR', error);
  }
}

export async function reportMandateCharge(mandateId, chargeId, outcome) {
  try {
    requirePravaConfiguration();
    const response = await fetch(`${PRAVA_API_URL}/v1/mandates/${mandateId}/charges/${chargeId}/report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        txn_status: outcome?.txn_status || 'APPROVED',
        txn_type: 'PURCHASE',
        ...(outcome?.authorization_code ? { authorization_code: outcome.authorization_code } : {}),
        ...(outcome?.response_code ? { response_code: outcome.response_code } : {}),
        ...(outcome?.amount_paid ? { amount_paid: outcome.amount_paid } : {})
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[PravaService] Error in reportMandateCharge:', error);
    throw providerError('PRAVA_REPORT_ERROR', error);
  }
}

export async function reportPaymentStatus(sessionId, transactionReference, outcome) {
  try {
    requirePravaConfiguration();
    const response = await fetch(`${PRAVA_API_URL}/v1/sessions/${sessionId}/report-status`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        txn_ref_id: transactionReference,
        txn_status: outcome?.txn_status || 'APPROVED',
        txn_type: 'PURCHASE',
        ...(outcome?.authorization_code ? { authorization_code: outcome.authorization_code } : {}),
        ...(outcome?.response_code ? { response_code: outcome.response_code } : {}),
        ...(outcome?.amount_paid ? { amount_paid: outcome.amount_paid } : {})
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[PravaService] Error in reportPaymentStatus:', error);
    throw providerError('PRAVA_REPORT_ERROR', error);
  }
}

export async function listActiveMandates(customerId, { merchantName, amount } = {}) {
  try {
    requirePravaConfiguration();
    const query = new URLSearchParams({ customer_id: customerId, standing_only: 'true' });
    const response = await fetch(`${PRAVA_API_URL}/v1/mandates?${query}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const mandates = (await response.json()).mandates || [];
    return mandates
      .filter((mandate) => mandate.status === 'active')
      .filter((mandate) => !merchantName || mandate.merchantName === merchantName)
      .filter((mandate) => !amount || Number(mandate.approvedAmount) === Number(amount))
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  } catch (error) {
    console.error('[PravaService] Error in listActiveMandates:', error);
    throw providerError('PRAVA_MANDATE_LIST_ERROR', error);
  }
}

export async function revokeSession(sessionId) {
  try {
    requirePravaConfiguration();
    const response = await fetch(`${PRAVA_API_URL}/v1/sessions/${sessionId}/revoke`, {
      method: 'POST',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[PravaService] Error in revokeSession:', error);
    throw providerError('PRAVA_REVOKE_ERROR', error);
  }
}
