// activeWorkspace.ts — the persisted "which workspace am I acting in" value.
//
// Deliberately a standalone, dependency-free module. Both `utils/axios.tsx`
// (which attaches the X-Workspace-Id header) and `store/useWorkspaceStore.ts`
// (which owns the UI state) need this value; since the store imports axios,
// putting the reader in either of them would create an import cycle.
//
// ⚠️ This is a UI preference, NOT an authorization token. The backend
// re-verifies workspace membership and capability on every request and rejects
// ids the caller has no claim to.
//
// The stored payload is SCOPED TO A USER ID. A shared browser can hold a value
// written by a previously signed-in account; keying it by user means the next
// account ignores it outright rather than briefly sending someone else's
// workspace id (which the backend would reject, producing a confusing error).

export const ACTIVE_WORKSPACE_KEY = "kolekto-active-workspace-id";

interface StoredActiveWorkspace {
  userId: string;
  workspaceId: string;
}

function readRaw(): StoredActiveWorkspace | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.workspaceId === "string" && typeof parsed.userId === "string") {
      return parsed as StoredActiveWorkspace;
    }
    return null;
  } catch {
    // Unparseable (or a pre-scoping plain-string value written by an older
    // build) — treat as absent rather than trusting it.
    return null;
  }
}

/**
 * Read the active workspace id without knowing who is signed in.
 * Used by the axios interceptor, which has no user context.
 *
 * Safe because the value is only ever a REQUEST: the backend asserts membership
 * and rejects (never silently downgrades) an id the caller has no claim to.
 */
export function getActiveWorkspaceId(): string | null {
  return readRaw()?.workspaceId ?? null;
}

/**
 * Read the active workspace id only if it belongs to `userId`.
 * Used by the store so one account never inherits another's selection.
 */
export function getActiveWorkspaceIdForUser(userId: string | undefined | null): string | null {
  if (!userId) return null;
  const stored = readRaw();
  return stored && stored.userId === userId ? stored.workspaceId : null;
}

/** Persist (or clear) the active workspace id for a user. Never throws. */
export function setActiveWorkspaceId(
  workspaceId: string | null,
  userId?: string | null
): void {
  try {
    if (workspaceId && userId) {
      localStorage.setItem(
        ACTIVE_WORKSPACE_KEY,
        JSON.stringify({ userId, workspaceId } satisfies StoredActiveWorkspace)
      );
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  } catch {
    /* no-op */
  }
}

/** Explicit clear, for sign-out. */
export function clearActiveWorkspace(): void {
  setActiveWorkspaceId(null);
}
