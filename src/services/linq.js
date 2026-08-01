import { LinqAPIV3 } from '@linqapp/sdk';

let linqClient;
try {
  linqClient = new LinqAPIV3({
    apiKey: process.env.LINQ_API_KEY
  });
} catch (error) {
  console.warn('[LinqService] Warning: Could not initialize LinqAPIV3', error.message);
}

async function sendText(phoneNumber, text) {
  await linqClient.chats.create({
    from: process.env.LINQ_PHONE_NUMBER,
    to: [phoneNumber],
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
