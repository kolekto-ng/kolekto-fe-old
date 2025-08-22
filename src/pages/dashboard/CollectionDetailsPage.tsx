import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QRCodeDisplay from '@/components/collections/QRCodeDisplay';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useContributionStore } from '@/store/useContributionStore';
import { useWithdrawalStore } from '@/store/useWithdrawalStore';
import { useAuthStore } from '@/store';
import { BarChart, Download, Eye, Share, Wallet, Users, Clock, AlertCircle, CheckCircle, TimerOff, Loader2, X, Plus, Trash2 } from 'lucide-react';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import { toast } from 'sonner';
import { ChartContainer } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart as RechartsBarChart } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


const CollectionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showQR, setShowQR] = useState(false);
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  // Move these state declarations to the top level
  const [openCollectionModal, setOpenCollectionModal] = useState<boolean>(false);
  const [collectionFormData, setCollectionFormData] = useState({
    title: "",
    description: "",
    deadline: "",
    numberOfContributors: "",
    stopCollection: false,
    price_tiers: [] as any[]
  });

  const { fetchCollectionById, currentCollection, updateCollection } = useCollectionStore();
  const { fetchContributions, contributions } = useContributionStore();
  const { createWithdrawal } = useWithdrawalStore();

  useEffect(() => {
    if (id) {
      fetchCollectionById(id).catch((err) => {
        console.error('Error fetching collection:', err);
        toast.error('Failed to load collection details');
      });

      fetchContributions(id).catch((err) => {
        console.error('Error fetching contributions:', err);
        toast.error('Failed to load contributions');
      });
    }
  }, [id, fetchCollectionById, fetchContributions]);

  useEffect(() => {
    // Initialize form data when currentCollection changes
    if (currentCollection) {
      setCollectionFormData({
        title: currentCollection.title || "",
        description: currentCollection.description || "",
        deadline: currentCollection.deadline ? new Date(currentCollection.deadline).toISOString().split('T')[0] : "",
        numberOfContributors: currentCollection.max_participants?.toString() || "",
        stopCollection: currentCollection.status === "closed",
        price_tiers: currentCollection.price_tiers || []
      });
    }
  }, [currentCollection]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('share') === 'true') {
      setIsShareDrawerOpen(true);
    }
  }, [location]);

  const shareUrl = `${window.location.origin}/contribute/${id}`;

  const handleShare = () => {
    setIsShareDrawerOpen(true);
  };


  const [amountFilter, setAmountFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  // static fields we want to always display
  const staticFields = [
    "name",
    "email",
    "status",
    "formattedAmount",
    "formattedDate",
  ];


  // Only show paid contributors
  const filteredContributors = (contributions || []).filter(
    (contribution) =>
      (contribution.status === "paid") &&
      (
        contribution.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contribution.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
  ) || [];

  // dynamic fields except TierAmount
  const allDynamicFields = Array.from(
    new Set(
      filteredContributors.flatMap(contributor =>
        (contributor.contributor_information || []).flatMap(info =>
          Object.keys(info)
        )
      )
    )
  ).filter(field => field !== "TierAmount");

  // searchable fields
  const searchableFields = [...staticFields, ...allDynamicFields];

  // filtering logic
  const filteredData = filteredContributors.filter(contributor => {
    const search = searchTerm.toLowerCase();

    // 🔍 search across static & dynamic fields
    const matchesSearch = searchableFields.some(field => {
      if (staticFields.includes(field)) {
        return contributor[field]?.toString().toLowerCase().includes(search);
      }
      return (contributor.contributor_information || []).some(info =>
        info[field]?.toString().toLowerCase().includes(search)
      );
    });

    // ✅ status filter
    const matchesStatus =
      statusFilter === "all" || contributor.status === statusFilter;

    // ✅ tier filter
    const contributorTier =
      (contributor.contributor_information || [])[0]?.Tier || "";
    const matchesTier =
      tierFilter === "all" || contributorTier === tierFilter;

    const tierAmount =
      (contributor.contributor_information || [])[0]?.TierAmount || 0;

    let matchesAmount = true;
    if (minAmount !== "" && tierAmount < Number(minAmount)) {
      matchesAmount = false;
    }
    if (maxAmount !== "" && tierAmount > Number(maxAmount)) {
      matchesAmount = false;
    }

    return matchesSearch && matchesStatus && matchesTier && matchesAmount;
  });
const exportToCSV = () => {
  if (!filteredData || filteredData.length === 0) {
    toast.info("No filtered contributors data to export");
    return;
  }

  // 1. Collect all unique dynamic fields from contributor_information
  const allDynamicFields = Array.from(
    new Set(
      filteredData.flatMap(contributor =>
        (contributor.contributor_information || []).flatMap(info =>
          Object.keys(info)
        )
      )
    )
  );

  // 2. Check if any contributor has a unique code
  const hasUniqueCode = filteredData.some(
    c => c.contributor_unique_code
  );

  // 3. Define headers for CSV
  const headers = [
    ...allDynamicFields,
    ...(hasUniqueCode ? ['Unique Code'] : []),
    "name",
    "email",
    "Status",
    "Amount",
    "Date",
  ];

  let csvContent = headers.join(',') + '\n';

  filteredData.forEach((contribution) => {
    const formattedDate = new Date(contribution.created_at).toLocaleDateString('en-NG');

    const infoObject = Object.assign({}, ...(contribution.contributor_information || []));
    const row = [
      ...allDynamicFields.map(field => infoObject[field] || ''),
      ...(hasUniqueCode ? [contribution.contributor_unique_code || ''] : []),
      contribution.name || '',
      contribution.email || '',
      contribution.status || '',
      contribution.amount || '',
      formattedDate || ''
    ];

    csvContent += row.map(val =>
      typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${currentCollection?.title || 'collection'}-contributors.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast.success('Filtered contributor data exported successfully!');
};


//   const exportToCSV = () => {
//   // Use all filtered data directly
//   const contributions = filteredData || [];

//   if (contributions.length === 0) {
//     toast.info("No contributor data to export");
//     return;
//   }

//   // 1. Collect all unique dynamic fields from contributor_information
//   const allDynamicFields = Array.from(
//     new Set(
//       contributions.flatMap(contributor =>
//         (contributor.contributor_information || []).flatMap(info =>
//           Object.keys(info)
//         )
//       )
//     )
//   );

//   // 2. Check if any contributor has a unique code
//   const hasUniqueCode = contributions.some(
//     c => c.contributor_unique_code
//   );

//   // 3. Define headers for CSV
//   const headers = [
//     ...allDynamicFields,
//     ...(hasUniqueCode ? ['Unique Code'] : []),
//   ];

//   let csvContent = headers.join(',') + '\n';

//   contributions.forEach((contribution) => {
//     const formattedDate = new Date(contribution.created_at).toLocaleDateString('en-NG');
//     const row = [
//       ...allDynamicFields.map(field =>
//         (contribution.contributor_information || [])[0]?.[field] || ''
//       ),
//       ...(hasUniqueCode ? [contribution.contributor_unique_code || ''] : []),
//     ];
//     csvContent += row.map(val =>
//       typeof val === 'string' && val.includes(',') ? `"${val}"` : val
//     ).join(',') + '\n';
//   });

//   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
//   const url = URL.createObjectURL(blob);
//   const link = document.createElement('a');
//   link.href = url;
//   link.setAttribute('download', `${currentCollection?.title || 'collection'}-contributors.csv`);
//   document.body.appendChild(link);
//   link.click();
//   document.body.removeChild(link);

//   toast.success('Contributor data exported successfully!');
// };

  const handleWithdraw = () => {
    setIsWithdrawDialogOpen(true);
  };

  const onWithdrawComplete = async (data: {
    amount: number;
    accountName: string;
    accountNumber: string;
    bankName: string;
  }) => {
    if (!user?.id) {
      toast.error('Unable to process withdrawal. Please try again.');
      return;
    }

    try {
      setIsWithdrawDialogOpen(false);
      toast.success('Withdrawal request submitted successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      toast.error(error.message || 'Failed to submit withdrawal request');
      setIsWithdrawDialogOpen(false);
    }
  };

  // Helper to check if collection is active based on deadline
  const isActiveByDeadline = currentCollection?.deadline
    ? new Date(currentCollection.deadline) > new Date()
    : false;

  // Helper to get status string based on deadline
  const getDeadlineStatus = () => {
    if (!currentCollection?.deadline) return currentCollection?.status || "No deadline";
    return isActiveByDeadline ? "active" : "expired";
  };

  // Helper to get status color based on deadline
  const getDeadlineStatusColor = () => {
    const status = getDeadlineStatus();
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper to get status icon based on deadline
  const getDeadlineStatusIcon = () => {
    const status = getDeadlineStatus();
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 mr-1" />;
      case 'expired':
        return <TimerOff className="h-4 w-4 mr-1" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 mr-1" />;
      case 'closed':
        return <AlertCircle className="h-4 w-4 mr-1" />;
      default:
        return <Clock className="h-4 w-4 mr-1" />;
    }
  };


  // Group contributions by date for chart data
  const contributionsByDate = contributions?.reduce((acc, curr) => {
    const date = new Date(curr.created_at).toLocaleDateString('en-NG');
    acc[date] = (acc[date] || 0) + (curr.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(contributionsByDate || {}).map((date) => ({
    date,
    amount: contributionsByDate?.[date] || 0
  }));

  // Calculate total collected amount and withdrawable amount
  const totalCollected = contributions?.reduce((sum, contribution) => {
    return contribution.status === 'paid' ? sum + (contribution.amount || 0) : sum;
  }, 0) || 0;

  const contributorsCount = contributions?.filter((c) => c.status === 'paid').length || 0;

  const withdrawableAmount = currentCollection?.wallets[0].available_balance || 0

  const handleCollectionModal = () => {
    setOpenCollectionModal(!openCollectionModal)
  }

  const handleCollectionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setCollectionFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePriceTierChange = (index: number, field: string, value: string | number) => {
    const updatedTiers = [...collectionFormData.price_tiers];
    updatedTiers[index] = {
      ...updatedTiers[index],
      [field]: value
    };
    setCollectionFormData(prev => ({
      ...prev,
      price_tiers: updatedTiers
    }));
  };

  const addPriceTier = () => {
    setCollectionFormData(prev => ({
      ...prev,
      price_tiers: [
        ...prev.price_tiers,
        { name: '', amount: 0, description: '' }
      ]
    }));
  };

  const removePriceTier = (index: number) => {
    const updatedTiers = [...collectionFormData.price_tiers];
    updatedTiers.splice(index, 1);
    setCollectionFormData(prev => ({
      ...prev,
      price_tiers: updatedTiers
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      await updateCollection(id, {
        title: collectionFormData.title,
        description: collectionFormData.description,
        deadline: collectionFormData.deadline,
        max_participants: collectionFormData.numberOfContributors ? parseInt(collectionFormData.numberOfContributors) : null,
        status: collectionFormData.stopCollection ? "closed" : "active",
        price_tiers: collectionFormData.price_tiers
      });

      toast.success('Collection updated successfully!');
      setOpenCollectionModal(false);
      // Refresh the collection data
      fetchCollectionById(id);
    } catch (error: any) {
      console.error('Error updating collection:', error);
      toast.error(error.message || 'Failed to update collection');
    }
  };




  // 2. Check if any contributor has a unique code
  const hasUniqueCode = filteredContributors.some(
    c => c.contributor_unique_code
  );

  if (!currentCollection) {
    return (
      <div className="py-10 text-center">
        <h2 className="text-2xl font-bold text-gray-700 mb-4">Collection Not Found</h2>
        <p className="text-gray-600 mb-6">The collection you're looking for doesn't exist or you may not have permission to view it.</p>
        <Button onClick={() => navigate('/dashboard/collections')} className="bg-kolekto hover:bg-kolekto/90">
          Go to Collections
        </Button>
      </div>
    );
  }

  console.log(currentCollection)



  return (
    <div className="space-y-6 relative">
      {/* Modal component - always in the DOM but conditionally shown */}
      {openCollectionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl relative border border-gray-200 dark:border-gray-700 transform transition-all scale-100 animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
                Edit Your Collection
              </h2>
              <button
                onClick={() => setOpenCollectionModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
              <div className="space-y-1">
                <Label htmlFor="title">Collection Title</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Contribution Title"
                  name="title"
                  value={collectionFormData.title}
                  onChange={handleCollectionChange}
                  className="w-full"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Short description"
                  name="description"
                  value={collectionFormData.description}
                  onChange={handleCollectionChange}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  name="deadline"
                  value={collectionFormData.deadline}
                  onChange={handleCollectionChange}
                  className="w-full"
                />
              </div>

              {/* <div className="space-y-1">
                <Label htmlFor="numberOfContributors">Maximum Number of Contributors</Label>
                <Input
                  id="numberOfContributors"
                  type="number"
                  placeholder="e.g. 50"
                  name="numberOfContributors"
                  value={collectionFormData.numberOfContributors}
                  onChange={handleCollectionChange}
                  className="w-full"
                  min="1"
                />
              </div> */}

              {/* Price Tiers Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Price Tiers</Label>
                  <Button
                    type="button"
                    onClick={addPriceTier}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Tier
                  </Button>
                </div>

                {collectionFormData.price_tiers.map((tier, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                    <button
                      type="button"
                      onClick={() => removePriceTier(index)}
                      className="absolute top-3 right-3 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="space-y-1">
                      <Label htmlFor={`tier-name-${index}`}>Tier Name</Label>
                      <Input
                        id={`tier-name-${index}`}
                        type="text"
                        placeholder="e.g., Basic, Premium, VIP"
                        value={tier.name}
                        onChange={(e) => handlePriceTierChange(index, 'name', e.target.value)}
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`tier-amount-${index}`}>Amount (₦)</Label>
                      <Input
                        id={`tier-amount-${index}`}
                        type="number"
                        placeholder="e.g., 5000"
                        value={tier.price}
                        onChange={(e) => handlePriceTierChange(index, 'amount', parseInt(e.target.value) || 0)}
                        className="w-full"
                        min="0"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`tier-description-${index}`}>Description</Label>
                      <Textarea
                        id={`tier-description-${index}`}
                        placeholder="What does this tier include?"
                        value={tier.description}
                        onChange={(e) => handlePriceTierChange(index, 'description', e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}

                {collectionFormData.price_tiers.length === 0 && (
                  <div className="text-center py-4 text-gray-500 border rounded-lg">
                    No price tiers added yet. Click "Add Tier" to create one.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Label
                  htmlFor="stopCollection"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Stop Collection
                </Label>

                <button
                  type="button"
                  onClick={() =>
                    setCollectionFormData((prev) => ({
                      ...prev,
                      stopCollection: !prev.stopCollection,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${collectionFormData.stopCollection
                    ? "bg-green-900"
                    : "bg-gray-300 dark:bg-gray-600"
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${collectionFormData.stopCollection ? "translate-x-6" : "translate-x-1"
                      }`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900 pb-2">
                <button
                  type="button"
                  onClick={() => setOpenCollectionModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-green-900 text-white font-medium hover:bg-green-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{currentCollection.title}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs flex items-center ${getDeadlineStatusColor()}`}>
              {getDeadlineStatusIcon()}
              {getDeadlineStatus()}
            </span>
          </div>
          {currentCollection.description && (
            <p className="text-gray-600 mt-1">{currentCollection.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleShare}
            className="bg-kolekto hover:bg-kolekto/90 flex items-center"
          >
            <Share className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Share Collection</span>
            <span className="sm:hidden">Share</span>
          </Button>

          <Button
            onClick={handleWithdraw}
            variant="outline"
            className="border-kolekto text-kolekto hover:bg-kolekto/10 flex items-center"
            disabled={withdrawableAmount <= 0}
          >
            <Wallet className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Withdraw Funds</span>
            <span className="sm:hidden">Withdraw</span>
          </Button>
        </div>
      </div>

      {showQR && (
        <div className="mb-6">
          <QRCodeDisplay
            collectionId={id || ''}
            collectionTitle={currentCollection.title || 'Collection'}
            shareUrl={shareUrl}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Eye className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="contributors" className="flex items-center gap-1">
            <Users className="h-4 w-4 mr-1" />
            Contributors
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1">
            <BarChart className="h-4 w-4 mr-1" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Collection Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentCollection.type === 'tiered' && currentCollection.price_tiers?.length > 0
                    ? `₦${currentCollection.price_tiers[0].amount?.toLocaleString()}+`
                    : `₦${currentCollection.amount.toLocaleString()}`
                  }
                </div>
                {/* <p className="text-sm text-gray-500">
                  {currentCollection.type === 'tiered' ? 'Multiple tiers available' : 'Per contributor'}
                </p> */}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₦{totalCollected.toLocaleString()}</div>
                <p className="text-sm text-gray-500">From {contributorsCount} contributors</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deadline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentCollection.deadline ?
                    new Date(currentCollection.deadline).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    }) : 'No deadline set'}
                </div>
                <p className="text-sm text-gray-500">
                  {currentCollection.deadline && isActiveByDeadline
                    ? `${Math.ceil((new Date(currentCollection.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left`
                    : currentCollection.deadline ? 'Expired' : 'No deadline'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Collection Information</CardTitle>
                <CardDescription>Details about this collection and how to contribute</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-2">Collection Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Created On</span>
                        <span className="font-medium">
                          {new Date(currentCollection.created_at).toLocaleDateString('en-NG')}
                        </span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs flex items-center ${getDeadlineStatusColor()}`}>
                          {getDeadlineStatusIcon()}
                          {getDeadlineStatus()}
                        </span>
                      </div>
                      {currentCollection.max_participants && (
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-gray-600">Max Contributors</span>
                          <span className="font-medium">{currentCollection.max_participants}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Current Contributors</span>
                        <span className="font-medium">{contributorsCount}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Collection Type</span>
                        <span className="font-medium capitalize">{currentCollection.type}</span>
                      </div>
                      {currentCollection.type === 'tiered' && currentCollection.price_tiers?.length > 0 && (
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-gray-600">Price Tiers</span>
                          <span className="font-medium">{currentCollection.price_tiers.length}</span>
                        </div>
                      )}
                      <div className="flex justify-between pb-2">
                        <span className="text-gray-600">Unique Payment Link</span>
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-kolekto hover:underline truncate max-w-[200px]"
                        >
                          {shareUrl.split('/').pop()}
                        </a>
                      </div>

                      <div>
                        <Button
                          onClick={handleCollectionModal}
                          className="w-full flex items-center justify-center"
                        >
                          Edit Collection
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Quick Actions</h3>
                    <div className="space-y-3">
                      <Button
                        onClick={handleShare}
                        variant="outline"
                        className="w-full flex items-center justify-center"
                      >
                        <Share className="mr-2 h-4 w-4" />
                        Share Collection
                      </Button>
                      <Button
                        onClick={() => setShowQR(!showQR)}
                        variant="outline"
                        className="w-full flex items-center justify-center"
                      >
                        {showQR ? 'Hide QR Code' : 'Show QR Code'}
                      </Button>
                      <Button
                        onClick={exportToCSV}
                        variant="outline"
                        className="w-full flex items-center justify-center"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Contributors Data
                      </Button>
                      <Button
                        onClick={handleWithdraw}
                        className="w-full bg-kolekto hover:bg-kolekto/90 flex items-center justify-center"
                        disabled={withdrawableAmount <= 0}
                      >
                        <Wallet className="mr-2 h-4 w-4" />
                        Withdraw Funds
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contributors" className="mt-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Contributors & Input Data</CardTitle>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search contributors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1 border rounded w-full sm:w-auto"
                />

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1 border rounded"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>

                {/* Tier filter */}
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="px-3 py-1 border rounded"
                >
                  <option value="all">All Tiers</option>
                  {Array.from(
                    new Set(
                      filteredContributors.map(
                        (c) => (c.contributor_information || [])[0]?.Tier
                      )
                    )
                  )
                    .filter(Boolean)
                    .map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                </select>

                {/* Amount filter with min & max */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min ₦"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="px-3 py-1 border rounded w-24"
                  />
                  <span> - </span>
                  <input
                    type="number"
                    placeholder="Max ₦"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="px-3 py-1 border rounded w-24"
                  />
                </div>

                {/* Export button */}
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                  className="flex items-center whitespace-nowrap"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
              </div>

            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                {filteredContributors.length > 0 ? (
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        {staticFields.map((field) => (
                          <TableHead key={field}>{field}</TableHead>
                        ))}
                        {allDynamicFields.map((field) => (
                          <TableHead key={field}>{field}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((contributor) => (
                        <TableRow key={contributor.id}>
                          {staticFields.map((field) => (
                            <TableCell key={field}>
                              {contributor[field] || ""}
                            </TableCell>
                          ))}
                          {allDynamicFields.map((field) => (
                            <TableCell key={field}>
                              {(contributor.contributor_information || [])[0]?.[field] || ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>

                  </Table>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    {searchTerm ? 'No contributors match your search' : 'No contributors yet'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contribution Activity</CardTitle>
              <div className="text-right">
                <div className="text-sm text-gray-500">
                  Available for withdrawal
                </div>
                <div className="font-bold text-lg">
                  ₦{withdrawableAmount.toLocaleString()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-medium mb-4">Recent Contributions</h3>
              {filteredContributors.length > 0 ? (
                <div className="space-y-4">
                  {filteredContributors.map((contributor) => {
                    if (contributor.status != "paid") return;
                    return (
                      <div
                        key={contributor.id}
                        className="flex justify-between items-center border-b pb-2"
                      >
                        <div>
                          <div className="font-medium">
                            {contributor.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(
                              contributor.created_at
                            ).toLocaleDateString("en-NG")}
                          </div>
                        </div>
                        <div className="font-bold">
                          ₦{contributor.amount?.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-gray-500">
                  No contributions yet
                </div>
              )}

              <div className="mt-6">
                <Button
                  onClick={handleWithdraw}
                  className="w-full bg-kolekto hover:bg-kolekto/90"
                  disabled={withdrawableAmount <= 0}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Withdraw Funds
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Drawer open={isShareDrawerOpen} onOpenChange={setIsShareDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Share Collection</DrawerTitle>
            <DrawerDescription>
              Share this collection with contributors to collect contributions
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <QRCodeDisplay
              collectionId={id || ''}
              collectionTitle={currentCollection.title || 'Collection'}
              shareUrl={shareUrl}
            />
          </div>
          <DrawerFooter>
            <Button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `Contribute to ${currentCollection.title}`,
                    text: `Join me in contributing to ${currentCollection.title}`,
                    url: shareUrl,
                  }).catch(err => {
                    console.error('Error sharing:', err);
                  });
                } else {
                  // Fallback if Web Share API is not available
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Link copied to clipboard!');
                }
              }}
              className="w-full bg-kolekto hover:bg-kolekto/90"
            >
              <Share className="mr-2 h-4 w-4" />
              {navigator.share ? 'Share via apps' : 'Copy link'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {currentCollection && (
        <WithdrawFundsDialog
          open={isWithdrawDialogOpen}
          onOpenChange={setIsWithdrawDialogOpen}
          onComplete={onWithdrawComplete}
          availableBalance={currentCollection.wallets[0].available_balance || 0}
          collectionId={id || ''}
          collectionTitle={currentCollection?.title || ''}
        />
      )}
    </div>
  );
};

export default CollectionDetailsPage;