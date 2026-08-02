import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { getAssetsByListing } from '../db/index.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

let cloudinaryEnabled = false;
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
  cloudinaryEnabled = true;
} else {
  console.warn('[AssetProcessor] No valid Cloudinary credentials configured. Falling back to local disk storage.');
}

const SIGNED_URL_TTL_SECONDS = 5 * 60;

function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', type: 'authenticated', public_id: publicId },
      (error, result) => error ? reject(error) : resolve(result)
    );
    stream.end(buffer);
  });
}

// Local-disk paths are always absolute (path.join(process.cwd(), 'uploads', ...));
// Cloudinary public_ids are always relative ("weft/<listingId>/<file>") — this is
// enough to tell the two storage backends apart without a new DB column.
function isCloudinaryPublicId(storedPath) {
  return !path.isAbsolute(storedPath);
}

function getSignedDeliveryUrl(publicId) {
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  return cloudinary.utils.private_download_url(publicId, '', {
    resource_type: 'raw',
    type: 'authenticated',
    attachment: true,
    expires_at: expiresAt
  });
}

export async function processUpload(file, listingId) {
  try {
    const isZip = file.originalname.toLowerCase().endsWith('.zip');
    let storedPath;
    let storage;

    if (cloudinaryEnabled) {
      const publicId = `weft/${listingId}/${uuidv4()}_${file.originalname}`;
      const result = await uploadToCloudinary(file.buffer, publicId);
      storedPath = result.public_id; // signed fresh at delivery time, never a stored permanent URL
      storage = 'cloudinary';
    } else {
      const listingDir = path.join(UPLOADS_DIR, listingId);
      if (!fs.existsSync(listingDir)) {
        fs.mkdirSync(listingDir, { recursive: true });
      }
      const storedFileName = `${uuidv4()}_${file.originalname}`;
      storedPath = path.join(listingDir, storedFileName);
      fs.writeFileSync(storedPath, file.buffer);
      storage = 'local';
    }

    let manifest = [];
    if (isZip) {
      const zip = new AdmZip(file.buffer);
      const zipEntries = zip.getEntries();
      const extractedFiles = zipEntries.map(entry => {
        return {
          relativePath: entry.entryName,
          sizeBytes: entry.header.size,
          isDirectory: entry.isDirectory
        };
      }).filter(f => !f.isDirectory);

      manifest = await buildManifest(extractedFiles);
    } else {
      manifest = [{
        relativePath: file.originalname,
        role: 'main',
        sizeBytes: file.size,
        mimeType: file.mimetype
      }];
    }

    return {
      storedPath,
      manifest,
      isZip,
      sizeBytes: file.size,
      storage
    };
  } catch (error) {
    console.error('[AssetProcessor] Error in processUpload:', error);
    throw { error: { code: 'ASSET_UPLOAD_ERROR', message: error.message } };
  }
}

export async function buildManifest(extractedFiles) {
  try {
    // Fallback/basic manifest generation.
    // In practice, might use OpenAI for deeper role identification.
    return extractedFiles.map(file => {
      let role = 'asset';
      if (file.relativePath.toLowerCase().includes('readme')) role = 'documentation';
      else if (file.relativePath.toLowerCase().endsWith('.js') || file.relativePath.toLowerCase().endsWith('.py')) role = 'source';
      
      return {
        relativePath: file.relativePath,
        role,
        sizeBytes: file.sizeBytes,
        mimeType: 'application/octet-stream' // generic
      };
    });
  } catch (error) {
    console.error('[AssetProcessor] Error in buildManifest:', error);
    throw { error: { code: 'ASSET_MANIFEST_ERROR', message: error.message } };
  }
}

export async function prepareDelivery(listingId) {
  try {
    const assets = getAssetsByListing.all(listingId);
    const filesPayload = [];
    let completeManifest = [];

    for (const asset of assets) {
      if (asset.manifest_json) {
        completeManifest = completeManifest.concat(typeof asset.manifest_json === 'string' ? JSON.parse(asset.manifest_json) : asset.manifest_json);
      }

      if (cloudinaryEnabled && isCloudinaryPublicId(asset.stored_path)) {
        // Generated here, at the moment of delivery — after the caller's payment
        // gate has already passed — so it's never a permanent link computed once
        // at upload time. Short TTL instead of embedding buyer context: Cloudinary's
        // signed-URL API has no field for arbitrary audit metadata.
        filesPayload.push({
          path: asset.original_filename,
          download_url: getSignedDeliveryUrl(asset.stored_path),
          expires_in_seconds: SIGNED_URL_TTL_SECONDS
        });
      } else if (asset.size_bytes < 1024 * 1024) { // < 1MB inline
        const content = fs.readFileSync(asset.stored_path, { encoding: 'base64' });
        filesPayload.push({
          path: asset.original_filename,
          content_base64: content
        });
      } else {
        filesPayload.push({
          path: asset.original_filename,
          resource_url: `/api/v1/assets/download/${asset.id}` // example endpoint
        });
      }
    }

    return {
      manifest: completeManifest,
      files: filesPayload
    };
  } catch (error) {
    console.error('[AssetProcessor] Error in prepareDelivery:', error);
    throw { error: { code: 'ASSET_DELIVERY_ERROR', message: error.message } };
  }
}

export async function getDeliveryPayload(listingId) {
  try {
    return await prepareDelivery(listingId);
  } catch (error) {
    console.error('[AssetProcessor] Error in getDeliveryPayload:', error);
    throw { error: { code: 'ASSET_PAYLOAD_ERROR', message: error.message } };
  }
}
