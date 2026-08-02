import { LinqAPIV3 } from '@linqapp/sdk';

let linqClient;
try {
  linqClient = new LinqAPIV3({
    apiKey: process.env.LINQ_API_KEY
  });
} catch (error) {
  console.warn('[LinqService] Warning: Could not initialize LinqAPIV3', error.message);
}

// Linq requires phone handles in E.164 format.
function toE164(phone) {
  if (typeof phone !== 'string' || !phone.trim()) {
    throw new Error('A recipient phone number is required for Linq messaging');
  }

  const digits = phone.replace(/[^0-9+]/g, '');
  if (!digits || digits === '+') {
    throw new Error('Phone number must contain digits in E.164 format');
  }

  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function isLinqConfigured() {
  return Boolean(linqClient && process.env.LINQ_API_KEY && process.env.LINQ_PHONE_NUMBER);
}

/**
 * Optional admin preflight. Normal notification sends do not call this because
 * Linq automatically chooses iMessage, RCS, or SMS and capability checks are
 * rate-limited by the provider.
 */
export async function checkIMessageCapability(phoneNumber) {
  if (!isLinqConfigured()) {
    return { available: null, skipped: true, reason: 'Linq is not configured' };
  }

  const result = await linqClient.capability.checkImessage({
    address: toE164(phoneNumber),
    from: toE164(process.env.LINQ_PHONE_NUMBER)
  });

  return { ...result, skipped: false };
}

async function sendText(phoneNumber, text) {
  if (!isLinqConfigured()) {
    throw new Error('Linq is not configured. Set LINQ_API_KEY and LINQ_PHONE_NUMBER.');
  }

  return linqClient.chats.create({
    // This must be a phone number assigned to the Linq account: the Weft
    // platform sender, never the buyer or seller recipient.
    from: toE164(process.env.LINQ_PHONE_NUMBER),
    to: [toE164(phoneNumber)],
    message: { parts: [{ type: 'text', value: text }] }
  });
}

async function sendNotification(name, phoneNumber, text) {
  try {
    if (!isLinqConfigured()) {
      console.warn(`[LinqService] Linq is not configured, skipping ${name}`);
      return { sent: false, skipped: true, reason: 'Linq is not configured' };
    }

    const result = await sendText(phoneNumber, text);
    return {
      sent: true,
      message_id: result?.id || result?.messageId || result?.chat_id || null
    };
  } catch (error) {
    if (error?.status === 403 || error?.message?.includes('Recipient not allowed')) {
      console.warn(`[LinqService] Linq Sandbox notice for ${name}: Phone ${phoneNumber} is unverified on Linq developer sandbox account. Skipping SMS.`);
      return { sent: false, skipped: true, reason: 'Recipient not allowed in sandbox' };
    }
    console.error(`[LinqService] Error in ${name}:`, error.message || error);
    return { sent: false, skipped: false, error: error.message };
  }
}

export function sendRentalNotification(phoneNumber, { agentName, duration, rate, maxAmount, approvalUrl }) {
  return sendNotification(
    'sendRentalNotification',
    phoneNumber,
    `Please approve your rental for ${agentName}.\nDuration: ${duration}\nRate: ${rate}\nMax: ${maxAmount}\nApproval Link: ${approvalUrl}`
  );
}

export function sendPurchaseConfirmation(phoneNumber, { assetName, amount, transactionId }) {
  return sendNotification(
    'sendPurchaseConfirmation',
    phoneNumber,
    `Purchase confirmed for ${assetName}.\nAmount: ${amount}\nTransaction ID: ${transactionId}`
  );
}

export function sendReceipt(phoneNumber, { transactionId, amount, assetName, timestamp }) {
  return sendNotification(
    'sendReceipt',
    phoneNumber,
    `Receipt for ${assetName}\nAmount: ${amount}\nDate: ${new Date(timestamp).toLocaleString()}\nTxID: ${transactionId}`
  );
}

export function sendPurchaseCheckout(phoneNumber, { assetName, amount, transactionId, paymentUrl }) {
  return sendNotification(
    'sendPurchaseCheckout',
    phoneNumber,
    `Please complete your purchase for ${assetName}.\nAmount: ${amount}\nTransaction ID: ${transactionId}\nPayment Link: ${paymentUrl}`
  );
}

export function sendAssetSold(phoneNumber, { assetName, amount, transactionId }) {
  return sendNotification(
    'sendAssetSold',
    phoneNumber,
    `Great news! Your asset ${assetName} was just purchased.\nAmount: ${amount}\nTransaction ID: ${transactionId}`
  );
}

export function sendActivationSuccess(phoneNumber) {
  return sendNotification('sendActivationSuccess', phoneNumber, 'Weft account is successfully activated.');
}

export function sendRentalConfirmation(phoneNumber, { agentName, amount, transactionId }) {
  return sendNotification(
    'sendRentalConfirmation',
    phoneNumber,
    `Rental completed for ${agentName}.\nAmount: ${amount}\nTransaction ID: ${transactionId}`
  );
}

export function sendRentalSold(phoneNumber, { agentName, amount, transactionId }) {
  return sendNotification(
    'sendRentalSold',
    phoneNumber,
    `Great news! Your live agent ${agentName} completed a rental.\nAmount: ${amount}\nTransaction ID: ${transactionId}`
  );
}
