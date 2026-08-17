import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useNavigate } from 'react-router-dom';
import CollectionCard from '@/components/collections/CollectionCard';
import { toast } from "@/lib/toast";
import { Badge } from '@/components/ui/badge';
import { ListFilter, RotateCcw, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';

import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useWorkspaceCapabilities } from '@/hooks/useWorkspaceCapabilities';
import { useCanCreateCollection } from '@/hooks/useCanCreateCollection';
import { CollectionGridSkeleton } from '@/components/ui/page-skeletons';
import { supabase } from '@/integrations/supabase/client';
import { getCollectionStatusMeta } from '@/utils/collectionStatus';
import { KycEnforcementBanner } from '@/components/kyc/KycEnforcementBanner';
import { useProfileStore } from '@/store/useProfileStore';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'full', label: 'Full' },
  { value: 'expired', label: 'Expired' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending_review', label: 'Pending review' },
] as const;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'tiered', label: 'Tiered' },
  { value: 'open_pool', label: 'Open pool' },
  { value: 'ticket', label: 'Ticketing' },
  { value: 'fundraising', label: 'Fundraising' },
] as const;

const CollectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { collections, isLoading, error, fetchCollections } = useCollectionStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | (typeof STATUS_OPTIONS)[number]['value']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | (typeof TYPE_OPTIONS)[number]['value']>('all');
  const userId = user?.id;
  // Wave 6.2 — drives refetch + realtime re-keying on workspace switch.
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const hasCachedCollections = collections.length > 0;
  // Single source of truth for the creation limit (shared with the wizard).
  const { limitReached: collectionLimitReached } = useCanCreateCollection();
  // Wave 6.6 — workspace capability, distinct from the KYC limit above.
  const { canCreateCollection } = useWorkspaceCapabilities();

  // Wave 6.2: activeWorkspaceId is a dependency so a switch refetches. The
  // store's own reset has already emptied `collections` by this point, so
  // `hasCachedCollections` is false and the page shows its loading state
  // rather than the previous workspace's rows.
  useEffect(() => {
    if (userId) {
      fetchCollections(userId, {
        silent: hasCachedCollections,
      }).catch((err) => {
        console.error('Error loading collections:', err);
        toast.error('Failed to load collections. Please try again.');
      });
    }
  }, [userId, activeWorkspaceId, hasCachedCollections, fetchCollections]);

  // Live-update the list when any of the user's collections changes (status
  // flips to closed/paused, a new collection is created, target/limit edited).
  // One channel per user, torn down on unmount — no duplicate subscriptions.
  // Wave 6.2: the channel name and the effect's deps both include the active
  // workspace, so switching tears this subscription down and re-establishes
  // it. Without that, the callback would keep firing refetches attributed to
  // the workspace that was active when the channel was first opened.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`collections-list-${user.id}-${activeWorkspaceId ?? 'none'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collections', filter: `user_id=eq.${user.id}` },
        () => {
          void fetchCollections(user.id, { silent: true }).catch(() => undefined);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeWorkspaceId, fetchCollections]);

  const handleShare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id) {
      navigate(`/dashboard/collections/${id}?share=true`);
    } else {
      toast.error('Invalid collection ID');
    }
  };

  const handleViewDetails = (id: string) => {
    console.log('Navigating to view collection with id:', id);
    if (id) {
      navigate(`/dashboard/collections/${id}`);
    } else {
      toast.error('Invalid collection ID');
    }
  };

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }, [collections]);

  const filteredCollections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return sortedCollections.filter((collection) => {
      const resolvedStatus = getCollectionStatusMeta({
        status: collection.status,
        deadline: collection.deadline,
        collection_type: collection.collection_type || collection.type,
        maxParticipants: collection.max_contributions || collection.max_participants || undefined,
        participantsCount: collection.total_contributions || collection.participants_count || 0,
        goalAmount: collection.target_amount || collection.amount || undefined,
        totalRaised: collection.total_amount || 0,
      }).status;

      const collectionType = String(collection.collection_type || collection.type || 'fixed').toLowerCase();
      const searchable = [
        collection.title,
        collection.description,
        collection.campaign_summary,
        collection.status,
        resolvedStatus,
        collectionType,
        String(collection.amount ?? ''),
        String(collection.total_amount ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !term || searchable.includes(term);
      const matchesStatus = statusFilter === 'all' || resolvedStatus === statusFilter;
      const matchesType = typeFilter === 'all' || collectionType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [searchTerm, sortedCollections, statusFilter, typeFilter]);

  const activeFilterCount = [
    searchTerm.trim() ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    typeFilter !== 'all' ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="space-y-6">
      <KycEnforcementBanner />
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Collections
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Your collections</h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Search across your collections and narrow the list by type or status.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
              {filteredCollections.length} of {sortedCollections.length} shown
            </Badge>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 rounded-full border border-slate-200 px-3 text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            )}
            {/* Wave 6.6 — hidden entirely without collection:create (a MEMBER
                of the active workspace). The KYC limit below is a separate,
                orthogonal gate that DISABLES rather than hides, because it is
                a state the user can resolve themselves. Both are cosmetic:
                collectionService asserts collection:create server-side. */}
            {!canCreateCollection ? null : collectionLimitReached ? (
              <Button
                type="button"
                disabled
                title="Complete KYC verification to create more than one collection"
                className="bg-kolekto/40 cursor-not-allowed"
              >
                New Collection
              </Button>
            ) : (
              <Button asChild className="bg-kolekto hover:bg-kolekto/90">
                <Link to="/dashboard/create-collection">New Collection</Link>
              </Button>
            )}
          </div>
        </div>

        {collectionLimitReached && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-xs leading-relaxed text-amber-700">
              Unverified accounts can create only one collection.{' '}
              <button
                type="button"
                onClick={() => {
                  useProfileStore.getState().setActiveSection('kyc');
                  navigate('/dashboard/settings');
                }}
                className="font-semibold underline underline-offset-2"
              >
                Complete KYC verification
              </button>{' '}
              to create more.
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.65fr)_minmax(180px,0.65fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, description, status, or amount"
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 pr-10 text-sm shadow-sm focus-visible:bg-white"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full border-slate-200 px-2 py-0 text-[11px] font-medium text-slate-600">
                  Type
                </Badge>
                <SelectValue placeholder="Type" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white">
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Card className="border-red-100 bg-red-50/60">
          <CardContent className="py-6 text-sm text-red-700">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && sortedCollections.length === 0 ? (
          <CollectionGridSkeleton />
        ) : filteredCollections.length > 0 ? (
          filteredCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              id={collection.id}
              title={collection.title}
              amount={collection.amount}
              deadline={collection.deadline || new Date().toISOString()}
              status={collection.status}
              type={collection.collection_type || collection.type || 'fixed'}
              participantsCount={collection.total_contributions || collection.participants_count || 0}
              maxParticipants={collection.max_contributions || undefined}
              dateCreated={collection.created_at}
              tiers={collection.price_tiers?.map((tier) => ({ amount: tier.price, name: tier.name }))}
              totalRaised={collection.total_amount || 0}
              goalAmount={collection.target_amount || collection.amount || undefined}
              onShare={(e) => handleShare(collection.id, e)}
              onViewDetails={() => handleViewDetails(collection.id)}
            />
          ))
        ) : (
          <Card className="col-span-full border-dashed border-slate-200 bg-white/70">
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-slate-900">
                {collections.length === 0
                  ? "You don't have any collections yet"
                  : 'No collections match your search and filters'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {collections.length === 0
                  ? 'Create your first collection to get started.'
                  : 'Try adjusting the search term or clearing the filters.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {collections.length > 0 && activeFilterCount > 0 ? (
                  <Button type="button" variant="outline" onClick={clearFilters} className="rounded-full">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear filters
                  </Button>
                ) : null}
                <Button asChild className="bg-kolekto hover:bg-kolekto/90">
                  <Link to="/dashboard/create-collection">Create Your First Collection</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CollectionsPage;
