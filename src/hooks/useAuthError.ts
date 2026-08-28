import { useCallback, useState } from "react";
import {
  classifyAuthError,
  logAuthFailure,
  validationError,
  type AuthOperation,
  type ClassifiedAuthError,
} from "@/utils/authErrors";

/**
 * useAuthError — the state half of the auth error system.
 *
 * Pairs with <AuthErrorBanner/>. It owns the classified error AND the
 * `scrollKey` that tells the banner when a genuinely NEW error has arrived.
 *
 * The counter is why raising the same error twice still scrolls: a user who
 * submits a wrong password, scrolls back down, and submits the same wrong
 * password again must be shown the message again. Comparing error *values*
 * would treat the second failure as "no change" and leave them staring at an
 * idle button — the exact bug this whole system exists to remove.
 */
export function useAuthError(operation: AuthOperation) {
  const [error, setError] = useState<ClassifiedAuthError | null>(null);
  const [scrollKey, setScrollKey] = useState(0);

  /** Report a caught/returned failure. Classifies, logs, and triggers scroll. */
  const raise = useCallback(
    (err: unknown, extra?: Record<string, unknown>): ClassifiedAuthError => {
      const classified = classifyAuthError(err, operation);
      logAuthFailure(operation, classified, extra);
      setError(classified);
      setScrollKey((n) => n + 1);
      return classified;
    },
    [operation]
  );

  /** Report a local, pre-submit validation failure. Not logged — not a fault. */
  const raiseValidation = useCallback((message: string, title?: string) => {
    setError(validationError(message, title));
    setScrollKey((n) => n + 1);
  }, []);

  /** Show an already-classified state (e.g. a non-error notice). */
  const raiseClassified = useCallback((classified: ClassifiedAuthError) => {
    setError(classified);
    setScrollKey((n) => n + 1);
  }, []);

  /**
   * Clear the banner. Called at the START of every submit so a stale error is
   * never left on screen next to a fresh in-flight request.
   */
  const clear = useCallback(() => setError(null), []);

  return { error, scrollKey, raise, raiseValidation, raiseClassified, clear };
}
