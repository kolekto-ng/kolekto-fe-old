import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore, useAuthStore } from '@/store';
import { toast } from 'sonner';

interface Collection {
  id: string;
  name: string;
  balance: number;
  icon?: string;
}

interface CollectionsOverviewProps {
  collections?: Collection[];
}

const CollectionsOverview = ({
  collectionss = [
    { id: '1', name: 'Getting handbook', balance: 100000.00 },
    { id: '2', name: 'Getting handbook', balance: 120000.00 },
    { id: '3', name: 'Getting handbook', balance: 100000.00 },
    { id: '4', name: 'Getting handbook', balance: 120000.00 },
  ]
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  let { collections, isLoading, error, fetchCollections } = useCollectionStore();

  collections = collections.slice(0, 6);

  useEffect(() => {
    if (user) {
      fetchCollections(user.id).catch((err) => {
        console.error('Error loading collections:', err);
        toast.error('Failed to load collections. Please try again.');
      });
    }
  }, [user, fetchCollections]);

  console.log(collectionss, 'coll', error);


  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Collections
          <span className="bg-green-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
            {collections.length}
          </span>
        </h3>
        <Button
          variant="link"
          className="text-sm text-black"
          onClick={() => navigate('/dashboard/collections')}
        >
          see more
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections.map((collection) => (
          <div key={collection.id} className="p-4 bg-white rounded-xl hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-lg">📖</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm mb-1 truncate">{collection.title}</h4>
                <div className="text-xs text-muted-foreground">
                  <span>balance </span>
                  <span className="font-semibold text-foreground">
                    {/* {formatCurrency(collection.balance)} */}
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="w-full bg-green-700 hover:bg-green-800 text-white"
              size="sm"
            >
              withdraw
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollectionsOverview;