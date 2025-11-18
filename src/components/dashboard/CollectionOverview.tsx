import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore, useAuthStore } from '@/store';
import { toast } from 'sonner';
import fixedIcon from '@/assets/fixed icon.svg';

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

  // ✅ Keep only active collections
  // const activeCollections = [...collections].filter(col => col.status === 'active');
  const activeCollections = [...collections].filter(col => new Date(col.deadline).getTime() > Date.now());

  const sortedCollections = [...activeCollections].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });

  collections = sortedCollections.slice(0, 6);

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
      <div className="flex justify-between items-center mb-4 mt-4">
        <h3 className="text-[18px] md:text-[24px] font-semibold flex items-center gap-2">
          Collections
          <span className="bg-green-600 -mt-4 text-white text-[18px] font-medium h-7 w-7 flex items-center justify-center rounded-full">
            {collections.length}
          </span>
        </h3>
        <Button
          variant="link"
          className="text-[16px]"
          onClick={() => navigate('/collections')}
        >
          see more
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {collections.length === 0 && (
          <p className="text-sm text-muted-foreground">No active collections. <a href="/dashboard/create-collection">Create collection</a></p>
        )}
        {collections.map((collection) => {

          console.log(collection, 'coll in dashboard');


          return (

            <div key={collection.id} onClick={() => (navigate(`collections/${collection.id}`))} className="p-4 bg-white rounded-xl hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">
                    {collection.type == 'tiered' && <img src={fixedIcon} alt="" />}
                    {collection.type == 'fixed' && <p>fx</p>}
                    {collection.type == 'fundraising' && <p>fr</p>}

                  </span>
                </div>
                <div className="flex-1 min-w-0 relative">
                  <h4 className="font-medium text-[18px] mb-1 truncate">{collection.title}</h4>
                  <h4 className="font-medium absolute right-0 -top-12 opacity-40 text-[36px] truncate">{collection.total_contributions}</h4>
                  <div className="text-[12px] flex justify-between gap-4">
                    <span>Available</span>
                    <span className="font-semibold text-[14px]">
                      {formatCurrency(collection.wallets[0]?.available_balance || 0)}
                    </span>
                  </div>
                  <div className="text-[12px] flex justify-between gap-4">
                    <span>Pending</span>
                    <span className="font-semibold text-[14px]">
                      {formatCurrency(collection.wallets[0]?.pending_balance || 0)}
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
          )
        })}
      </div>
    </div>
  );
};

export default CollectionsOverview;