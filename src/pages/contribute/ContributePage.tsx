
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import ContributionWrapper from '@/components/contribute/ContributionWrapper';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FaTwitter, FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa";
import Logo from '@/components/Logo';
import { useCollectionStore, useContributionStore } from '@/store';

const ContributePage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { fetchCollectionById } = useContributionStore()

  useEffect(() => {
    const fetchCollection = async () => {
      if (!collectionId) {
        setError('Collection ID is missing');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchCollectionById(collectionId);

        if (!data) {
          throw new Error('Collection not found');
        }

        // Check if collection is still active
        if (data.status !== 'active') {
          throw new Error('This collection is no longer accepting contributions');
        }

        // Check if deadline has passed
        if (data.deadline && new Date(data.deadline) < new Date()) {
          throw new Error('The deadline for this collection has passed');
        }

        setCollection(data);
      } catch (err: any) {
        console.error('Error fetching collection:', err);
        setError(err.message || 'Failed to fetch collection details');
        toast.error(err.message || 'Failed to fetch collection details');
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionId]);

  // Process form fields from collection
  const getFormFields = () => {
    if (!collection) return [];

    // Use the form_fields from the collection if available
    if (collection.contributions_fields && Array.isArray(collection.contributions_fields)) {
      return collection.contributions_fields.map((field: any) => ({
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
      collection.pricing_tiers &&
      Array.isArray(collection.pricing_tiers) &&
      collection.pricing_tiers.length > 0;
  };

  // If still loading
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
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
        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <p>Loading collection details...</p>
          </div>
        </main>
      </div>
    );
  }

  // If there was an error or collection not found
  if (error || !collection) {
    return (
      <div className="min-h-screen flex flex-col">
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

        <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <h2 className="text-xl font-bold mb-4">
                Collection Not Available
              </h2>
              <p className="mb-6 text-gray-600">
                {error || "The requested collection could not be found"}
              </p>
              <Button onClick={() => navigate("/")}>Return to Home</Button>
            </CardContent>
          </Card>
        </main>
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to Start Collecting?
          </h2>
          <p className="text-gray-600 mb-6">
            Join thousands of organizers across Africa who use Kolekto to
            simplify group payments.
          </p>
          <Button asChild>
            <Link to="/register">Create Your Account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b py-3 bg-white">
        <div className="container flex justify-between items-center">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <Link to="/" className="">
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
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <ContributionWrapper
            collectionId={collection.id}
            collectionTitle={collection.title}
            amount={collection.amount}
            amountBreakdown={collection.wallets[0].fee_breakdown}
            fields={collection.contributions_fields}
            description={collection.description}
            deadline={collection.deadline}
          />
          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold mb-4">
              Ready to Start Collecting?
            </h2>
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
    </div>
  );
};

export default ContributePage;
