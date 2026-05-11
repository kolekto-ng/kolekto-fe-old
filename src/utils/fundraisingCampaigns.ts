import { supabase } from "@/integrations/supabase/client";

export interface FundraisingCampaignRow {
  id: string;
  slug?: string | null;
  title: string;
  summary?: string | null;
  campaign_summary?: string | null;
  main_image_url?: string | null;
  banner_url?: string | null;
  deadline?: string | null;
  target_amount?: number | null;
  total_raised?: number | null;
  contributions_count?: number;
  category?: string | null;
  campaign_category?: string | null;
  keywords?: string[] | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

const FUNCTION_TIMEOUT_MS = 12000;
const SHOULD_PREFER_DIRECT_FETCH = import.meta.env.DEV;

function toNumber(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function normalizeCampaignRow(row: any): FundraisingCampaignRow {
  const keywords = Array.isArray(row?.keywords)
    ? row.keywords
    : typeof row?.campaign_keywords === "string"
      ? row.campaign_keywords
          .split(",")
          .map((k: string) => k.trim())
          .filter(Boolean)
      : [];

  return {
    id: row.id,
    slug: row.slug || null,
    title: row.title,
    summary: row.summary || row.campaign_summary || row.description || null,
    campaign_summary: row.campaign_summary || row.summary || null,
    main_image_url: row.main_image_url || row.banner_url || null,
    banner_url: row.banner_url || row.main_image_url || null,
    deadline: row.deadline || null,
    target_amount: toNumber(
      row.target_amount,
      row.fundraising_target_amount,
      row.goal_amount,
      row.amount
    ),
    total_raised: toNumber(
      row.total_raised,
      row.net_payment,
      row.total_amount,
      row.wallet?.net_payment,
      row.wallets?.[0]?.net_payment
    ),
    contributions_count: toNumber(
      row.contributions_count,
      row.contributors_count,
      row.donor_count,
      row.donors_count,
      row.total_contributions
    ),
    category: row.category || row.campaign_category || null,
    campaign_category: row.campaign_category || row.category || null,
    keywords,
    status: String(row.status || "draft").toLowerCase(),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function isLive(campaign: FundraisingCampaignRow) {
  if ((campaign.status || "").toLowerCase() !== "active") return false;
  if (!campaign.deadline) return true;
  return new Date(campaign.deadline).getTime() >= Date.now();
}

async function fetchFromEdgeFunction(): Promise<FundraisingCampaignRow[]> {
  const invokePromise = supabase.functions.invoke("get-all-fundraising-campaigns", {
    body: { status: "active", onlyLive: true, lightweight: true },
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timed out loading campaigns")), FUNCTION_TIMEOUT_MS);
  });

  const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
  if (error) {
    throw new Error(error.message || "Failed to load fundraising campaigns");
  }

  const rows = Array.isArray((data as any)?.data) ? (data as any).data : [];
  return rows.map(normalizeCampaignRow).filter(isLive);
}

async function fetchFromCollectionsFallback(): Promise<FundraisingCampaignRow[]> {
  const { data: collections, error } = await supabase
    .from("collections")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message || "Failed to load collections");
  }

  const fundraiserRows = (collections || []).filter((row: any) => {
    const type = String(row?.collection_type || row?.type || "").toLowerCase();
    return type === "fundraising";
  });

  if (fundraiserRows.length === 0) {
    return [];
  }

  const ids = fundraiserRows.map((row: any) => row.id);
  const [{ data: wallets }, { data: contributions }] = await Promise.all([
    supabase
      .from("wallets")
      .select("collection_id, net_payment, updated_at")
      .in("collection_id", ids),
    supabase
      .from("contributions")
      .select("collection_id, status")
      .in("collection_id", ids)
      .eq("status", "paid"),
  ]);

  const walletMap: Record<string, any> = {};
  (wallets || []).forEach((wallet: any) => {
    const existing = walletMap[wallet.collection_id];
    if (
      !existing ||
      new Date(wallet.updated_at || 0).getTime() >
        new Date(existing.updated_at || 0).getTime()
    ) {
      walletMap[wallet.collection_id] = wallet;
    }
  });

  const contributionCountMap: Record<string, number> = {};
  (contributions || []).forEach((contribution: any) => {
    contributionCountMap[contribution.collection_id] =
      (contributionCountMap[contribution.collection_id] || 0) + 1;
  });

  return fundraiserRows
    .map((row: any) =>
      normalizeCampaignRow({
        ...row,
        total_raised: toNumber(walletMap[row.id]?.net_payment, row.total_amount, 0),
        contributions_count: contributionCountMap[row.id] ?? row.total_contributions ?? 0,
      })
    )
    .filter(isLive);
}

export async function getActiveFundraisingCampaigns(): Promise<FundraisingCampaignRow[]> {
  if (SHOULD_PREFER_DIRECT_FETCH) {
    try {
      const rows = await fetchFromCollectionsFallback();
      if (rows.length > 0) return rows;
    } catch {
      // Fall through to the edge function path.
    }
  }

  try {
    const rows = await fetchFromEdgeFunction();
    if (rows.length > 0) return rows;
    return await fetchFromCollectionsFallback();
  } catch {
    return await fetchFromCollectionsFallback();
  }
}
