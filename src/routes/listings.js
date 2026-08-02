import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { createListing, getListingById, updateListing, publishListing as publishListingStmt, archiveListing as archiveListingStmt, searchListingsFTS, searchListingsByFilter, createAsset, getAssetsByListing, syncListingFTS } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { processUpload } from '../services/asset-processor.js';
import { generateListingMetadata } from '../services/openai.js';
import { publishAgentFacts } from '../services/nanda.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create a new listing (draft)
router.post('/', authenticate, requireRole('seller', 'both'), async (req, res, next) => {
  try {
    const { title, description, long_description, category, listing_type, price_cents, currency, rate_type, rate_limit, a2a_endpoint_url, capabilities, tags, sample_description } = req.body;
    const id = uuidv4();
    const sellerId = req.body.seller_id || req.user.id;
    
    createListing.run(
      id, sellerId,
      title || '', description || '', long_description || '', category || '',
      listing_type || 'static', price_cents || 0, currency || 'USD',
      rate_type || 'one_time', rate_limit || null, 'draft',
      a2a_endpoint_url || null,
      JSON.stringify(capabilities || []), JSON.stringify(tags || []),
      sample_description || '',
      0
    );
    
    const listing = getListingById.get(id);
    res.status(201).json({ data: listing });
  } catch (err) {
    next(err);
  }
});

// Upload asset file
router.post('/:id/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const listing = getListingById.get(req.params.id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    
    if (!req.file) throw new AppError('VALIDATION_ERROR', 400, 'No file uploaded');
    
    const processed = await processUpload(req.file, req.params.id);
    const assetId = uuidv4();
    
    createAsset.run(
      assetId, req.params.id,
      req.file.originalname, processed.storedPath,
      req.file.mimetype, req.file.size,
      processed.manifest ? JSON.stringify(processed.manifest) : null,
      processed.isZip ? 1 : 0
    );
    
    const asset = { id: assetId, listing_id: req.params.id, original_filename: req.file.originalname, ...processed };
    res.status(201).json({ data: asset });
  } catch (err) {
    next(err);
  }
});

// AI-generate listing metadata
router.post('/:id/generate-metadata', authenticate, async (req, res, next) => {
  try {
    const listing = getListingById.get(req.params.id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    
    const assets = getAssetsByListing.all(req.params.id);
    const fileMetadata = assets.map(a => ({ filename: a.original_filename, mimeType: a.mime_type, sizeBytes: a.size_bytes }));
    
    const metadata = await generateListingMetadata(listing.description || '', fileMetadata);
    res.json({ data: metadata });
  } catch (err) {
    next(err);
  }
});

// Update listing
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const listing = getListingById.get(req.params.id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    
    const { title, description, long_description, category, price_cents, currency, rate_type, rate_limit, capabilities, tags, sample_description, a2a_endpoint_url } = req.body;
    
    updateListing.run(
      title || listing.title,
      description || listing.description,
      long_description || listing.long_description,
      category || listing.category,
      price_cents !== undefined ? price_cents : listing.price_cents,
      currency || listing.currency,
      rate_type || listing.rate_type,
      rate_limit || listing.rate_limit,
      capabilities ? JSON.stringify(capabilities) : listing.capabilities,
      tags ? JSON.stringify(tags) : listing.tags,
      sample_description || listing.sample_description,
      a2a_endpoint_url || listing.a2a_endpoint_url,
      req.params.id
    );
    
    const updated = getListingById.get(req.params.id);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// Publish listing
router.post('/:id/publish', authenticate, async (req, res, next) => {
  try {
    const listing = getListingById.get(req.params.id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    
    // Publish to NANDA Index
    let nandaAgentId = null;
    try {
      const nandaResult = await publishAgentFacts(listing);
      nandaAgentId = nandaResult?.agentId || `local_${listing.id}`;
    } catch (e) {
      console.warn('[Listings] NANDA publish failed, using local ID:', e.message);
      nandaAgentId = `local_${listing.id}`;
    }
    
    publishListingStmt.run(nandaAgentId, req.params.id);
    syncListingFTS(listing);
    
    const published = getListingById.get(req.params.id);
    res.json({ data: published });
  } catch (err) {
    next(err);
  }
});

// Browse/search listings (public)
router.get('/', async (req, res, next) => {
  try {
    const { q, category, listing_type, max_price, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let results;
    if (q) {
      try {
        results = searchListingsFTS.all(q, parseInt(limit), offset);
      } catch (e) {
        // FTS fallback: simple LIKE search
        results = searchListingsByFilter.all(
          category || null, category || null,
          listing_type || null, listing_type || null,
          max_price ? parseInt(max_price) : null, max_price ? parseInt(max_price) : null,
          parseInt(limit), offset
        );
      }
    } else {
      results = searchListingsByFilter.all(
        category || null, category || null,
        listing_type || null, listing_type || null,
        max_price ? parseInt(max_price) : null, max_price ? parseInt(max_price) : null,
        parseInt(limit), offset
      );
    }
    
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
});

// Get listing detail (metadata only)
router.get('/:id', async (req, res, next) => {
  try {
    const listing = getListingById.get(req.params.id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    // Return metadata only — no download URLs
    res.json({ data: listing });
  } catch (err) {
    next(err);
  }
});

// Archive listing
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const listing = getListingById.get(req.params.id);
    if (!listing) throw new AppError('NOT_FOUND', 404, 'Listing not found');
    archiveListingStmt.run(req.params.id);
    res.json({ data: { success: true, message: 'Listing archived' } });
  } catch (err) {
    next(err);
  }
});

export default router;
