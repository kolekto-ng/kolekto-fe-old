import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, AlertCircle, Wallet, Users } from 'lucide-react';
import { useCollectionAccessStore } from '@/store/useCollectionAccessStore';
import { CollectionDetailsSkeleton } from '@/components/ui/page-skeletons';

function fmtCurrency(n: number) {
  return `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const SharedCollectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchSharedCollectionDetail } = useCollectionAccessStore() as any;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSharedCollectionDetail(id).then((result: any) => {
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    });
  }, [id, fetchSharedCollectionDetail]);

  if (loading) return <CollectionDetailsSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-gray-400" />
        <p className="text-gray-500">{error || 'Collection not found'}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/shared-with-me')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Shared Collections
        </Button>
      </div>
    );
  }

  const { collection, earnings, contributors } = data;

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard/shared-with-me')}
          aria-label="Back to shared collections"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-900 transition-all hover:bg-gray-100 active:scale-[0.96]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 text-xl font-semibold leading-tight text-gray-900 sm:text-2xl">Shared Collection</h1>
      </div>

      <div className="rounded-[1.35rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words text-xl font-semibold leading-snug text-gray-950 sm:text-2xl">{collection.title}</h2>
          <Badge variant="secondary">{collection.status}</Badge>
        </div>
        {collection.description && (
          <p className="mt-2 text-sm text-gray-500">{collection.description}</p>
        )}
        <p className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 inline-block">
          You have read-only access to this collection. Editing, withdrawing, and other actions aren't available.
        </p>
      </div>

      {earnings && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#1B5E20]" /> Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Total Raised</p>
              <p className="text-sm font-semibold text-gray-900">{fmtCurrency(earnings.totalRaised)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Available</p>
              <p className="text-sm font-semibold text-gray-900">{fmtCurrency(earnings.availableBalance)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Withdrawn</p>
              <p className="text-sm font-semibold text-gray-900">{fmtCurrency(earnings.withdrawn)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {contributors && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1B5E20]" /> Contributors ({contributors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contributors.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No contributions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributors.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.contributor_name || 'Anonymous'}</TableCell>
                      <TableCell>{c.contributor_email || c.contributor_phone || '—'}</TableCell>
                      <TableCell>{c.tier_name || '—'}</TableCell>
                      <TableCell>{fmtCurrency(c.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!earnings && !contributors && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center text-sm text-gray-500">
            The owner hasn't shared earnings or contributor details for this collection.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SharedCollectionDetailPage;
