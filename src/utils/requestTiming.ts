// requestTiming.ts — development-only API request tracing (performance wave,
// 2026-08-20, brief §29).
//
// WHY: this wave's two largest findings — GET /collections returning 4.81 MB
// because an array was spread into the response object, and a duplicate round
// of every dashboard request on first login — were both invisible from inside
// the app. Finding them needed an out-of-band benchmark script. This module
// makes the same facts visible from the browser console, so the next
// regression is noticed in normal development rather than in production.
//
// It records, per request: method, path, duration, HTTP status, response size,
// and the workspace the call was issued under. That last field is the point —
// "how many requests fired, under which workspace, when I switched" is exactly
// the question this wave kept having to answer.
//
// ⚠️ DEVELOPMENT ONLY. `isEnabled()` is false in production builds, so the
// interceptors that call into this module return immediately and nothing is
// retained. Even in development it records only the fields listed above:
//
//   • NO request bodies and NO response bodies — those carry contribution
//     amounts, bank details and payout accounts.
//   • NO headers — that is where Authorization and the session token live.
//   • Query strings are STRIPPED from the recorded path (`?token=…`,
//     `?email=…`), leaving the route only.
//
// The buffer is capped and in-memory only; nothing is persisted or sent
// anywhere.

export interface RequestTiming {
  method: string;
  /** Path only — query string removed, see the header. */
  path: string;
  startedAt: number;
  durationMs: number;
  status: number | "error";
  /** Response size in bytes where the browser reported a content-length. */
  bytes: number | null;
  /** The X-Workspace-Id the request was issued under, if any. */
  workspaceId: string | null;
}

const MAX_ENTRIES = 200;
const entries: RequestTiming[] = [];

export function isEnabled(): boolean {
  return import.meta.env.MODE !== "production";
}

/** Strip the query string; it can carry tokens and email addresses. */
function safePath(url: string | undefined): string {
  if (!url) return "(unknown)";
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

export function record(timing: RequestTiming): void {
  if (!isEnabled()) return;
  entries.push(timing);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function getTimings(): RequestTiming[] {
  return [...entries];
}

export function clearTimings(): void {
  entries.length = 0;
}

/**
 * Print a readable table, newest last, with a per-endpoint summary.
 *
 * Typical use: switch workspace, then run `kolektoRequestTimings()` and read
 * off what fired, in what order, how long each took, and under which
 * workspace — the "request dependency map" question directly.
 */
export function printTimings(): RequestTiming[] {
  const rows = getTimings();
  if (rows.length === 0) {
    console.info("[kolekto] no API requests recorded yet");
    return rows;
  }

  const first = rows[0].startedAt;
  /* eslint-disable no-console */
  console.groupCollapsed(`[kolekto] ${rows.length} API requests`);
  console.table(
    rows.map((row) => ({
      "t+ms": Math.round(row.startedAt - first),
      request: `${row.method} ${row.path}`,
      ms: Math.round(row.durationMs),
      status: row.status,
      KB: row.bytes === null ? "?" : (row.bytes / 1024).toFixed(1),
      workspace: row.workspaceId ? row.workspaceId.slice(0, 8) : "—",
    })),
  );

  // A count > 1 for the same endpoint inside one interaction is the duplicate-
  // request smell this wave was chasing; surfacing it is the whole point.
  const byEndpoint = new Map<string, { calls: number; totalMs: number }>();
  for (const row of rows) {
    const key = `${row.method} ${row.path}`;
    const agg = byEndpoint.get(key) ?? { calls: 0, totalMs: 0 };
    agg.calls += 1;
    agg.totalMs += row.durationMs;
    byEndpoint.set(key, agg);
  }
  console.table(
    [...byEndpoint.entries()]
      .sort((a, b) => b[1].totalMs - a[1].totalMs)
      .map(([request, agg]) => ({
        request,
        calls: agg.calls,
        "total ms": Math.round(agg.totalMs),
        "avg ms": Math.round(agg.totalMs / agg.calls),
      })),
  );
  console.groupEnd();
  /* eslint-enable no-console */
  return rows;
}

// Exposed on `window` in development so it is reachable from the console with
// no import, matching the existing `window.kolektoPushDiagnostics()` idiom.
if (isEnabled() && typeof window !== "undefined") {
  (window as any).kolektoRequestTimings = printTimings;
  (window as any).kolektoClearRequestTimings = clearTimings;
}

export { safePath };
