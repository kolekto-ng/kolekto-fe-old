export const AUTH_STORAGE_KEY = "kolekto-auth-token";
export const SUPABASE_STORAGE_KEY = "kolekto-supabase-session";
export const SESSION_TTL_SECONDS = 60 * 60;

type StoredSession = Record<string, any> & {
  access_token?: string;
  expires_at?: number | string;
  kolekto_expires_at?: number | string;
  kolekto_started_at?: number | string;
};

function nowSeconds(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000);
}

export function clearAuthSessionStorage() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(SUPABASE_STORAGE_KEY);
}

export function withOneHourExpiry<T extends StoredSession | null | undefined>(
  session: T,
  nowMs = Date.now(),
): T {
  if (!session) return session;

  const startedAt = nowSeconds(nowMs);
  const appExpiry = startedAt + SESSION_TTL_SECONDS;
  const backendExpiry = Number(session.expires_at || 0);
  const expiresAt = backendExpiry > 0 ? Math.min(backendExpiry, appExpiry) : appExpiry;

  return {
    ...session,
    kolekto_started_at: startedAt,
    kolekto_expires_at: expiresAt,
  };
}

export function getSessionExpiryMs(session: StoredSession | null | undefined): number {
  if (!session) return 0;
  const appExpiry = Number(session.kolekto_expires_at || 0);
  const backendExpiry = Number(session.expires_at || 0);
  const expirySeconds = appExpiry || backendExpiry;
  return expirySeconds > 0 ? expirySeconds * 1000 : 0;
}

export function isAuthSessionExpired(
  session: StoredSession | null | undefined,
  nowMs = Date.now(),
) {
  const expiryMs = getSessionExpiryMs(session);
  return !session?.access_token || !expiryMs || nowMs >= expiryMs;
}

export function getValidAuthSessionFromStorage(): StoredSession | null {
  const sessionStr = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!sessionStr) return null;

  try {
    const parsed = JSON.parse(sessionStr) as StoredSession;
    if (!parsed?.access_token) {
      clearAuthSessionStorage();
      return null;
    }

    const normalized = parsed.kolekto_expires_at ? parsed : withOneHourExpiry(parsed);
    if (normalized !== parsed) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
    }

    if (isAuthSessionExpired(normalized)) {
      clearAuthSessionStorage();
      return null;
    }

    return normalized;
  } catch (error) {
    console.error("Error parsing session from storage:", error);
    clearAuthSessionStorage();
    return null;
  }
}
