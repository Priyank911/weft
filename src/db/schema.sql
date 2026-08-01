-- Weft Agentic Marketplace Database Schema
-- SQLite with better-sqlite3

-- Users table (both buyers and sellers)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK(role IN ('buyer', 'seller', 'both')),
  phone TEXT,
  prava_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent profiles (registered buyer agents via MCP)
CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK(agent_type IN ('claude_code', 'codex', 'antigravity', 'other')),
  agent_name TEXT NOT NULL,
  capabilities TEXT DEFAULT '[]', -- JSON array
  prava_wallet_linked INTEGER DEFAULT 0,
  oauth_token_hash TEXT,
  metadata TEXT DEFAULT '{}', -- JSON object for extra agent info
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seller profiles
CREATE TABLE IF NOT EXISTS seller_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  description TEXT,
  payout_balance_cents INTEGER DEFAULT 0,
  payout_currency TEXT DEFAULT 'USD',
  total_sales INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Marketplace listings
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  category TEXT,
  listing_type TEXT NOT NULL DEFAULT 'static' CHECK(listing_type IN ('static', 'live')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  rate_type TEXT DEFAULT 'one_time' CHECK(rate_type IN ('one_time', 'per_use', 'per_minute', 'per_session')),
  rate_limit TEXT, -- e.g., "100 requests/day"
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
  a2a_endpoint_url TEXT, -- for live agents only
  nanda_agent_id TEXT, -- ID returned by NANDA Index after publishing
  capabilities TEXT DEFAULT '[]', -- JSON array
  tags TEXT DEFAULT '[]', -- JSON array
  sample_description TEXT, -- preview text shown in search
  download_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assets (uploaded files for static listings)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER DEFAULT 0,
  manifest_json TEXT, -- JSON manifest for zip files
  is_zip INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transactions (purchases and rentals)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  buyer_agent_id TEXT NOT NULL REFERENCES agent_profiles(id),
  listing_id TEXT NOT NULL REFERENCES listings(id),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  type TEXT NOT NULL CHECK(type IN ('purchase', 'rental', 'free_install')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'awaiting_approval', 'approved', 'captured', 'delivered', 'failed', 'voided', 'expired')),
  prava_session_id TEXT,
  prava_payment_url TEXT,
  prava_mandate_id TEXT,
  rental_duration_minutes INTEGER,
  rental_task_id TEXT, -- A2A task ID for live agent rentals
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent usage log (every tool call tracked per agent)
CREATE TABLE IF NOT EXISTS agent_usage_log (
  id TEXT PRIMARY KEY,
  agent_profile_id TEXT NOT NULL REFERENCES agent_profiles(id),
  tool_name TEXT NOT NULL,
  listing_id TEXT,
  request_summary TEXT,
  response_summary TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seller ledger (earnings tracking)
CREATE TABLE IF NOT EXISTS seller_ledger (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES seller_profiles(id),
  transaction_id TEXT REFERENCES transactions(id),
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
  balance_after_cents INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user ON agent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_assets_listing ON assets(listing_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_listing ON transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_usage_log_agent ON agent_usage_log(agent_profile_id);
CREATE INDEX IF NOT EXISTS idx_seller_ledger_seller ON seller_ledger(seller_id);

-- Full-text search for listings (standalone, manually synced)
CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
  listing_id UNINDEXED,
  title,
  description,
  category,
  tags,
  capabilities
);
