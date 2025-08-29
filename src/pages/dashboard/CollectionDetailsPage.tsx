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
import { BarChart, Download, Eye, Share, Wallet, Users, Clock, AlertCircle, CheckCircle, TimerOff, Loader2, Filter, X } from 'lucide-react';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import { toast } from 'sonner';
import { ChartContainer } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart as RechartsBarChart } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import CollectionManagementMenu from '@/components/collections/CollectionManagementMenu';
import EditCollectionDialog from '@/components/collections/EditCollectionDialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CollectionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showQR, setShowQR] = useState(false);
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();

  const { fetchCollectionById, currentCollection } = useCollectionStore();
  const { fetchContributions, contributions } = useContributionStore();
  const { createWithdrawal } = useWithdrawalStore();

  console.log(currentCollection, 'current coll');

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
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('share') === 'true') {
      setIsShareDrawerOpen(true);
    }
  }, [location]);

  const shareUrl = `${window.location.origin}/contribute/${id}`;

  const handleShare = () => {
    setIsShareDrawerOpen(true);
  };

  const handleEditCollection = () => {
    setIsEditDialogOpen(true);
  };

  const handleCollectionDeleted = () => {
    navigate('/dashboard/collections');
  };

  const handleEditSuccess = () => {
    // Refetch collection data after successful edit
    if (id) {
      fetchCollectionById(id);
    }
    toast.success('Collection updated successfully');
  };

  // Get available tiers from the collection
  const availableTiers = currentCollection?.price_tiers || [];

  // Function to get tier name from amount
  const getTierNameFromAmount = (amount: number) => {
    const tier = availableTiers.find(t => t.price === amount);
    return tier ? tier.name : `₦${amount}`;
  };

  // Function to handle tier filter changes
  const handleTierFilterChange = (tierName: string, checked: boolean) => {
    setSelectedTiers(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(tierName);
      } else {
        newSet.delete(tierName);
      }
      return newSet;
    });
  };

  // Function to apply filters to contributions
  const applyFilters = (data: any[]) => {
    let filteredData = data;

    // Apply search term filter
    if (searchTerm) {
      filteredData = filteredData.filter(contribution => {
        const matchesSearch =
          (contribution.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contribution.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contribution.contributor_unique_code?.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSearch;
      });
    }

    // Apply tier filter
    if (selectedTiers.size > 0) {
      filteredData = filteredData.filter(contribution => {
        const tierName = getTierNameFromAmount(contribution.amount);
        return selectedTiers.has(tierName);
      });
    }

    // Apply field filters
    if (Object.keys(filters).length > 0) {
      filteredData = filteredData.filter(contribution => {
        for (const [field, value] of Object.entries(filters)) {
          if (value) {
            const fieldValue = (contribution.contributor_information || [])[0]?.[field] || '';
            if (!fieldValue.toLowerCase().includes(value.toLowerCase())) {
              return false;
            }
          }
        }
        return true;
      });
    }

    return filteredData;
  };

  const exportToCSV = () => {
    // Apply filters to get the data to export
    const paidContributions = (contributions || []).filter(c => c.status === "paid");
    const filteredData = applyFilters(paidContributions);

    if (filteredData.length === 0) {
      toast.info("No paid contributors data to export");
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
    ).filter(field => field !== "TierAmount");

    // 2. Check if any contributor has a unique code
    const hasUniqueCode = filteredData.some(
      c => c.contributor_unique_code
    );

    // 3. Define headers for CSV (include Tier if it's a tiered collection)
    const headers = [
      ...allDynamicFields,
      ...(currentCollection?.type === 'tiered' ? ['Tier'] : []),
      ...(hasUniqueCode ? ['Unique Code'] : []),
    ];

    let csvContent = headers.join(',') + '\n';

    filteredData.forEach((contribution) => {
      const row = [
        ...allDynamicFields.map(field =>
          (contribution.contributor_information || [])[0]?.[field] || ''
        ),
        ...(currentCollection?.type === 'tiered' ? [getTierNameFromAmount(contribution.amount)] : []),
        ...(hasUniqueCode ? [contribution.contributor_unique_code || ''] : []),
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

    toast.success('Contributor data exported successfully!');
  };

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

  // Only show paid contributors
  const paidContributions = (contributions || []).filter(c => c.status === "paid") || [];

  // Apply filters to get the final list of contributors to display
  const filteredContributors = applyFilters(paidContributions);

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

  const withdrawableAmount = currentCollection?.wallets[0].available_balance || 0;

  // Function to clear all filters
  const clearAllFilters = () => {
    setFilters({});
    setSearchTerm('');
    setSelectedTiers(new Set());
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || Object.keys(filters).length > 0 || selectedTiers.size > 0;

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

  // 1. Collect all unique dynamic fields from contributor_information
  const allDynamicFields = Array.from(
    new Set(
      paidContributions.flatMap(contributor => {
        return (contributor.contributor_information || []).flatMap(info =>
          Object.keys(info)
        )
      })
    )
  ).filter(field => field !== "TierAmount");

  console.log(allDynamicFields);
  console.log(paidContributions)

  // 2. Check if any contributor has a unique code
  const hasUniqueCode = paidContributions.some(
    c => c.contributor_unique_code
  );

  // Function to handle filter changes
  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => {
      if (value === '') {
        const newFilters = { ...prev };
        delete newFilters[field];
        return newFilters;
      }
      return { ...prev, [field]: value };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{currentCollection.title}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs flex items-center ${getDeadlineStatusColor()}`}>
              {getDeadlineStatusIcon()}
              {getDeadlineStatus()}
            </span>
            <CollectionManagementMenu
              collectionId={id as string}
              onEditClick={handleEditCollection}
              currentStatus={currentCollection.status || 'active'}
              onDeleteSuccess={handleCollectionDeleted}
            />
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

            {
              currentCollection.type === "fixed" && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Collection Amount</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₦{currentCollection.amount.toLocaleString()}</div>
                    <p className="text-sm text-gray-500">Per contributor</p>
                  </CardContent>
                </Card>
              )

            }

            {currentCollection.type === "tiered" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Collection Tier(s)</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentCollection.price_tiers.map((tier, i) => {

                    return (<div key={i} >
                      <div className=' text-2xl font-bold flex justify-between items-center mb-2'>
                        <div>{tier.name}</div>
                        <div className="text-2xl font-bold">₦{tier.price}</div>
                      </div>

                    </div>)
                  })}

                  <p className="text-sm text-gray-500">Per contributor</p>
                </CardContent>
              </Card>

            )}


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
              <div className="flex gap-2 w-full sm:w-auto">
                <Input
                  type="text"
                  placeholder="Search contributors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1 border rounded w-full sm:w-auto"
                />

                {/* Tier Filter Dropdown - Only show for tiered collections */}
                {currentCollection?.type === 'tiered' && availableTiers.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center whitespace-nowrap">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter by Tier
                        {selectedTiers.size > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {selectedTiers.size}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Filter by Tier</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableTiers.map((tier) => (
                        <DropdownMenuCheckboxItem
                          key={tier.name}
                          checked={selectedTiers.has(tier.name)}
                          onCheckedChange={(checked) => handleTierFilterChange(tier.name, checked)}
                        >
                          {tier.name} - ₦{tier.price.toLocaleString()}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={false}
                        onCheckedChange={() => setSelectedTiers(new Set())}
                        className="text-red-600"
                      >
                        Clear All
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {hasActiveFilters && (
                  <Button
                    onClick={clearAllFilters}
                    variant="outline"
                    size="sm"
                    className="flex items-center whitespace-nowrap text-red-600 hover:text-red-700"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear Filters
                  </Button>
                )}

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
                    <TableHeader className='overflow-x-auto'>
                      <TableRow>
                        {allDynamicFields.map(field => (
                          <TableHead key={field} className="lg:table-cell">{field}</TableHead>
                        ))}
                        {currentCollection?.type === 'tiered' && (
                          <TableHead className="lg:table-cell">Tier</TableHead>
                        )}
                        {hasUniqueCode && (
                          <TableHead className="lg:table-cell">Unique Code</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContributors.map(contributor => (
                        <TableRow key={contributor.id}>
                          {allDynamicFields.map(field => (
                            <TableCell key={field} className="lg:table-cell">
                              {(contributor.contributor_information || [])[0]?.[field] || ''}
                            </TableCell>
                          ))}
                          {currentCollection?.type === 'tiered' && (
                            <TableCell className="lg:table-cell">
                              <Badge variant="outline">
                                {getTierNameFromAmount(contributor.amount)}
                              </Badge>
                            </TableCell>
                          )}
                          {hasUniqueCode && (
                            <TableCell className="lg:table-cell">
                              {contributor.contributor_unique_code || ''}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    {searchTerm || Object.keys(filters).length > 0 || selectedTiers.size > 0
                      ? 'No contributors match your filters'
                      : 'No contributors yet'}
                  </div>
                )}
              </div>

              {/* Filter Summary */}
              {hasActiveFilters && (
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Showing {filteredContributors.length} of {paidContributions.length} contributors
                    </span>
                    <div className="flex gap-2 items-center">
                      {selectedTiers.size > 0 && (
                        <div className="flex gap-1">
                          {Array.from(selectedTiers).map(tier => (
                            <Badge key={tier} variant="secondary" className="text-xs">
                              {tier}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  {filteredContributors.slice(0, 5).map((contributor) => {
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
                        <div className="text-right">
                          <div className="font-bold">
                            ₦{contributor.amount?.toLocaleString()}
                          </div>
                          {currentCollection?.type === 'tiered' && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {getTierNameFromAmount(contributor.amount)}
                            </Badge>
                          )}
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

      {
        currentCollection && (
          <WithdrawFundsDialog
            open={isWithdrawDialogOpen}
            onOpenChange={setIsWithdrawDialogOpen}
            onComplete={onWithdrawComplete}
            availableBalance={currentCollection.wallets[0].available_balance || 0}
            collectionId={id || ''}
            collectionTitle={currentCollection?.title || ''}
          />
        )
      }

      <EditCollectionDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        collectionId={id || ''}
        initialData={{
          title: currentCollection.title,
          description: currentCollection.description || '',
          deadline: currentCollection.deadline,
          type: currentCollection.type,
          price_tiers: currentCollection.price_tiers,
          code_prefix: currentCollection.code_prefix || '',
          contributions_fields: currentCollection.contributions_fields || [],
        }}
        onSuccess={handleEditSuccess}
      />
    </div >
  );
};

export default CollectionDetailsPage;