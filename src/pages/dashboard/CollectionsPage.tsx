import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import CollectionCard from '@/components/collections/CollectionCard';
import { toast } from 'sonner';

import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store';
import { CollectionGridSkeleton } from '@/components/ui/page-skeletons';
import { supabase } from '@/integrations/supabase/client';

const CollectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { collections, isLoading, error, fetchCollections } = useCollectionStore();

  useEffect(() => {
    if (user) {
      fetchCollections(user.id, {
        silent: Array.isArray(collections) && collections.length > 0,
      }).catch((err) => {
        console.error('Error loading collections:', err);
        toast.error('Failed to load collections. Please try again.');
      });
    }
  }, [user?.id, collections?.length, fetchCollections]);

  // Live-update the list when any of the user's collections changes (status
  // flips to closed/paused, a new collection is created, target/limit edited).
  // One channel per user, torn down on unmount — no duplicate subscriptions.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`collections-list-${user.id}`)
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
  }, [user?.id, fetchCollections]);

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

  // Sort collections by created_at descending (newest first)
  const sortedCollections = [...collections].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });

  return (
    <div className="space-y-6">
      {/* <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Collections</h1>
        <Button asChild className="bg-kolekto hover:bg-kolekto/90">
          <Link to="/dashboard/create-collection">New Collection</Link>
        </Button>
      </div> */}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && sortedCollections.length === 0 ? (
          <CollectionGridSkeleton />
        ) : sortedCollections && sortedCollections.length > 0 ? (

          sortedCollections.map(collection => {
            console.log("Collection object:", collection);
            return (
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
                tiers={collection.price_tiers?.map((tier: any) => ({ amount: tier.price, name: tier.name }))}
                totalRaised={collection.total_amount || 0}
                goalAmount={collection.target_amount || collection.amount || undefined}
                onShare={(e) => handleShare(collection.id, e)}
                onViewDetails={() => handleViewDetails(collection.id)}
              />
            );
          })
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center">
              <p className="text-gray-500 mb-4">You don't have any collections yet</p>
              <Button asChild className="bg-kolekto hover:bg-kolekto/90">
                <Link to="/dashboard/create-collection">Create Your First Collection</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CollectionsPage;
