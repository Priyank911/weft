import { v4 as uuidv4 } from 'uuid';
import db, { createUser, createSellerProfile, createListing, syncListingFTS } from './index.js';

const LISTING_TITLE = 'Live Code Review & Refactor Agent';

function seedLiveAgentListing() {
  const existing = db.prepare('SELECT id FROM listings WHERE title = ?').get(LISTING_TITLE);
  if (existing) {
    console.log(`[Seed] Listing "${LISTING_TITLE}" already exists (${existing.id}), skipping.`);
    return;
  }

  const userId = uuidv4();
  createUser.run(userId, 'live-agent-seller@weft.marketplace', 'seed_no_login', 'seller', null, null);

  const sellerId = uuidv4();
  createSellerProfile.run(sellerId, userId, 'Weft Live Agents', 'First-party live A2A agents operated by the Weft team.');

  const listingId = uuidv4();
  const tags = JSON.stringify(['code-review', 'refactor', 'security', 'live-agent']);
  const capabilities = JSON.stringify(['code-review', 'security-audit', 'refactoring-recommendations', 'style-analysis']);

  createListing.run(
    listingId,
    sellerId,
    LISTING_TITLE,
    'Rent a real LLM-backed code reviewer. Sends your code over A2A and gets back real bugs, security issues, style problems, and refactor recommendations — billed per minute.',
    'This live agent accepts a task message containing a code snippet and returns a structured review: summary, score, issues (with severity), and recommendations. If the input isn\'t valid code, it will ask a clarification question instead of failing.',
    'development-tools',
    'live',
    5,   // price_cents per minute ($0.05/min)
    'USD',
    'per_minute',
    null, // rate_limit
    'active',
    'http://localhost:9001',
    capabilities,
    tags,
    'Real-time code review: bugs, security issues, and refactor suggestions, powered by an LLM over A2A.'
  );

  syncListingFTS({
    id: listingId,
    title: LISTING_TITLE,
    description: 'Rent a real LLM-backed code reviewer over A2A.',
    category: 'development-tools',
    tags,
    capabilities
  });

  console.log(`[Seed] Created live listing "${LISTING_TITLE}" (${listingId}) -> http://localhost:9001`);
}

seedLiveAgentListing();
