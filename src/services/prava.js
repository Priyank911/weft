import fetch from 'node-fetch';

if (!process.env.PRAVA_API_URL) {
  console.warn('[PravaService] PRAVA_API_URL not set in .env — falling back to default, this will likely fail against real sandbox');
}

const PRAVA_API_URL = process.env.PRAVA_API_URL || 'https://api.prava.com';
const PRAVA_API_KEY = process.env.PRAVA_API_KEY || '';

function getHeaders() {
  return {
    'Authorization': `Bearer ${PRAVA_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function createPaymentSession({ totalAmount, currency, merchantName, merchantUrl, merchantCountry, products, userId, userEmail, idempotencyKey }) {
  try {
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
    throw { error: { code: 'PRAVA_SESSION_ERROR', message: error.message } };
  }
}

export async function getPaymentStatus(sessionId) {
  try {
    const response = await fetch(`${PRAVA_API_URL}/v1/sessions/${sessionId}/payment-result`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    // Prava returns session-level status AND line-item statuses
    // We check line items for 'credentials_generated' which means payment succeeded
    let paymentSucceeded = false;
    if (data.transactions && data.transactions.length > 0) {
      for (const txn of data.transactions) {
        if (txn.line_items && txn.line_items.length > 0) {
          for (const item of txn.line_items) {
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
      data
    };
  } catch (error) {
    console.error('[PravaService] Error in getPaymentStatus:', error);
    throw { error: { code: 'PRAVA_STATUS_ERROR', message: error.message } };
  }
}

export async function getMandateStatus(mandateId) {
  try {
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
    throw { error: { code: 'PRAVA_MANDATE_STATUS_ERROR', message: error.message } };
  }
}

export async function createMandate({ amount, currency, merchantName, merchantUrl, merchantCountry, frequency, validUntil, maxCharges, products, userId, userEmail }) {
  try {
    const body = {
      user_id: userId,
      user_email: userEmail,
      total_amount: amount,
      currency: currency,
      intent: 'mandate_setup',
      mandate_setup: {
        recurring_frequency: frequency,
        merchant_scope: 'listed',
        max_charges: maxCharges,
        valid_until: validUntil
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
    console.log('[PravaService] Raw createMandate response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('[PravaService] Error in createMandate:', error);
    throw { error: { code: 'PRAVA_MANDATE_ERROR', message: error.message } };
  }
}

export async function chargeMandate(mandateId, { amount, currency, merchantName, merchantUrl, merchantCountry, products }) {
  try {
    const body = {
      amount: amount,
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
    throw { error: { code: 'PRAVA_CHARGE_ERROR', message: error.message } };
  }
}

export async function reportMandateCharge(mandateId, chargeId, outcome) {
  try {
    const response = await fetch(`${PRAVA_API_URL}/v1/mandates/${mandateId}/charges/${chargeId}/report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ outcome })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[PravaService] HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[PravaService] Error in reportMandateCharge:', error);
    throw { error: { code: 'PRAVA_REPORT_ERROR', message: error.message } };
  }
}

export async function revokeSession(sessionId) {
  try {
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
    throw { error: { code: 'PRAVA_REVOKE_ERROR', message: error.message } };
  }
}
