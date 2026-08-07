// KYC upload hardening — client-side image compression.
//
// Root cause of the production "Upload failed. Unable to connect." reports:
// KYC uploads send raw, full-resolution camera photos (often several MB each)
// over a single multipart request, and on slow mobile uplinks that alone can
// take longer than the request has to complete. Shrinking the bytes we send
// is the primary fix; see also the dedicated upload timeout in axios.tsx.
//
// browser-image-compression handles EXIF-orientation-correct rotation and
// downscaling in a web worker, so large camera photos don't block the UI
// thread while compressing.
import imageCompression from "browser-image-compression";

const COMPRESSIBLE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Compression targets ~1-1.5MB per image, which stays comfortably legible
// for identity documents while cutting typical 3-8MB camera photos by 70-90%.
const TARGET_MAX_SIZE_MB = 1.5;
const SKIP_IF_UNDER_BYTES = TARGET_MAX_SIZE_MB * 1024 * 1024;
const MAX_WIDTH_OR_HEIGHT = 2000;

export interface CompressionResult {
  file: File;
  originalSize: number;
  finalSize: number;
  wasCompressed: boolean;
  durationMs: number;
}

/**
 * Compresses a single file for KYC upload if it's a compressible image type
 * and large enough to be worth compressing. PDFs and already-small files are
 * returned unchanged. Never returns a file larger than the original.
 */
export async function compressForKycUpload(file: File): Promise<CompressionResult> {
  const start = performance.now();

  if (!COMPRESSIBLE_MIME_TYPES.has(file.type) || file.size <= SKIP_IF_UNDER_BYTES) {
    return {
      file,
      originalSize: file.size,
      finalSize: file.size,
      wasCompressed: false,
      durationMs: performance.now() - start,
    };
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_MAX_SIZE_MB,
      maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      initialQuality: 0.85,
      fileType: file.type,
    });

    // Guard: never ship a "compressed" file that's actually bigger.
    if (compressed.size >= file.size) {
      return {
        file,
        originalSize: file.size,
        finalSize: file.size,
        wasCompressed: false,
        durationMs: performance.now() - start,
      };
    }

    // browser-image-compression returns a Blob; re-wrap as a File so
    // FormData sends the original filename.
    const compressedFile = new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: file.lastModified,
    });

    return {
      file: compressedFile,
      originalSize: file.size,
      finalSize: compressedFile.size,
      wasCompressed: true,
      durationMs: performance.now() - start,
    };
  } catch (err) {
    // Compression is a best-effort optimization — never block a submission
    // because the compressor choked on an unusual image.
    console.warn("[kyc] image compression failed, using original file", err);
    return {
      file,
      originalSize: file.size,
      finalSize: file.size,
      wasCompressed: false,
      durationMs: performance.now() - start,
    };
  }
}

/**
 * Compresses a batch of files (skipping PDFs/non-images/already-small files
 * automatically) and returns the resulting files plus aggregate stats for
 * diagnostics.
 */
export async function compressFilesForKycUpload(files: File[]): Promise<{
  files: File[];
  originalTotalSize: number;
  compressedTotalSize: number;
  durationMs: number;
}> {
  const start = performance.now();
  const results = await Promise.all(files.map(compressForKycUpload));
  return {
    files: results.map((r) => r.file),
    originalTotalSize: results.reduce((sum, r) => sum + r.originalSize, 0),
    compressedTotalSize: results.reduce((sum, r) => sum + r.finalSize, 0),
    durationMs: performance.now() - start,
  };
}
