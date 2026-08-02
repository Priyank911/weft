import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize database
// Allow isolated test/demo databases without touching the default local data.
const DB_PATH = process.env.WEFT_DB_PATH
  ? resolve(process.env.WEFT_DB_PATH)
  : join(__dirname, '..', '..', 'weft.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema migration
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

console.error('[DB] SQLite initialized at', DB_PATH);

// ============================================
// Prepared Statement Helpers
// ============================================

// --- Users ---
export const createUser = db.prepare(`
  INSERT INTO users (id, email, password_hash, role, phone, prava_customer_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

export const getUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);
export const getUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);

export const updateUser = db.prepare(`
  UPDATE users SET role = ?, phone = ?, prava_customer_id = ?, updated_at = datetime('now')
  WHERE id = ?
`);

// --- Agent Profiles ---
export const createAgentProfile = db.prepare(`
  INSERT INTO agent_profiles (id, user_id, agent_type, agent_name, capabilities, prava_wallet_linked, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const getAgentById = db.prepare(`SELECT * FROM agent_profiles WHERE id = ?`);

export const getAgentsByUserId = db.prepare(`
  SELECT * FROM agent_profiles WHERE user_id = ?
`);

export const updateAgentProfile = db.prepare(`
  UPDATE agent_profiles SET agent_name = ?, capabilities = ?, prava_wallet_linked = ?, metadata = ?, updated_at = datetime('now')
  WHERE id = ?
`);

// --- Seller Profiles ---
export const createSellerProfile = db.prepare(`
  INSERT INTO seller_profiles (id, user_id, business_name, description)
  VALUES (?, ?, ?, ?)
`);

export const getSellerById = db.prepare(`SELECT * FROM seller_profiles WHERE id = ?`);
export const getSellerByUserId = db.prepare(`SELECT * FROM seller_profiles WHERE user_id = ?`);

export const updateSellerBalance = db.prepare(`
  UPDATE seller_profiles SET payout_balance_cents = ?, total_sales = total_sales + 1, updated_at = datetime('now')
  WHERE id = ?
`);

// --- Listings ---
export const createListing = db.prepare(`
  INSERT INTO listings (id, seller_id, title, description, long_description, category, listing_type, price_cents, currency, rate_type, rate_limit, status, a2a_endpoint_url, capabilities, tags, sample_description, download_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getListingById = db.prepare(`SELECT * FROM listings WHERE id = ?`);

export const getListingsBySeller = db.prepare(`
  SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC
`);

export const getActiveListings = db.prepare(`
  SELECT * FROM listings WHERE status = 'active' ORDER BY created_at DESC LIMIT ? OFFSET ?
`);

export const updateListing = db.prepare(`
  UPDATE listings SET title = ?, description = ?, long_description = ?, category = ?, price_cents = ?, currency = ?, rate_type = ?, rate_limit = ?, capabilities = ?, tags = ?, sample_description = ?, a2a_endpoint_url = ?, updated_at = datetime('now')
  WHERE id = ?
`);

export const publishListing = db.prepare(`
  UPDATE listings SET status = 'active', nanda_agent_id = ?, updated_at = datetime('now')
  WHERE id = ?
`);

export const archiveListing = db.prepare(`
  UPDATE listings SET status = 'archived', updated_at = datetime('now')
  WHERE id = ?
`);

export const incrementDownloadCount = db.prepare(`
  UPDATE listings SET download_count = download_count + 1 WHERE id = ?
`);

// Search listings using FTS
export const searchListingsFTS = db.prepare(`
  SELECT l.* FROM listings l
  JOIN listings_fts fts ON l.id = fts.listing_id
  WHERE listings_fts MATCH ?
  AND l.status = 'active'
  ORDER BY rank
  LIMIT ? OFFSET ?
`);

// Search listings by category/type
export const searchListingsByFilter = db.prepare(`
  SELECT * FROM listings
  WHERE status = 'active'
  AND (? IS NULL OR category = ?)
  AND (? IS NULL OR listing_type = ?)
  AND (? IS NULL OR price_cents <= ?)
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);

// --- Assets ---
export const createAsset = db.prepare(`
  INSERT INTO assets (id, listing_id, original_filename, stored_path, mime_type, size_bytes, manifest_json, is_zip)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getAssetsByListing = db.prepare(`
  SELECT * FROM assets WHERE listing_id = ?
`);

export const getAssetById = db.prepare(`SELECT * FROM assets WHERE id = ?`);

// --- Transactions ---
export const createTransaction = db.prepare(`
  INSERT INTO transactions (id, buyer_agent_id, listing_id, amount_cents, currency, type, status, prava_session_id, prava_payment_url, prava_mandate_id, rental_duration_minutes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getTransactionById = db.prepare(`SELECT * FROM transactions WHERE id = ?`);

export const getTransactionsByAgent = db.prepare(`
  SELECT t.*, l.title as listing_title, l.listing_type
  FROM transactions t
  JOIN listings l ON t.listing_id = l.id
  WHERE t.buyer_agent_id = ?
  ORDER BY t.created_at DESC
`);

export const updateTransactionStatus = db.prepare(`
  UPDATE transactions SET status = ?, updated_at = datetime('now')
  WHERE id = ?
`);

export const updateTransactionPrava = db.prepare(`
  UPDATE transactions SET prava_session_id = ?, prava_payment_url = ?, status = ?, updated_at = datetime('now')
  WHERE id = ?
`);

export const updateTransactionMandate = db.prepare(`
  UPDATE transactions SET prava_mandate_id = ?, prava_payment_url = ?, status = ?, updated_at = datetime('now')
  WHERE id = ?
`);

export const activateTransactionMandate = db.prepare(`
  UPDATE transactions SET prava_mandate_id = ?, status = 'approved', updated_at = datetime('now')
  WHERE id = ?
`);

export const updateTransactionRental = db.prepare(`
  UPDATE transactions SET rental_task_id = ?, status = ?, updated_at = datetime('now')
  WHERE id = ?
`);

// --- Agent Usage Log ---
export const logAgentUsage = db.prepare(`
  INSERT INTO agent_usage_log (id, agent_profile_id, tool_name, listing_id, request_summary, response_summary)
  VALUES (?, ?, ?, ?, ?, ?)
`);

export const getUsageByAgent = db.prepare(`
  SELECT * FROM agent_usage_log WHERE agent_profile_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?
`);

// --- Seller Ledger ---
export const createLedgerEntry = db.prepare(`
  INSERT INTO seller_ledger (id, seller_id, transaction_id, amount_cents, type, balance_after_cents, description)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const getLedgerBySeller = db.prepare(`
  SELECT * FROM seller_ledger WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
`);

export const getLedgerCreditByTransaction = db.prepare(`
  SELECT * FROM seller_ledger
  WHERE transaction_id = ? AND type = 'credit'
  LIMIT 1
`);

/**
 * Marks a paid marketplace transaction as settled and credits its seller exactly
 * once. Keeping the status transition and ledger mutation in one SQLite
 * transaction prevents duplicate deliveries/retries from double-paying sellers.
 */
export function settleSellerCredit({ transactionId, sellerId, amountCents, description, status }) {
  const settle = db.transaction(() => {
    const existingCredit = getLedgerCreditByTransaction.get(transactionId);
    const seller = getSellerById.get(sellerId);

    if (!seller) {
      throw new Error(`Seller not found for transaction ${transactionId}`);
    }

    if (!existingCredit) {
      const newBalance = seller.payout_balance_cents + amountCents;
      createLedgerEntry.run(
        randomUUID(),
        sellerId,
        transactionId,
        amountCents,
        'credit',
        newBalance,
        description
      );
      updateSellerBalance.run(newBalance, sellerId);
    }

    updateTransactionStatus.run(status, transactionId);
    return { seller, credited: !existingCredit };
  });

  return settle();
}

// --- FTS Triggers (manually sync) ---
export function syncListingFTS(listing) {
  try {
    // Delete existing FTS entry
    db.prepare(`DELETE FROM listings_fts WHERE listing_id = ?`).run(listing.id);
    // Insert new FTS entry
    db.prepare(`
      INSERT INTO listings_fts (listing_id, title, description, category, tags, capabilities)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      listing.id,
      listing.title || '',
      listing.description || '',
      listing.category || '',
      listing.tags || '[]',
      listing.capabilities || '[]'
    );
  } catch (err) {
    console.warn('[DB] FTS sync warning:', err.message);
  }
}

// --- Transaction helper ---
export function runTransaction(fn) {
  const transaction = db.transaction(fn);
  return transaction();
}

export default db;
