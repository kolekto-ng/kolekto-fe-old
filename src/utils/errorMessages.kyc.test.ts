import { describe, it, expect, afterEach, vi } from "vitest";
import { toKycUploadErrorMessage } from "./errorMessages";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

describe("toKycUploadErrorMessage", () => {
  afterEach(() => {
    setOnline(true);
  });

  it("recognizes an axios client-side timeout distinctly from a dead connection", () => {
    const error = { code: "ECONNABORTED", message: "timeout of 150000ms exceeded" };
    expect(toKycUploadErrorMessage(error)).toBe(
      "Upload is taking longer than expected. Please keep this page open while we finish uploading your documents."
    );
  });

  it("recognizes offline browser state", () => {
    setOnline(false);
    const error = { message: "Network Error" };
    expect(toKycUploadErrorMessage(error)).toBe(
      "Your internet connection appears to be unavailable."
    );
  });

  it("maps 413 to a file-too-large message", () => {
    const error = { response: { status: 413, data: { error: "Each file must be 5 MB or smaller." } } };
    expect(toKycUploadErrorMessage(error)).toBe("One of your files is too large.");
  });

  it("maps 415 to an unsupported-file message", () => {
    const error = { response: { status: 415, data: { error: "Unsupported file type." } } };
    expect(toKycUploadErrorMessage(error)).toBe("One of your files is not supported.");
  });

  it("maps 500 to the generic upload-failure message", () => {
    const error = { response: { status: 500, data: { error: "We couldn't upload your documents." } } };
    expect(toKycUploadErrorMessage(error)).toBe("We couldn't upload your documents. Please try again.");
  });

  it("falls back to toFriendlyErrorMessage for anything else (e.g. session expiry)", () => {
    const error = { response: { status: 401, data: { error: "Invalid or expired token" } } };
    expect(toKycUploadErrorMessage(error)).toBe("Your session expired. Please sign in again.");
  });

  it("does not misclassify a real timeout as offline even if navigator.onLine is stale/true", () => {
    setOnline(true);
    const error = { code: "ECONNABORTED", message: "timeout of 150000ms exceeded" };
    expect(toKycUploadErrorMessage(error)).toContain("taking longer than expected");
  });
});
