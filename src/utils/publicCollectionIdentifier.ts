/**
 * Canonicalize the public collection identifier taken from `/contribute/:id`.
 *
 * Root cause it fixes (incident 2026-08-18): organizers share the contribution
 * URL inside prose, typically wrapped in brackets —
 *
 *     Pay here (https://kolekto.com.ng/contribute/farstech-siwes-malete-86b80455)
 *
 * The autolinkers in WhatsApp / Facebook / Telegram / SMS clients disagree about
 * where such a URL ends. Some stop at the closing bracket; others swallow it
 * into the href. A recipient in the second group opened
 * `/contribute/farstech-siwes-malete-86b80455)`, this page forwarded
 * `farstech-siwes-malete-86b80455)` to GET /collection verbatim, the exact slug
 * match found nothing, and they saw "Collection Not Found" — while every
 * contributor whose client trimmed the bracket paid normally on the same link.
 *
 * Why trimming is exact, not a guess: slugs are minted by the BEFORE INSERT
 * trigger `collections_slug_trigger` as
 *
 *     lower(regexp_replace(title,'[^a-zA-Z0-9]+','-','g')) || '-' || left(id, 8)
 *
 * so a slug is drawn from [a-z0-9-] and nothing else (verified: all 264
 * production rows match ^[a-z0-9-]+$). A character outside that alphabet cannot
 * belong to any slug, so removing one from the boundary can never turn one
 * collection's identifier into another's. The interior is never touched, and
 * the lookup that follows is still an exact match — an identifier that genuinely
 * does not exist still yields a real "not found".
 *
 * The backend applies the identical rule in
 * `kolekto-be-old/utils/publicCollectionIdentifier.js`, which is authoritative;
 * this copy exists so the client also picks the right branch (UUID vs slug) and
 * can canonicalize the address bar. Keep the two in sync.
 */
export function normalizePublicCollectionIdentifier(raw: unknown): string {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";

  // A link that survived an extra encoding hop arrives as "…-86b80455%29"
  // rather than "…-86b80455)". Decode once so the trailing junk is visible as a
  // character to the boundary trim below; without this the "%29" tail ends in a
  // digit and would be kept. Slugs and UUIDs never contain '%', so this can
  // only help. A malformed escape throws — keep the original string then.
  if (s.includes("%")) {
    try {
      s = decodeURIComponent(s).trim();
    } catch {
      /* leave `s` as-is */
    }
  }

  // Some clients append the rest of the sentence, a tracking query or a
  // fragment. The identifier is only ever the first path segment.
  s = s.split(/[/?#]/)[0];

  // Slugs are lower-case by construction and Postgres compares `uuid` values
  // case-insensitively, so folding case is safe for both identifier kinds and
  // rescues links a mobile keyboard auto-capitalized.
  s = s.toLowerCase();

  // Trim link punctuation from BOTH ends only. The class is the exact
  // complement of the slug alphabet, so only characters that CANNOT occur in a
  // slug are removed. '-' is preserved even at the boundary: the trigger
  // collapses runs of non-alphanumerics without trimming the ends, so a title
  // starting or ending in punctuation yields a boundary hyphen (e.g.
  // "FARSTECH SIWES MALETE (Balance)" → "farstech-siwes-malete-balance--53a33ffd").
  s = s.replace(/^[^a-z0-9-]+/, "").replace(/[^a-z0-9-]+$/, "");

  return s;
}

export default normalizePublicCollectionIdentifier;
