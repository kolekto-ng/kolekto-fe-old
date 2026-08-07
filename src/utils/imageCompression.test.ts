import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the compression library so tests are deterministic and don't need a
// real canvas/worker pipeline — we're testing our own skip/guard logic, not
// the library's internals.
vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

import imageCompression from "browser-image-compression";
import { compressForKycUpload, compressFilesForKycUpload } from "./imageCompression";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const buffer = new Uint8Array(sizeBytes);
  return new File([buffer], name, { type });
}

describe("compressForKycUpload", () => {
  beforeEach(() => {
    vi.mocked(imageCompression).mockReset();
  });

  it("skips PDFs entirely, never calling the compressor", async () => {
    const file = makeFile("bank-statement.pdf", "application/pdf", 6 * 1024 * 1024);
    const result = await compressForKycUpload(file);

    expect(imageCompression).not.toHaveBeenCalled();
    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(file);
    expect(result.finalSize).toBe(result.originalSize);
  });

  it("skips images already under the target size", async () => {
    const file = makeFile("small-id.jpg", "image/jpeg", 500 * 1024); // 500KB
    const result = await compressForKycUpload(file);

    expect(imageCompression).not.toHaveBeenCalled();
    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(file);
  });

  it("compresses a large JPEG and shrinks it", async () => {
    const file = makeFile("camera-photo.jpg", "image/jpeg", 6 * 1024 * 1024); // 6MB
    const compressedBlob = new Blob([new Uint8Array(1.2 * 1024 * 1024)], { type: "image/jpeg" });
    vi.mocked(imageCompression).mockResolvedValue(compressedBlob as any);

    const result = await compressForKycUpload(file);

    expect(imageCompression).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ maxSizeMB: 1.5, maxWidthOrHeight: 2000, useWebWorker: true })
    );
    expect(result.wasCompressed).toBe(true);
    expect(result.finalSize).toBeLessThan(result.originalSize);
    expect(result.file.name).toBe("camera-photo.jpg"); // filename preserved
    expect(result.file.type).toBe("image/jpeg");
  });

  it("falls back to the original file if 'compression' would be larger", async () => {
    const file = makeFile("weird.png", "image/png", 2 * 1024 * 1024); // 2MB
    // Simulate a pathological case where the "compressed" output is bigger.
    const biggerBlob = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/png" });
    vi.mocked(imageCompression).mockResolvedValue(biggerBlob as any);

    const result = await compressForKycUpload(file);

    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(file);
    expect(result.finalSize).toBe(file.size);
  });

  it("falls back to the original file if the compressor throws", async () => {
    const file = makeFile("corrupt.jpg", "image/jpeg", 4 * 1024 * 1024);
    vi.mocked(imageCompression).mockRejectedValue(new Error("decode failed"));

    const result = await compressForKycUpload(file);

    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(file);
  });

  it("never compresses non-image, non-PDF file types", async () => {
    const file = makeFile("weird.heic", "image/heic", 4 * 1024 * 1024);
    const result = await compressForKycUpload(file);

    expect(imageCompression).not.toHaveBeenCalled();
    expect(result.wasCompressed).toBe(false);
  });
});

describe("compressFilesForKycUpload", () => {
  beforeEach(() => {
    vi.mocked(imageCompression).mockReset();
  });

  it("processes a mixed batch (PDF + large JPEG + small PNG) and reports aggregate stats", async () => {
    const pdf = makeFile("address.pdf", "application/pdf", 3 * 1024 * 1024);
    const bigJpg = makeFile("selfie.jpg", "image/jpeg", 5 * 1024 * 1024);
    const smallPng = makeFile("id-back.png", "image/png", 300 * 1024);

    vi.mocked(imageCompression).mockImplementation(async (file: File) => {
      return new Blob([new Uint8Array(1 * 1024 * 1024)], { type: file.type }) as any;
    });

    const result = await compressFilesForKycUpload([pdf, bigJpg, smallPng]);

    expect(result.files).toHaveLength(3);
    expect(result.originalTotalSize).toBe(pdf.size + bigJpg.size + smallPng.size);
    // Only the large JPEG should have actually shrunk.
    expect(result.compressedTotalSize).toBeLessThan(result.originalTotalSize);
    expect(imageCompression).toHaveBeenCalledTimes(1); // only the big jpeg qualified
  });
});
