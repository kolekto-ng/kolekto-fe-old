import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import ContributionWrapper from '@/components/contribute/ContributionWrapper';
import FundraisingPublicPage from '@/components/contribute/FundraisingPublicPage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FaTwitter, FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa";
import Logo from '@/components/Logo';
import { useCollectionStore, useContributionStore } from '@/store';
import Maintenance from '@/components/Maintenance';
import { getCampaignById } from '@/services/fundraisingService';

const ContributePage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFundraising, setIsFundraising] = useState(false);

  const { fetchCollectionById } = useContributionStore()

  useEffect(() => {
    const fetchCollection = async () => {
      if (!collectionId) {
        setError('Collection ID is missing');
        setLoading(false);
        return;
      }

      setError(null);
      setLoading(true);

      try {
        // 1. Try fetching as a Standard Collection
        try {
          const data = await fetchCollectionById(collectionId);
          console.log(data, 'Fetched collection data');

          if (data) {
            // Check if collection is still active
            if (data.status !== 'active') {
              throw new Error('This collection is no longer accepting contributions');
            }

            // Check if deadline has passed
            if (data.deadline && new Date(data.deadline) < new Date()) {
              throw new Error('The deadline for this collection has passed');
            }

            setCollection(data);
            setIsFundraising(false);
            setLoading(false);
            return; // Found it, exit
          }
        } catch (stdError: any) {
          console.log("Standard fetch failed, trying fundraising...", stdError.message);
          // Continue to step 2
        }

        // 2. Try fetching as a Fundraising Campaign (Supabase)
        const campaign = await getCampaignById(collectionId);

        if (campaign) {
          // Check campaign status if needed
          if (campaign.status === 'suspended') {
            throw new Error('This campaign has been suspended');
          }

          // Fundraising Lifecycle Checks
          // 1. Pending: Not accessible publicy
          if (campaign.status === 'pending') {
            throw new Error('This campaign is pending approval');
          }
          // 2. Rejected: Not accessible
          if (campaign.status === 'rejected') {
            throw new Error('This campaign is not available');
          }
          // 3. Paused/Closed: Accessible but read-only (Handled in FundraisingPublicPage)
          // 4. Active: Accessible (Default)

          setCollection(campaign);
          setIsFundraising(true);
        } else {
          throw new Error('Collection not found');
        }

      } catch (err: any) {
        console.error('Error fetching collection:', err);
        setError(err.message || 'Failed to fetch collection details');
        toast.error(err.message || 'Failed to fetch collection details');
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionId, fetchCollectionById]);

  // Process form fields from collection
  const getFormFields = () => {
    if (!collection) return [];

    // Use the form_fields or contributions_fields from the collection if available
    const formFields = collection.contributions_fields || collection.form_fields;
    if (formFields && Array.isArray(formFields)) {
      return formFields.map((field: any) => ({
        name: field.name,
        type: field.type,
        required: field.required,
        options: field.options
      }));
    }

    // Fallback to default fields
    return [
      { name: 'Full Name', type: 'text', required: true },
      { name: 'Email', type: 'email', required: true },
      { name: 'Phone Number', type: 'tel', required: false },
    ];
  };

  // Check if collection has price tiers
  const hasPriceTiers = () => {
    return collection &&
      collection.price_tiers &&
      Array.isArray(collection.price_tiers) &&
      collection.price_tiers.length > 0;
  };

  // Custom navigation component for contribution page
  const ContributionNavBar = () => (
    <nav className="border-b py-3 bg-white">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          <div className="flex items-center space-x-3">
            <a
              href="https://x.com/kolektng"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
            >
              <FaTwitter className="text-gray-600 hover:text-kolekto text-xl" />
            </a>
            <a
              href="https://www.facebook.com/share/1AVyxK7Prc/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <FaFacebook className="text-gray-600 hover:text-kolekto text-xl" />
            </a>
            <a
              href="https://www.instagram.com/kolekto.ng"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <FaInstagram className="text-gray-600 hover:text-kolekto text-xl" />
            </a>
            <a
              href="https://wa.me/+2349019840377"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <FaWhatsapp className="text-gray-600 hover:text-kolekto text-xl" />
            </a>
          </div>
        </div>
      </div>
    </nav>
  );

  // If still loading
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <ContributionNavBar />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <p>Loading collection details...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // If there was an error or collection not found
  if (error || !collection) {
    return (
      <div className="min-h-screen flex flex-col">
        <ContributionNavBar />
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <h2 className="text-xl font-bold mb-4">Collection Not Available</h2>
              <p className="mb-6 text-gray-600">
                {error || 'The requested collection could not be found'}
              </p>
              <Button onClick={() => navigate('/')}>Return to Home</Button>
            </CardContent>
          </Card>
        </main>
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Collecting?</h2>
          <p className="text-gray-600 mb-6">
            Join thousands of organizers across Africa who use Kolekto to
            simplify group payments.
          </p>
          <Button asChild>
            <Link to="/register">Create Your Account</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Render Fundraising Page if type matches
  if (isFundraising) {
    return (
      <div className="min-h-screen flex flex-col">
        <ContributionNavBar />
        <FundraisingPublicPage campaign={collection} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ContributionNavBar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <ContributionWrapper
            collectionId={collection.id}
            collection={collection}
            collectionTitle={collection.title}
            amount={collection.amount}
            fee_bearer={collection.fee_bearer}
            amountBreakdown={collection.wallets?.[0]?.fee_breakdown}
            wallet={collection.wallets?.[0]}
            fields={getFormFields()}
            description={collection.description}
            deadline={collection.deadline}
            max_contributions={collection.max_contributions}
            total_contributions={collection.total_contributions}
            priceTiers={hasPriceTiers() ? collection.price_tiers : undefined}
          />
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Start Collecting?</h2>
            <p className="text-gray-600 mb-6">
              Join thousands of organizers across Africa who use Kolekto to
              simplify group payments.
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