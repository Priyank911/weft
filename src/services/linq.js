import { LinqAPIV3 } from '@linqapp/sdk';

let linqClient;
try {
  linqClient = new LinqAPIV3({
    apiKey: process.env.LINQ_API_KEY
  });
} catch (error) {
  console.warn('[LinqService] Warning: Could not initialize LinqAPIV3', error.message);
}

// Sanitize phone number to E.164 format (strip spaces, parens, dashes)
function toE164(phone) {
  const digits = phone.replace(/[^0-9+]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

async function sendText(phoneNumber, text) {
  const cleanNumber = toE164(phoneNumber);
  await linqClient.chats.create({
    from: toE164(process.env.LINQ_PHONE_NUMBER),
    to: [cleanNumber],
    message: { parts: [{ type: 'text', value: text }] }
  });
}

export async function sendRentalNotification(phoneNumber, { agentName, duration, rate, maxAmount, approvalUrl }) {
  try {
    if (!linqClient) {
      console.warn('[LinqService] Client not configured, skipping sendRentalNotification');
      return;
    }

    const text = `Rental started for ${agentName}!\nDuration: ${duration} mins\nRate: ${rate}\nMax: ${maxAmount}\nApprove here: ${approvalUrl}`;
    await sendText(phoneNumber, text);
  } catch (error) {
    console.error('[LinqService] Error in sendRentalNotification:', error);
  }
}

export async function sendPurchaseConfirmation(phoneNumber, { assetName, amount, transactionId }) {
  try {
    if (!linqClient) {
      console.warn('[LinqService] Client not configured, skipping sendPurchaseConfirmation');
      return;
    }

    const text = `Purchase confirmed for ${assetName}.\nAmount: ${amount}\nTransaction ID: ${transactionId}`;
    await sendText(phoneNumber, text);
  } catch (error) {
    console.error('[LinqService] Error in sendPurchaseConfirmation:', error);
  }
}

export async function sendReceipt(phoneNumber, { transactionId, amount, assetName, timestamp }) {
  try {
    if (!linqClient) {
      console.warn('[LinqService] Client not configured, skipping sendReceipt');
      return;
    }

    const text = `Receipt for ${assetName}\nAmount: ${amount}\nDate: ${new Date(timestamp).toLocaleString()}\nTxID: ${transactionId}`;
    await sendText(phoneNumber, text);
  } catch (error) {
    console.error('[LinqService] Error in sendReceipt:', error);
  }
}

export async function sendPurchaseCheckout(phoneNumber, { assetName, amount, transactionId, paymentUrl }) {
  try {
    if (!linqClient) {
      console.warn('[LinqService] Client not configured, skipping sendPurchaseCheckout');
      return;
    }

    const text = `Please complete your purchase for ${assetName}.\nAmount: ${amount}\nTransaction ID: ${transactionId}\nPayment Link: ${paymentUrl}`;
    await sendText(phoneNumber, text);
  } catch (error) {
    console.error('[LinqService] Error in sendPurchaseCheckout:', error);
  }
}

export async function sendAssetSold(phoneNumber, { assetName, amount, transactionId }) {
  try {
    if (!linqClient) {
      console.warn('[LinqService] Client not configured, skipping sendAssetSold');
      return;
    }

    const text = `Great news! Your asset ${assetName} was just purchased.\nAmount: ${amount}\nTransaction ID: ${transactionId}`;
    await sendText(phoneNumber, text);
  } catch (error) {
    console.error('[LinqService] Error in sendAssetSold:', error);
  }
}

export async function sendActivationSuccess(phoneNumber) {
  try {
    if (!linqClient) {
      console.warn('[LinqService] Client not configured, skipping sendActivationSuccess');
      return;
    }

    const text = 'Weft account is successfully activated.';
    await sendText(phoneNumber, text);
  } catch (error) {
    console.error('[LinqService] Error in sendActivationSuccess:', error);
  }
}
