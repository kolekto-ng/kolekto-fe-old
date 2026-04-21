import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Filter,
  Heart,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import Footer from "@/components/Footer/Footer";
import NavBar from "@/components/NavBar";
import ActiveCampaignCard, {
  ActiveCampaignCardData,
} from "@/components/campaigns/ActiveCampaignCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FUNDRAISING_CATEGORIES } from "@/constants/fundraising";
import { supabase } from "@/integrations/supabase/client";

interface ActiveCampaign extends ActiveCampaignCardData {
  keywords?: string[] | null;
  created_at?: string;
}

const CAMPAIGNS_CACHE_KEY = "kolekto_active_campaigns_v1";
const CAMPAIGNS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readCampaignsCache(): ActiveCampaign[] | null {
  try {
    const raw = sessionStorage.getItem(CAMPAIGNS_CACHE_KEY);
    if (!raw) return null;
    const { rows, ts } = JSON.parse(raw) as { rows: ActiveCampaign[]; ts: number };
    if (Date.now() - ts > CAMPAIGNS_CACHE_TTL) return null;
    return rows;
  } catch {
    return null;
  }
}

function writeCampaignsCache(rows: ActiveCampaign[]) {
  try {
    sessionStorage.setItem(CAMPAIGNS_CACHE_KEY, JSON.stringify({ rows, ts: Date.now() }));
  } catch {
    // storage quota exceeded — ignore
  }
}

function isCampaignCurrentlyActive(campaign: ActiveCampaign) {
  const status = (campaign.status || "").toLowerCase();

  if (status !== "active") {
    return false;
  }

  if (!campaign.deadline) {
    return true;
  }

  return new Date(campaign.deadline).getTime() >= Date.now();
}

function getCampaignLink(campaign: ActiveCampaign) {
  return `/contribute/${campaign.slug || campaign.id}`;
}

const ActiveCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<ActiveCampaign[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = async (forceRefresh = false) => {
    setError(null);

    // Serve from cache instantly — no loading spinner needed
    if (!forceRefresh) {
      const cached = readCampaignsCache();
      if (cached) {
        setCampaigns(cached.filter(isCampaignCurrentlyActive));
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "get-all-fundraising-campaigns",
        {
          body: {
            status: "active",
            onlyLive: true,
            lightweight: true,
          },
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const rows = Array.isArray(data?.data) ? data.data : [];
      writeCampaignsCache(rows);
      setCampaigns(rows.filter(isCampaignCurrentlyActive));
    } catch (err: any) {
      setError(err?.message || "Failed to load active campaigns.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesCategory =
      categoryFilter === "all" ||
      (campaign.category || campaign.campaign_category || "").toLowerCase() === categoryFilter.toLowerCase();

    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      campaign.title,
      campaign.summary,
      campaign.campaign_summary,
      campaign.category,
      campaign.campaign_category,
      ...(Array.isArray(campaign.keywords) ? campaign.keywords : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const categories = [...FUNDRAISING_CATEGORIES];
  campaigns.forEach((campaign) => {
    const category = campaign.category || campaign.campaign_category;

    if (category && !categories.includes(category as (typeof FUNDRAISING_CATEGORIES)[number])) {
      categories.push(category as (typeof FUNDRAISING_CATEGORIES)[number]);
    }
  });

  const openCampaign = (campaign: ActiveCampaign) => {
    navigate(getCampaignLink(campaign));
  };

  const shareCampaign = async (
    campaign: ActiveCampaign,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}${getCampaignLink(campaign)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: campaign.title,
          text: campaign.summary || campaign.campaign_summary || "Support this active campaign on Kolekto.",
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Campaign link copied to clipboard.");
      } else {
        toast.info(shareUrl);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error("Unable to share this campaign right now.");
      }
    }
  }
  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
  };

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <NavBar />

      <main className="flex-grow bg-[#FAFAFA]">
        <section className="px-4 py-8 lg:px-8 lg:py-12">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
            <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-gradient-to-br from-[#E8F5E9] via-white to-[#FFF2D4] p-6 shadow-sm lg:p-8">
              <div className="max-w-2xl">
                <Badge className="bg-green-900 text-white hover:bg-green-900">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Discover live fundraisers
                </Badge>
                <h1 className="mt-4 font-clash text-4xl font-medium tracking-tight text-slate-900 sm:text-5xl">
                  Active Campaigns
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  Explore fundraising campaigns that are currently live on Kolekto, track their
                  momentum, and share the ones that matter to you.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm lg:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by campaign title, description, keyword, or category"
                    className="h-11 border-gray-200 pl-10"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto]">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-11 border-gray-200">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Filter className="h-4 w-4" />
                        <SelectValue placeholder="Filter by category" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    className="h-11 border-gray-200"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <p>
                  Showing <span className="font-semibold text-slate-900">{filteredCampaigns.length}</span>{" "}
                  active campaign{filteredCampaigns.length === 1 ? "" : "s"}
                </p>
                {(normalizedQuery || categoryFilter !== "all") && (
                  <Badge variant="outline" className="border-gray-200 bg-slate-50 text-slate-600">
                    Filters applied
                  </Badge>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden rounded-[24px] border-gray-200">
                    <Skeleton className="aspect-[16/10] w-full" />
                    <CardContent className="space-y-5 p-5">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                      </div>
                      <Skeleton className="h-24 w-full rounded-2xl" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card className="rounded-[28px] border-gray-200">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-red-50 p-4 text-red-500">
                    <RefreshCcw className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-slate-900">
                    We couldn&apos;t load active campaigns
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{error}</p>
                  <Button className="mt-6 bg-green-900 text-white hover:bg-green-800" onClick={() => loadCampaigns(true)}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : filteredCampaigns.length === 0 ? (
              <Card className="rounded-[28px] border-gray-200">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-slate-900">
                    No campaigns match your filters
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Try a different keyword or category to discover more active fundraising campaigns.
                  </p>
                  <Button variant="outline" className="mt-6 border-gray-200" onClick={clearFilters}>
                    Reset search
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredCampaigns.map((campaign) => (
                  <ActiveCampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onOpen={() => openCampaign(campaign)}
                    onShare={(event) => shareCampaign(campaign, event)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ActiveCampaignsPage;
