import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { useCollectionAccessStore } from '@/store/useCollectionAccessStore';
import { CollectionGridSkeleton } from '@/components/ui/page-skeletons';

const SharedCollectionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { sharedCollections, sharedCollectionsLoading, fetchSharedCollections } = useCollectionAccessStore() as any;

  useEffect(() => {
    fetchSharedCollections();
  }, [fetchSharedCollections]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          <Users className="h-3.5 w-3.5" />
          Shared with Me
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Collections shared with you</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Read-only access granted by other Kolekto organizers. What you can see here depends on what they chose to share.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sharedCollectionsLoading && sharedCollections.length === 0 ? (
          <CollectionGridSkeleton />
        ) : sharedCollections.length > 0 ? (
          sharedCollections.map((c: any) => (
            <Card
              key={c.id}
              className="cursor-pointer border-gray-100 transition-shadow hover:shadow-md"
              onClick={() => navigate(`/dashboard/shared-with-me/${c.id}`)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900">{c.title}</h3>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">{c.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.can_view_earnings && (
                    <span className="text-[10px] rounded-full bg-[#E8F5E9] text-[#1B5E20] px-2 py-0.5 font-medium">Earnings</span>
                  )}
                  {c.can_view_contributors && (
                    <span className="text-[10px] rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 font-medium">Contributors</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full border-dashed border-slate-200 bg-white/70">
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-slate-900">No collections have been shared with you yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                When someone gives you access to a collection, it'll show up here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SharedCollectionsPage;
