import { supabase } from '@/integrations/supabase/client';

interface UploadFile {
  name: string;
  dataUrl: string; // base64 data URL
}

interface UploadResult {
  path: string;
  url: string;
  name: string;
}

function generateUploadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

/**
 * Convert base64 data URL to File blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const mimeType = parts[0].split(':')[1];
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mimeType });
}

/**
 * Upload verification documents to campaign-documents bucket
 * Expects data URLs (base64 encoded strings from FileReader)
 */
export async function uploadVerificationDocuments(
  files: UploadFile[],
  collectionId: string
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (const file of files) {
    try {
      const blob = dataUrlToBlob(file.dataUrl);
      const uniqueId = generateUploadId();
      const storagePath = `campaign-docs/${collectionId}/${uniqueId}-${file.name}`;

      const { data, error } = await supabase.storage
        .from('campaign-documents')
        .upload(storagePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Fallback to base64 if upload fails
        results.push({
          path: storagePath,
          url: file.dataUrl,
          name: file.name,
        });
      } else {
        // Get public URL for the uploaded file
        const { data: publicData } = supabase.storage
          .from('campaign-documents')
          .getPublicUrl(storagePath);

        results.push({
          path: storagePath,
          url: publicData?.publicUrl || file.dataUrl,
          name: file.name,
        });
      }
    } catch (err) {
      console.error(`Error uploading ${file.name}:`, err);
      // Fallback to base64
      results.push({
        path: `campaign-docs/${collectionId}/${file.name}`,
        url: file.dataUrl,
        name: file.name,
      });
    }
  }

  return results;
}

/**
 * Upload a single banner image (ticket or campaign) to campaign_assets bucket.
 * Returns the public URL, or falls back to the original dataUrl on error.
 */
export async function uploadBannerImage(
  dataUrl: string,
  collectionId: string,
  prefix = 'banner'
): Promise<string> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const mimeType = blob.type;
    const ext = mimeType.split('/')[1] || 'jpg';
    const uniqueId = generateUploadId();
    const storagePath = `${collectionId}/${prefix}-${uniqueId}.${ext}`;

    const { error } = await supabase.storage
      .from('campaign_assets')
      .upload(storagePath, blob, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error(`Failed to upload banner:`, error);
      return dataUrl; // fallback to base64
    }

    const { data: publicData } = supabase.storage
      .from('campaign_assets')
      .getPublicUrl(storagePath);

    return publicData?.publicUrl || dataUrl;
  } catch (err) {
    console.error('Error uploading banner:', err);
    return dataUrl;
  }
}

/**
 * Upload story images to campaign-images bucket
 * Expects data URLs (base64 encoded strings from FileReader)
 */
export async function uploadStoryImages(
  images: UploadFile[],
  collectionId: string
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const image = images[i];
      const blob = dataUrlToBlob(image.dataUrl);
      const uniqueId = generateUploadId();
      const storagePath = `story-images/${collectionId}/${uniqueId}-${i}-${image.name}`;

      const { data, error } = await supabase.storage
        .from('campaign-images')
        .upload(storagePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error(`Failed to upload image ${image.name}:`, error);
        // Fallback to base64 if upload fails
        results.push({
          path: storagePath,
          url: image.dataUrl,
          name: image.name,
        });
      } else {
        // Get public URL for the uploaded image
        const { data: publicData } = supabase.storage
          .from('campaign-images')
          .getPublicUrl(storagePath);

        results.push({
          path: storagePath,
          url: publicData?.publicUrl || image.dataUrl,
          name: image.name,
        });
      }
    } catch (err) {
      console.error(`Error uploading image:`, err);
      // Fallback to base64
      results.push({
        path: `story-images/${collectionId}/${images[i].name}`,
        url: images[i].dataUrl,
        name: images[i].name,
      });
    }
  }

  return results;
}
