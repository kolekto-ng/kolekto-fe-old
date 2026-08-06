import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Regression coverage for the KYC verification-state consolidation (2026-08-06).
//
// Covers, at the store level (the layer that actually owns the risk — see
// src/components/dashboard/DashboardLayout.tsx for the thin render-gate that
// consumes kycStatusResolved/kycStatusResolvedFor, and
// src/hooks/useKycAccess.ts for the isVerified consumer):
//
//   1. GET /settings/kyc/access-status is the single source for overallStatus
//      and isVerified — no parallel client-side `kyc_verifications` read.
//   2. Out-of-order responses (an older fetch resolving after a newer one)
//      never clobber the newer result — the race this whole task exists to
//      close.
//   3. A transient failure of /access-status fails OPEN on prior state
//      (doesn't regress a verified user to "not_started" on a network blip).
//   4. resetKycState (called from useAuthStore.signOut) clears state AND
//      invalidates any fetch still in flight for the outgoing session.
//   5. isVerified is actually populated from the backend flag — this was
//      silently dead (`kycData.isVerified` was never assigned, so
//      useKycAccess().isVerified was permanently false for every user)
//      before this fix; this test would have caught it.
// ─────────────────────────────────────────────────────────────────────────────

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/utils/axios", () => ({
  axiosInstance: { get: getMock, post: vi.fn() },
}));

// The store builds its own Supabase client (for the realtime subscription
// only — see ensureKycSubscription). Stub it to a no-op chain so importing
// the store doesn't require real env vars or touch the network.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/utils/errorMessages", () => ({
  toFriendlyErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

import { useProfileStore as useProfileStoreUntyped } from "./useProfileStore";

const useProfileStore = useProfileStoreUntyped as any;

// Resolves the /settings/kyc/:userId and /settings/kyc/access-status calls
// fetchKYCStatus issues via Promise.all, in whichever order axiosInstance.get
// is actually invoked, and lets the caller control resolution timing —
// needed to construct the out-of-order-response race in test #2.
function mockAxiosGet(responses: Record<string, any>, delays: Record<string, number> = {}) {
  getMock.mockImplementation((url: string) => {
    const key = url.includes("access-status") ? "access-status" : "documents";
    const value = responses[key];
    const delay = delays[key] ?? 0;
    if (value?.__reject) {
      return delay
        ? new Promise((_, reject) => setTimeout(() => reject(value.__reject), delay))
        : Promise.reject(value.__reject);
    }
    return delay
      ? new Promise((resolve) => setTimeout(() => resolve(value), delay))
      : Promise.resolve(value);
  });
}

const DOCS_RESPONSE = { data: { documents: [] } };

beforeEach(() => {
  useProfileStore.setState({
    kycData: null,
    kycLoading: false,
    kycStatusResolved: false,
    kycStatusResolvedFor: null,
  });
  getMock.mockReset();
});

describe("useProfileStore — KYC verification state", () => {
  it("sources overallStatus and isVerified from GET /access-status alone", async () => {
    mockAxiosGet({
      documents: DOCS_RESPONSE,
      "access-status": {
        data: {
          kycStatus: "verified",
          isVerified: true,
          canCreateCollection: true,
          canManageBankAccount: true,
          canWithdraw: true,
          showBanner: false,
          journey: { phase: "verified" },
        },
      },
    });

    await useProfileStore.getState().fetchKYCStatus("user-1");

    const { kycData } = useProfileStore.getState();
    expect(kycData.overallStatus).toBe("verified");
    expect(kycData.isVerified).toBe(true);
  });

  it("marks kycStatusResolved(For) once the fetch settles — the DashboardLayout gate signal", async () => {
    mockAxiosGet({
      documents: DOCS_RESPONSE,
      "access-status": { data: { kycStatus: "pending", isVerified: false } },
    });

    expect(useProfileStore.getState().kycStatusResolved).toBe(false);

    await useProfileStore.getState().fetchKYCStatus("user-1");

    expect(useProfileStore.getState().kycStatusResolved).toBe(true);
    expect(useProfileStore.getState().kycStatusResolvedFor).toBe("user-1");
  });

  it("still resolves (fails open) when access-status itself errors, so the dashboard doesn't hang forever", async () => {
    mockAxiosGet({
      documents: DOCS_RESPONSE,
      "access-status": { __reject: new Error("network down") },
    });

    await useProfileStore.getState().fetchKYCStatus("user-1");

    const state = useProfileStore.getState();
    expect(state.kycStatusResolved).toBe(true);
    expect(state.kycLoading).toBe(false);
  });

  it("preserves the previous overallStatus instead of regressing to not_started on a transient access-status failure", async () => {
    useProfileStore.setState({
      kycData: { overallStatus: "verified", isVerified: true },
    });

    mockAxiosGet({
      documents: DOCS_RESPONSE,
      "access-status": { __reject: new Error("network down") },
    });

    await useProfileStore.getState().fetchKYCStatus("user-1");

    // The catch branch doesn't touch kycData at all — the last known-good
    // value must still be there, not wiped or reset.
    expect(useProfileStore.getState().kycData.overallStatus).toBe("verified");
  });

  it("THE RACE: an older, slower-resolving fetch can never overwrite a newer one's result", async () => {
    // First call: e.g. a focus-triggered refetch — starts, then stalls.
    mockAxiosGet(
      {
        documents: DOCS_RESPONSE,
        "access-status": { data: { kycStatus: "pending", isVerified: false } },
      },
      { "access-status": 50, documents: 50 },
    );
    const staleCall = useProfileStore.getState().fetchKYCStatus("user-1");

    // Second call: e.g. the realtime subscription firing because an admin's
    // approval landed WHILE the first call was still in flight — resolves
    // fast, carries the true current state.
    mockAxiosGet({
      documents: DOCS_RESPONSE,
      "access-status": { data: { kycStatus: "verified", isVerified: true } },
    });
    const freshCall = useProfileStore.getState().fetchKYCStatus("user-1");

    await freshCall;
    // Sanity check mid-flight: the fresh (correct) result already committed.
    expect(useProfileStore.getState().kycData.overallStatus).toBe("verified");

    await staleCall; // the stale response arrives late...
    // ...and must NOT have clobbered the correct, already-committed state.
    expect(useProfileStore.getState().kycData.overallStatus).toBe("verified");
    expect(useProfileStore.getState().kycData.isVerified).toBe(true);
  });

  it("resetKycState clears state and invalidates any in-flight fetch for the outgoing session", async () => {
    mockAxiosGet(
      {
        documents: DOCS_RESPONSE,
        "access-status": { data: { kycStatus: "verified", isVerified: true } },
      },
      { "access-status": 50, documents: 50 },
    );
    const inFlight = useProfileStore.getState().fetchKYCStatus("user-1");

    // Sign-out happens while that fetch is still resolving.
    useProfileStore.getState().resetKycState();
    expect(useProfileStore.getState().kycData).toBeNull();
    expect(useProfileStore.getState().kycStatusResolved).toBe(false);
    expect(useProfileStore.getState().kycStatusResolvedFor).toBeNull();

    await inFlight; // let the stale response land after reset

    // Must still be cleared — the pre-reset user's response must not
    // repopulate state for what is now a logged-out (or different-user) session.
    expect(useProfileStore.getState().kycData).toBeNull();
  });
});
