// supabase/functions/_shared/featureAccess.ts
//
// The Deno-side mirror of kolekto-be-old/services/featureAccessService.js.
//
// ⚠️ WHY THIS FILE EXISTS AT ALL
// Edge functions run on Deno and cannot import the Node/Express service, so
// the rules physically cannot be shared as one module across both runtimes.
// What CAN be shared is one copy per runtime: before this file existed, each
// edge function carried its own hand-inlined `if (count < 1)` check, so
// "the rule" lived in as many places as there were functions. Now every edge
// function imports from here, and there are exactly TWO implementations in
// the whole system — this one and the Node one — instead of N.
//
// ⚠️ SYNC CONTRACT
// If you change a rule here you MUST make the identical change in
// kolekto-be-old/services/featureAccessService.js, and vice versa. The
// backend test suite (tests/featureAccessService.test.js) contains a
// truth-table test whose rows are duplicated in the comment block at the
// bottom of this file — keep them in step so a drift is visible in review.
//
// Which implementation actually serves a create request is decided per-request
// by kolekto-fe-old/src/lib/featureFlags.ts (getCreateCollectionPath), which
// defaults to the Express path. This one remains reachable directly, so it is
// a real enforcement surface, not dead code.

export const KYC_REQUIRED_CODE = "KYC_REQUIRED";
export const KYC_REQUIRED_MESSAGE =
  "Complete identity verification before using this feature.";

export interface AccessContext {
  status: string | null;
  collectionCount: number;
}

/** KYC gate: unverified users may own at most one non-deleted collection. */
export function canCreateCollection({ status, collectionCount }: AccessContext): boolean {
  return status === "verified" || (collectionCount || 0) < 1;
}

/** KYC gate: only verified users may move money out of the platform. */
export function canWithdraw({ status }: { status: string | null }): boolean {
  return status === "verified";
}

const PAYABLE_STATUSES = new Set(["active", "approved", "live", "open"]);
const NEVER_LIVE_STATUSES = new Set([
  "pending_review",
  "pending_verification",
  "pending",
  "under_review",
  "rejected",
]);

/**
 * KYC gate: publishing (moving a collection into a publicly payable state).
 * Pausing / closing / resuming an already-live collection stays allowed so a
 * legacy organizer keeps full control of what they already have; what is
 * blocked is any transition that grows their live footprint — self-approving
 * a never-live campaign, or restoring a soft-deleted one.
 */
export function canPublishCollection({
  status,
  collectionCount,
  currentStatus,
  targetStatus,
}: AccessContext & {
  currentStatus: string | null;
  targetStatus: string | null;
}): boolean {
  if (status === "verified") return true;

  const current = String(currentStatus || "").toLowerCase();
  const target = String(targetStatus || "").toLowerCase();

  if (current === "deleted") return canCreateCollection({ status, collectionCount });
  if (!PAYABLE_STATUSES.has(target)) return true;
  if (NEVER_LIVE_STATUSES.has(current)) return false;
  return true;
}

/**
 * Load the two signals every gate needs. Mirrors
 * featureAccessService.loadContext() — same tables, same filters, same
 * "deleted rows don't count" semantics.
 */
// deno-lint-ignore no-explicit-any
export async function loadAccessContext(
  supabase: any,
  userId: string
): Promise<AccessContext> {
  const { data: kyc } = await supabase
    .from("kyc_verifications")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  const status = kyc?.status ?? null;

  // An already-verified user is unconditionally allowed, so the count query
  // can be skipped entirely — same short-circuit the Node service uses.
  if (status === "verified") return { status, collectionCount: 0 };

  const { count } = await supabase
    .from("collections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "deleted");

  return { status, collectionCount: count ?? 0 };
}

/**
 * The canonical rejection body. Identical shape to what the Express
 * errorHandler emits, so the frontend's single KYC_REQUIRED interceptor
 * handles both write paths without knowing which one answered.
 */
export function kycRequiredBody(feature?: string) {
  return {
    code: KYC_REQUIRED_CODE,
    message: KYC_REQUIRED_MESSAGE,
    // Backwards compatibility: every existing caller reads `error`.
    error: KYC_REQUIRED_MESSAGE,
    ...(feature ? { feature } : {}),
  };
}

/**
 * Classify into the migration's Group A/B/C.
 *
 * ⚠️ Requires `hasPayoutAccount` to distinguish B from C. The edge gates do
 * NOT load payout data (it would be an extra query per request and no gate
 * needs it), so callers here must either supply it or not call this at all —
 * passing a partial context silently under-reports legacy users as Group C.
 * GET /settings/kyc/access-status and scripts/kycLegacyUserAudit.js are the
 * authorities on grouping.
 */
export function classifyUser({
  status,
  collectionCount,
  hasPayoutAccount,
}: AccessContext & { hasPayoutAccount?: boolean }): "A" | "B" | "C" {
  if (status === "verified") return "A";
  const hasExcessAssets = (collectionCount || 0) > 1 || Boolean(hasPayoutAccount);
  return hasExcessAssets ? "B" : "C";
}

// ── canCreateCollection truth table (mirrors tests/featureAccessService.test.js)
//   unverified, 0 collections  -> YES   (new user's one allowed collection)
//   unverified, 1 collection   -> NO    (at cap)
//   unverified, 2 collections  -> NO    (legacy, frozen)
//   unverified, 10 collections -> NO    (legacy, frozen)
//   verified,   5 collections  -> YES   (verification erases every restriction)
//   verified,   1 collection   -> YES
