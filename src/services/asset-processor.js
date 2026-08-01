import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function processUpload(file, listingId) {
  try {
    const listingDir = path.join(UPLOADS_DIR, listingId);
    if (!fs.existsSync(listingDir)) {
      fs.mkdirSync(listingDir, { recursive: true });
    }

    const isZip = file.originalname.toLowerCase().endsWith('.zip');
    const storedFileName = `${uuidv4()}_${file.originalname}`;
    const storedPath = path.join(listingDir, storedFileName);
    
    // Save file
    fs.writeFileSync(storedPath, file.buffer);
    
    let manifest = [];
    if (isZip) {
      const zip = new AdmZip(storedPath);
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
      sizeBytes: file.size
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

export async function prepareDelivery(listingId, assets) {
  try {
    const filesPayload = [];
    let completeManifest = [];

    for (const asset of assets) {
      if (asset.manifest_json) {
        completeManifest = completeManifest.concat(typeof asset.manifest_json === 'string' ? JSON.parse(asset.manifest_json) : asset.manifest_json);
      }

      if (asset.size_bytes < 1024 * 1024) { // < 1MB inline
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

export async function getDeliveryPayload(listingId, assets) {
  try {
    return await prepareDelivery(listingId, assets);
  } catch (error) {
    console.error('[AssetProcessor] Error in getDeliveryPayload:', error);
    throw { error: { code: 'ASSET_PAYLOAD_ERROR', message: error.message } };
  }
}
