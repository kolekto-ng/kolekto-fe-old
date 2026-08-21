// WalletOverview component tests — Workspace Wave 6.7D.
//
// The direct-Supabase fallback this component used to run when
// /dashboard/stats failed had no capability awareness at all: it queried
// `contributions.amount` straight from the browser, independent of
// transaction:read. It was replaced with a computation over the collections
// already sitting in useCollectionStore — data that GET /collections already
// redacted server-side (an `amount` field is present on an embedded
// contribution only when the caller held transaction:read; see
// collectionScopeRepository.js's listCollectionsForScope). These tests pin
// that the fallback now degrades correctly instead of leaking money on a
// MEMBER whose primary stats request happens to fail.
//
// Rendering uses react-dom/client + act directly, matching this repo's
// established pattern (see WorkspacePage.members.test.tsx) rather than
// introducing @testing-library/react.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { setSession: vi.fn(), signOut: vi.fn() }, from: vi.fn(), functions: { invoke: vi.fn() } },
}));

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock("@/utils/axios", () => ({ axiosInstance: { get: getMock, post: vi.fn(), put: vi.fn() } }));

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

vi.mock("@/components/withdrawals/WithdrawFundsDialog", () => ({
  WithdrawFundsDialog: () => null,
}));

const collectionsState = { collections: [] as any[] };
vi.mock("@/store", () => ({
  useAuthStore: () => ({ user: { id: "user-1" } }),
  useCollectionStore: () => collectionsState,
}));

import WalletOverview from "./WalletOverview";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  getMock.mockReset();
  collectionsState.collections = [];
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
});

async function renderWallet() {
  await act(async () => {
    root = createRoot(container);
    root.render(<WalletOverview />);
    // Flush the effect's microtask chain.
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("WalletOverview", () => {
  it("renders the primary /dashboard/stats figures when the request succeeds", async () => {
    getMock.mockResolvedValue({ data: { data: { availableBalance: 5000, pendingBalance: 1000, totalBalance: 6000 } } });

    await renderWallet();

    expect(container.textContent).toContain("₦6,000.00");
  });

  it("FALLBACK: derives the total from already-scoped collections, not a direct Supabase query, when stats fails", async () => {
    getMock.mockRejectedValue(new Error("network down"));
    collectionsState.collections = [
      { id: "c1", contributions: [{ id: "ct1", amount: 4000, status: "paid" }] },
      { id: "c2", contributions: [{ id: "ct2", amount: 2500, status: "paid" }, { id: "ct3", amount: 999, status: "pending" }] },
    ];

    await renderWallet();

    // 4000 + 2500 = 6500; the pending-status contribution must not count.
    expect(container.textContent).toContain("₦6,500.00");
  });

  it("SECURITY: a MEMBER's redacted collections (no amount field) fall back to a money-free total, not an error or a leaked figure", async () => {
    getMock.mockRejectedValue(new Error("network down"));
    // Shape GET /collections actually returns for a caller without
    // transaction:read: contribution rows exist (for counts) but never carry
    // `amount` at all.
    collectionsState.collections = [
      { id: "c1", contributions: [{ id: "ct1", status: "paid" }, { id: "ct2", status: "paid" }] },
    ];

    await renderWallet();

    expect(container.textContent).toContain("₦0.00");
  });
});
