import db from './index.js';

try {
  console.log('[DB] Clearing all database tables for a fresh 100% empty state...');

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM transactions;');
  db.exec('DELETE FROM seller_ledger;');
  db.exec('DELETE FROM agent_usage_log;');
  db.exec('DELETE FROM assets;');
  db.exec('DELETE FROM listings_fts;');
  db.exec('DELETE FROM listings;');
  db.exec('DELETE FROM seller_profiles;');
  db.exec('DELETE FROM agent_profiles;');
  db.exec('DELETE FROM users;');
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('[DB] Successfully cleared all tables in weft.db! Database is now 100% empty.');
} catch (err) {
  console.error('[DB] Error clearing database:', err);
}
