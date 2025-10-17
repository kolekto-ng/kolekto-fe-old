import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import CollectionCard from '@/components/collections/CollectionCard';
import { toast } from 'sonner';

import { useCollectionStore } from '@/store/useCollectionStore';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store';

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

  const handleShare = (id: string) => {
    console.log('Navigating to share collection with id:', id);
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
          <Card className="col-span-full">
            <CardContent className="py-10 text-center">
              <div className="flex justify-center mb-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
              <p className="text-gray-500">Loading collections...</p>
            </CardContent>
          </Card>
        ) : sortedCollections && sortedCollections.length > 0 ? (

          sortedCollections.map(collection => {
            console.log("Collection object:", collection);
            return (
              <CollectionCard
                key={collection.id}
                id={collection.id}
                title={collection.title}
                description={collection.description || undefined}
                amount={collection.amount}
                deadline={collection.deadline || new Date().toISOString()}
                status={collection.status as 'active' | "paused" | 'expired' | 'completed'}
                type={collection.type as 'flat' | 'tier'}
                participantsCount={collection.total_contributions || 0}
                maxParticipants={collection.max_contributions || undefined}
                dateCreated={collection.created_at}
                tiers={(() => {
                  console.log("collection.price_tiers:", collection.price_tiers);
                  console.log("typeof price_tiers:", typeof collection.price_tiers);
                  console.log("Array.isArray(price_tiers):", Array.isArray(collection.price_tiers));

                  if (collection.price_tiers) {
                    const transformedTiers = collection.price_tiers.map((tier: any) => ({
                      amount: tier.price,
                      name: tier.name
                    }));
                    console.log("Transformed tiers:", transformedTiers);
                    return transformedTiers;
                  } else {
                    console.log("price_tiers is falsy:", collection.price_tiers);
                    return undefined;
                  }
                })()}
                onShare={() => handleShare(collection.id)}
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
