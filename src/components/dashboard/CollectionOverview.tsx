import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore, useAuthStore } from '@/store';
import { toast } from 'sonner';
import { Lock, Layers, Waves, Ticket, Heart, Users } from 'lucide-react';

const TYPE_ICON: Record<string, { label: string; icon: React.ElementType }> = {
  fixed: { label: 'Fixed', icon: Lock },
  flat: { label: 'Fixed', icon: Lock },
  tiered: { label: 'Tiered', icon: Layers },
  open_pool: { label: 'Open Pool', icon: Waves },
  ticket: { label: 'Ticket', icon: Ticket },
  fundraising: { label: 'Fundraising', icon: Heart },
};

const DEFAULT_ICON = { label: 'Collection', icon: Lock };

const formatCurrency = (amount: number) => {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const CollectionsOverview: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { collections: allCollections, fetchCollections } = useCollectionStore();

  useEffect(() => {
    if (user) {
      fetchCollections(user.id).catch((err: any) => {
        console.error('Error loading collections:', err);
        toast.error('Failed to load collections. Please try again.');
      });
    }
  }, [user, fetchCollections]);

  const collections = [...allCollections]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return (
    <div>
      <div className="flex justify-between items-center mb-4 mt-4">
        <h3 className="text-[18px] md:text-[24px] font-semibold flex items-center gap-2">
          Collections
          <span className="bg-green-600 -mt-4 text-white text-[14px] font-medium h-6 w-6 flex items-center justify-center rounded-full">
            {allCollections.length}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No collections yet.{' '}
            <a href="/create-collection" className="text-green-600 underline">Create one</a>
          </p>
        )}

        {collections.map((collection: any) => {
          const colType = collection.collection_type || collection.type || 'fixed';
          const typeInfo = TYPE_ICON[colType] || DEFAULT_ICON;
          const Icon = typeInfo.icon;

          const totalRaised = collection.total_amount || 0;
          const participantCount = collection.total_contributions || collection.participants_count || 0;

          return (
            <div
              key={collection.id}
              onClick={() => navigate(`collections/${collection.id}`)}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-200"
            >
              {/* Card body */}
              <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-600">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-[16px] text-gray-900 truncate">{collection.title}</h4>
                      <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="text-sm font-bold mt-0.5 text-gray-900">
                      {formatCurrency(totalRaised)}
                      <span className="text-xs font-normal text-gray-400 ml-1">raised</span>
                    </p>
                  </div>
                </div>

                {/* Participants + Status row */}
                <div className="flex justify-between items-center text-[12px] text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{participantCount} contributor{participantCount !== 1 ? 's' : ''}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    collection.status === 'active' ? 'bg-green-100 text-green-700' :
                    collection.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {collection.status || 'active'}
                  </span>
                </div>

                <Button
                  className="w-full bg-green-700 hover:bg-green-800 text-white"
                  size="sm"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    navigate(`collections/${collection.id}`);
                  }}
                >
                  View Details
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CollectionsOverview;
