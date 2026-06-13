import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { axiosInstance } from '@/utils/axios';
import Footer from '@/components/Footer';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Lock, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { FaTwitter, FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';
import ContributeFlow from '@/components/contribute/ContributeFlow';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const annotateTierAvailability = (collectionData: any, paidContributions: any[]) => {
  const tiers = Array.isArray(collectionData.pricing_tiers)
    ? collectionData.pricing_tiers
    : Array.isArray(collectionData.price_tiers)
    ? collectionData.price_tiers
    : [];

  const soldByTier = new Map<string, number>();
  for (const contribution of paidContributions) {
    const info = Array.isArray(contribution.contributor_information)
      ? contribution.contributor_information[0] || {}
      : {};
    const tierId = info?.TierId ? String(info.TierId) : '';
    const tierName = info?.Tier ? String(info.Tier) : '';
    const key = tierId || tierName;
    if (!key) continue;
    soldByTier.set(key, (soldByTier.get(key) || 0) + 1);
  }

  const pricing_tiers = tiers.map((tier: any, index: number) => {
    const tierId = String(tier.id || '');
    const tierName = String(tier.name || `Tier ${index + 1}`);
    const sold = soldByTier.get(tierId) || soldByTier.get(tierName) || 0;
    const capacity =
      tier.quantity === null || tier.quantity === undefined ? null : Number(tier.quantity);

    return {
      ...tier,
      sold_quantity: sold,
      remaining_quantity: capacity === null ? null : Math.max(0, capacity - sold),
    };
  });

  return {
    ...collectionData,
    pricing_tiers,
    price_tiers: pricing_tiers,
    participants_count: paidContributions.length,
  };
};

const ContributePage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      if (!collectionId) {
        setError('Invalid collection link.');
        setLoading(false);
        return;
      }

      try {
        let collectionData: any;

        if (UUID_RE.test(collectionId)) {
          // Direct Supabase lookup by UUID
          const { data, error: fetchError } = await supabase
            .from('collections')
            .select('*')
            .eq('id', collectionId)
            .single();

          if (fetchError || !data) throw new Error('Collection not found.');
          collectionData = data;
        } else {
          // Slug-based lookup via backend API
          const res = await axiosInstance.get('/collection', { params: { collectionId } });
          if (!res.data?.data) throw new Error('Collection not found.');
          const raw = res.data.data;
          // Normalize field names: backend uses contributions_fields / price_tiers
          collectionData = {
            ...raw,
            form_fields: raw.contributions_fields ?? raw.form_fields ?? [],
            pricing_tiers: raw.price_tiers ?? raw.pricing_tiers ?? [],
          };
        }

        const [
          { data: paidContributions, error: contributionsError },
          { data: walletData },
        ] = await Promise.all([
          supabase
            .from('contributions')
            .select('id, contributor_information')
            .eq('collection_id', collectionData.id)
            .eq('status', 'paid'),
          // Fetch wallet so the Open Pool progress bar has the real total raised
          supabase
            .from('wallets')
            .select('net_payment')
            .eq('collection_id', collectionData.id)
            .maybeSingle(),
        ]);

        if (contributionsError) throw new Error(contributionsError.message);

        // Inject total_amount (= net_payment from wallet) and goal_amount so
        // ContributeFlow's Open Pool progress bar shows accurate figures.
        const enrichedCollection = {
          ...collectionData,
          total_amount: walletData?.net_payment ?? 0,
          goal_amount: collectionData.target_amount ?? collectionData.goal_amount ?? 0,
        };

        setCollection(annotateTierAvailability(enrichedCollection, paidContributions || []));
      } catch (err: any) {
        setError(err.message || 'Failed to load collection.');
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionId]);

  useEffect(() => {
    if (!collection?.id) return;

    const channel = supabase
      .channel(`collection-live-${collection.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `collection_id=eq.${collection.id}` },
        async () => {
          const [{ data: paidContributions }, { data: walletData }] = await Promise.all([
            supabase
              .from('contributions')
              .select('id, contributor_information')
              .eq('collection_id', collection.id)
              .eq('status', 'paid'),
            supabase
              .from('wallets')
              .select('net_payment')
              .eq('collection_id', collection.id)
              .maybeSingle(),
          ]);

          setCollection((prev: any) =>
            annotateTierAvailability(
              { ...prev, total_amount: walletData?.net_payment ?? prev.total_amount ?? 0 },
              paidContributions || []
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [collection?.id]);

  const ContributionNavBar = () => (
    <nav className="border-b py-3 bg-white">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <Logo size="md" />
        </Link>
        <div className="flex items-center space-x-3">
          <a href="https://x.com/kolektng" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
            <FaTwitter className="text-gray-600 hover:text-kolekto text-xl" />
          </a>
          <a href="https://www.facebook.com/share/1AVyxK7Prc/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <FaFacebook className="text-gray-600 hover:text-kolekto text-xl" />
          </a>
          <a href="https://www.instagram.com/kolekto.ng" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <FaInstagram className="text-gray-600 hover:text-kolekto text-xl" />
          </a>
          <a href="https://wa.me/+2349019840377" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <FaWhatsapp className="text-gray-600 hover:text-kolekto text-xl" />
          </a>
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ContributionNavBar />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-kolekto" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen flex flex-col">
        <ContributionNavBar />
        <main className="flex-grow flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <XCircle className="h-12 w-12 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold">Collection Not Found</h2>
              <p className="text-gray-600">{error || 'The requested collection does not exist.'}</p>
              <Button onClick={() => navigate('/')}>Return to Home</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Status gates
  const status = collection.status;
  const isExpired = collection.deadline && new Date(collection.deadline) < new Date();
  const supportPhone: string | undefined =
    collection.support_phone || collection.support_phone_number || collection.support || undefined;

  // Renders a "contact the host" block for statuses where the host should be reached directly.
  // Not shown for pending/under-review collections (fundraising approval flow).
  const ContactHostBlock = () => {
    if (!supportPhone) return null;
    const wa = `https://wa.me/${supportPhone.replace(/^\+?0?/, '234')}`;
    return (
      <div className="mt-4 pt-4 border-t border-current/20 space-y-2 text-sm">
        <p className="font-semibold">Need help? Contact the organizer:</p>
        <div className="flex items-center justify-center gap-3">
          <a href={`tel:${supportPhone}`} className="underline font-medium">{supportPhone}</a>
          <span className="opacity-40">·</span>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium underline">WhatsApp</a>
        </div>
      </div>
    );
  };

  const renderStatusGate = () => {
    if (isExpired) {
      return (
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center space-y-3">
            <Clock className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-red-700">Collection Expired</h2>
            <p className="text-red-600">
              The deadline for <strong>{collection.title}</strong> has passed.
            </p>
            <ContactHostBlock />
            <Button variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    if (status === 'paused') {
      return (
        <Card className="w-full max-w-md border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h2 className="text-xl font-bold text-yellow-800">Collection Paused</h2>
            <p className="text-yellow-700">
              <strong>{collection.title}</strong> is temporarily paused by the organizer. Please check back later.
            </p>
            <ContactHostBlock />
            <Button variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    // pending_review / pending_verification = fundraising awaiting admin approval
    // Do NOT show contact prompt for either — contributor should simply wait.
    if (status === 'pending_review' || status === 'pending_verification') {
      return (
        <Card className="w-full max-w-md border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-amber-800">Under Review</h2>
            <p className="text-amber-700">
              This collection is pending review and will be available soon.
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    if (status === 'closed' || status === 'completed') {
      return (
        <Card className="w-full max-w-md border-gray-200 bg-gray-50">
          <CardContent className="pt-6 text-center space-y-3">
            <Lock className="h-12 w-12 text-gray-400 mx-auto" />
            <h2 className="text-xl font-bold text-gray-700">Collection Closed</h2>
            <p className="text-gray-600">
              <strong>{collection.title}</strong> is no longer accepting contributions.
            </p>
            <ContactHostBlock />
            <Button variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    const maxContributions = collection.max_contributions ?? collection.max_participants ?? 0;
    if (maxContributions > 0 && (collection.participants_count ?? 0) >= maxContributions) {
      return (
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center space-y-3">
            <Lock className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-red-700">Collection Full</h2>
            <p className="text-red-600">
              <strong>{collection.title}</strong> has reached its maximum number of contributors.
            </p>
            <ContactHostBlock />
            <Button variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const gate = renderStatusGate();

  return (
    <div className="min-h-screen flex flex-col">
      <ContributionNavBar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {gate ? (
            <div className="flex justify-center">{gate}</div>
          ) : (
            <ContributeFlow collection={collection} />
          )}
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Start Collecting?</h2>
            <p className="text-gray-600 mb-6">
              Join thousands of organizers across Africa who use Kolekto to simplify group payments.
            </p>
            <Button asChild>
              <Link to="/register">Create Your Account</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ContributePage;
