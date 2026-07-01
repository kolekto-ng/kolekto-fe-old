// Backend payloads carry an absolute URL (built with FRONTEND_URL). Convert
// to a router-relative path when it points at our own origin; otherwise fall
// back to a full-page navigation. Shared by the navbar bell and the
// Activities page so a notification click behaves identically everywhere.
export function resolveNotificationTarget(
  url: string | null,
): { path: string | null; external: string | null } {
  if (!url) return { path: null, external: null };
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.origin === window.location.origin) {
        return { path: `${parsed.pathname}${parsed.search}${parsed.hash}`, external: null };
      }
      return { path: null, external: url };
    } catch {
      return { path: null, external: null };
    }
  }
  return { path: url.startsWith("/") ? url : `/${url}`, external: null };
}
