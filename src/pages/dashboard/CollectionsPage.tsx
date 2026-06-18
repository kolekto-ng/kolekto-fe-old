import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import CollectionCard from '@/components/collections/CollectionCard';
import { toast } from 'sonner';

import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store';
import { CollectionGridSkeleton } from '@/components/ui/page-skeletons';

const CollectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { collections, isLoading, error, fetchCollections } = useCollectionStore();

  useEffect(() => {
    if (user) {
      fetchCollections(user.id).catch((err) => {
        console.error('Error loading collections:', err);
        toast.error('Failed to load collections. Please try again.');
      });
    }
  }, [user, fetchCollections]);

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
        {isLoading ? (
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
