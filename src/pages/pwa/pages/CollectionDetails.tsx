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
import {
    BarChart,
    Download,
    Eye,
    Share,
    Wallet,
    Users,
    Clock,
    AlertCircle,
    CheckCircle,
    TimerOff,
    Filter,
    X
} from 'lucide-react';
import { WithdrawFundsDialog } from '@/components/withdrawals/WithdrawFundsDialog';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import CollectionManagementMenu from '@/components/collections/CollectionManagementMenu';
import EditCollectionDialog from '@/components/collections/EditCollectionDialog';
import FundraisingShareDialog from '@/components/collections/FundraisingShareDialog';
import { CollectionDetailsSkeleton } from '@/components/ui/page-skeletons';
import {
    getCollectionContributorFields,
    getContributorFieldValue,
} from '@/utils/contributions';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Status = "active" | "paused" | "expired" | "completed" | "closed" | "deleted";

interface StatusRule {
    name: Status;
    priority: number;
    check: (ctx: {
        statusFlag?: Status;
        totalRaised: number;
        targetAmount: number;
        deadlineDate: Date;
        now: Date;
    }) => boolean;
}

const statusRules: StatusRule[] = [
    { name: "deleted", priority: 100, check: ({ statusFlag }) => statusFlag === "deleted" },
    { name: "closed", priority: 90, check: ({ statusFlag }) => statusFlag === "closed" },
    { name: "paused", priority: 80, check: ({ statusFlag }) => statusFlag === "paused" },
    { name: "completed", priority: 70, check: ({ totalRaised, targetAmount }) => totalRaised >= targetAmount },
    { name: "expired", priority: 60, check: ({ deadlineDate, now }) => deadlineDate <= now },
    { name: "active", priority: 10, check: () => true },
];

function computeStatus(ctx: {
    statusFlag?: Status;
    totalRaised: number;
    targetAmount: number;
    deadlineDate: Date;
    now?: Date;
}): Status {
    const now = ctx.now ?? new Date();
    return statusRules
        .sort((a, b) => b.priority - a.priority)
        .find((rule) => rule.check({ ...ctx, now }))!.name;
}

const statusColors: Record<Status, string> = {
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    expired: "bg-red-100 text-red-800",
    completed: "bg-blue-100 text-blue-800",
    closed: "bg-gray-200 text-gray-800",
    deleted: "bg-gray-400 text-gray-900",
};

const statusIcons: Record<Status, React.ReactNode> = {
    active: <CheckCircle className="h-4 w-4 mr-1" />,
    paused: <AlertCircle className="h-4 w-4 mr-1" />,
    expired: <TimerOff className="h-4 w-4 mr-1" />,
    completed: <CheckCircle className="h-4 w-4 mr-1" />,
    closed: <AlertCircle className="h-4 w-4 mr-1" />,
    deleted: <AlertCircle className="h-4 w-4 mr-1" />,
};

const PwaCollectionDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [showQR, setShowQR] = useState(false);
    const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false);
    const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isFlierOpen, setIsFlierOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set());
    const { user } = useAuthStore();

    const { fetchCollectionById, currentCollection, fetchCollections, isLoading } = useCollectionStore();
    const { fetchContributions, contributions } = useContributionStore();
    const { createWithdrawal } = useWithdrawalStore();

    useEffect(() => {
        if (id) {
            fetchCollections().then(() => {
                fetchCollectionById(id).catch((err) => {
                    console.error('Error fetching collection:', err);
                    toast.error('Failed to load collection details');
                });
            }).catch((err) => {
                console.error('Error fetching collections:', err);
                toast.error('Failed to load collections');
            });

            fetchContributions(id).catch((err) => {
                console.error('Error fetching contributions:', err);
                toast.error('Failed to load contributions');
            });
        }
    }, [id, fetchCollections, fetchCollectionById, fetchContributions]);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('share') === 'true') {
            setIsShareDrawerOpen(true);
        }
    }, [location]);

    const shareUrl = `${window.location.origin}/contribute/${currentCollection?.slug}`;

    const handleShare = () => {
        setIsShareDrawerOpen(true);
    };

    const handleEditCollection = () => {
        setIsEditDialogOpen(true);
    };

    const handleCollectionDeleted = () => {
        navigate('/collections');
    };

    const handleEditSuccess = () => {
        if (id) {
            fetchCollectionById(id);
        }
        toast.success('Collection updated successfully');
    };

    const colType: string = (currentCollection as any)?.collection_type || currentCollection?.type || 'fixed';
    const availableTiers = currentCollection?.price_tiers || (currentCollection as any)?.pricing_tiers || [];
    const visibleContributorFields = getCollectionContributorFields(currentCollection as any);

    const getTierNameFromAmount = (amount: number) => {
        const tier = availableTiers.find(t => t.price === amount);
        return tier ? tier.name : `₦${amount}`;
    };

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

    const applyFilters = (data: any[]) => {
        let filteredData = data;

        if (searchTerm) {
            filteredData = filteredData.filter(contribution => {
                const matchesSearch =
                    (contribution.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        contribution.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        contribution.contributor_unique_code?.toLowerCase().includes(searchTerm.toLowerCase()));
                return matchesSearch;
            });
        }

        if (selectedTiers.size > 0) {
            filteredData = filteredData.filter(contribution => {
                const tierName = getTierNameFromAmount(contribution.amount);
                return selectedTiers.has(tierName);
            });
        }

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

    const exportToPDF = async () => {
        const paidContributions = (contributions || []).filter(c => c.status === "paid");
        const filteredData = applyFilters(paidContributions);

        if (filteredData.length === 0) {
            toast.info("No paid contributors data to export");
            return;
        }

        const exportFields = visibleContributorFields;
        const hasUniqueCode = filteredData.some((c: any) => c.contributor_unique_code);
        const tierColumnVisible = colType === 'tiered' || colType === 'ticket';
        if (exportFields.length === 0 && !tierColumnVisible && !hasUniqueCode) {
            toast.info('No host-defined contributor fields to export for this collection');
            return;
        }

        const headers = [
            ...exportFields.map((field: any) => field.name),
            ...(tierColumnVisible ? ['Tier'] : []),
            ...(hasUniqueCode ? ['Unique Code'] : []),
        ];

        const rows = filteredData.map((contribution: any) => [
            ...exportFields.map((field: any) =>
                getContributorFieldValue(contribution, field) || ''
            ),
            ...(tierColumnVisible ? [getTierNameFromAmount(contribution.amount)] : []),
            ...(hasUniqueCode ? [contribution.contributor_unique_code || ''] : []),
        ]);

        const exportDate = new Date().toLocaleDateString('en-NG', {
            day: 'numeric', month: 'long', year: 'numeric',
        });
        const totalAmount = filteredData.reduce((s: number, c: any) => s + (c.amount || 0), 0);

        const tableRows = rows.map((row: string[]) =>
            `<tr>${row.map((cell: string) => `<td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:12px;color:#374151;">${cell}</td>`).join('')}</tr>`
        ).join('');

        const html = `
            <div style="font-family:'Inter',Arial,sans-serif;padding:32px;background:#fff;min-height:100vh;">
                <!-- Header brand bar -->
                <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;border-bottom:3px solid #16a34a;margin-bottom:24px;">
                    <div>
                        <div style="font-size:26px;font-weight:900;color:#16a34a;letter-spacing:-0.5px;">Kolekto</div>
                        <div style="font-size:11px;color:#6B7280;margin-top:2px;">Contributors Export Report</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px;color:#6B7280;">Generated on</div>
                        <div style="font-size:12px;font-weight:600;color:#111827;">${exportDate}</div>
                    </div>
                </div>

                <!-- Collection info -->
                <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                    <div style="font-size:18px;font-weight:800;color:#14532D;margin-bottom:4px;">${currentCollection?.title || 'Collection'}</div>
                    <div style="display:flex;gap:24px;margin-top:8px;">
                        <div>
                            <span style="font-size:11px;color:#6B7280;display:block;">Total Contributors</span>
                            <span style="font-size:15px;font-weight:700;color:#166534;">${filteredData.length}</span>
                        </div>
                        <div>
                            <span style="font-size:11px;color:#6B7280;display:block;">Total Collected</span>
                            <span style="font-size:15px;font-weight:700;color:#166534;">₦${totalAmount.toLocaleString('en-NG')}</span>
                        </div>
                    </div>
                </div>

                <!-- Table -->
                <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
                    <thead>
                        <tr style="background:#16a34a;">
                            ${headers.map((h: string) => `<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <!-- Footer -->
                <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;color:#9CA3AF;">Powered by Kolekto · kolekto.com.ng</span>
                    <span style="font-size:11px;color:#9CA3AF;">Confidential — For authorized use only</span>
                </div>
            </div>
        `;

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.createElement('div');
            element.innerHTML = html;
            document.body.appendChild(element);

            await html2pdf().set({
                margin: 0,
                filename: `${currentCollection?.title || 'collection'}-contributors.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            }).from(element).save();

            document.body.removeChild(element);
            toast.success('PDF exported successfully!');
        } catch (err) {
            console.error('PDF export error:', err);
            toast.error('Failed to export PDF');
        }
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

    const isActiveByDeadline = currentCollection?.deadline
        ? new Date(currentCollection.deadline) > new Date()
        : false;

    const clearAllFilters = () => {
        setFilters({});
        setSearchTerm('');
        setSelectedTiers(new Set());
    };

    const hasActiveFilters = searchTerm || Object.keys(filters).length > 0 || selectedTiers.size > 0;

    if (isLoading) {
        return <CollectionDetailsSkeleton />;
    }

    if (!currentCollection) {
        return (
            <div className="py-10 text-center">
                <h2 className="text-2xl font-bold text-gray-700 mb-4">Collection Not Found</h2>
                <p className="text-gray-600 mb-6">The collection you're looking for doesn't exist or you may not have permission to view it.</p>
                <Button onClick={() => navigate('/collections')} className="bg-emerald-600 hover:bg-emerald-700">
                    Go to Collections
                </Button>
            </div>
        );
    }

    const paidContributions = (contributions || []).filter(c => c.status === "paid") || [];
    const filteredContributors = applyFilters(paidContributions);

    const hasUniqueCode = paidContributions.some(c => c.contributor_unique_code);
    const tierColumnVisible = colType === 'tiered' || colType === 'ticket';
    const contributorColumnCount =
        visibleContributorFields.length +
        (tierColumnVisible ? 1 : 0) +
        (hasUniqueCode ? 1 : 0);

    const totalCollected = contributions?.reduce((sum, contribution) => {
        return contribution.status === 'paid' ? sum + (contribution.amount || 0) : sum;
    }, 0) || 0;

    const contributorsCount = contributions?.filter((c) => c.status === 'paid').length || 0;
    const withdrawableAmount = currentCollection?.wallets?.[0]?.available_balance || 0;

    const totalRaised = paidContributions.reduce((sum, c) => sum + (c.amount || 0), 0);
    const deadlineDate = currentCollection?.deadline ? new Date(currentCollection.deadline) : new Date();
    const targetAmount = (currentCollection?.amount || 0) * (currentCollection?.max_participants || 0);

    const computedStatus: Status = computeStatus({
        statusFlag: currentCollection?.status as Status,
        totalRaised,
        targetAmount,
        deadlineDate,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold">{currentCollection.title}</h1>
                        <span className={`px-2 py-0.5 rounded-full text-xs flex items-center ${statusColors[computedStatus]}`}>
                            {statusIcons[computedStatus]}
                            {computedStatus}
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
                        className="bg-emerald-600 hover:bg-emerald-700 flex items-center"
                    >
                        <Share className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Share</span>
                    </Button>
                    <Button
                        onClick={handleWithdraw}
                        variant="outline"
                        className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 flex items-center"
                        disabled={withdrawableAmount <= 0}
                    >
                        <Wallet className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Withdraw</span>
                    </Button>
                    {colType === 'fundraising' && (
                        <Button
                            variant="outline"
                            onClick={() => setIsFlierOpen(true)}
                            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 flex items-center"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Campaign Flyer</span>
                        </Button>
                    )}
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
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="contributors">Contributors</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {colType === "fixed" && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Amount</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">₦{currentCollection.amount.toLocaleString()}</div>
                                    <p className="text-sm text-gray-500">Per contributor</p>
                                </CardContent>
                            </Card>
                        )}

                        {colType === "tiered" && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Tiers</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {currentCollection.price_tiers.map((tier, i) => (
                                        <div key={i} className="flex justify-between items-center">
                                            <span className="text-sm">{tier.name}</span>
                                            <span className="font-semibold">₦{tier.price.toLocaleString()}</span>
                                        </div>
                                    ))}
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
                                    {currentCollection.deadline
                                        ? new Date(currentCollection.deadline).toLocaleDateString('en-NG', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })
                                        : 'No deadline'}
                                </div>
                                <p className="text-sm text-gray-500">
                                    {currentCollection.deadline && isActiveByDeadline
                                        ? `${Math.ceil((new Date(currentCollection.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left`
                                        : 'Expired'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Status</p>
                                    <Badge className={statusColors[computedStatus]}>{computedStatus}</Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Contributors</p>
                                    <p className="font-semibold">{contributorsCount}</p>
                                </div>
                            </div>
                            <Button
                                onClick={exportToPDF}
                                variant="outline"
                                className="w-full"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Export PDF
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="contributors" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                                <CardTitle>Contributors</CardTitle>
                                <div className="flex gap-2 flex-wrap">
                                    <Button
                                        onClick={exportToPDF}
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <Download className="mr-1.5 h-3.5 w-3.5" />
                                        Export PDF
                                    </Button>
                                    <Input
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full sm:w-48"
                                    />
                                    {colType === 'tiered' && availableTiers.length > 0 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <Filter className="mr-2 h-4 w-4" />
                                                    Tier
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                {availableTiers.map((tier) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={tier.name}
                                                        checked={selectedTiers.has(tier.name)}
                                                        onCheckedChange={(checked) => handleTierFilterChange(tier.name, checked)}
                                                    >
                                                        {tier.name}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                    {hasActiveFilters && (
                                        <Button
                                            onClick={clearAllFilters}
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredContributors.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {visibleContributorFields.map((field: any) => (
                                                    <TableHead key={field.id || field.name}>{field.name}</TableHead>
                                                ))}
                                                {tierColumnVisible && (
                                                    <TableHead>Tier</TableHead>
                                                )}
                                                {hasUniqueCode && <TableHead>Unique Code</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {contributorColumnCount === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={1} className="text-center py-8 text-gray-500">
                                                        No host-defined contributor fields were requested for this collection
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredContributors.map(contributor => (
                                                <TableRow key={contributor.id}>
                                                    {visibleContributorFields.map((field: any) => (
                                                        <TableCell key={field.id || field.name}>
                                                            {getContributorFieldValue(contributor, field) || '-'}
                                                        </TableCell>
                                                    ))}
                                                    {tierColumnVisible && (
                                                        <TableCell>
                                                            <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                                                                {getTierNameFromAmount(contributor.amount)}
                                                            </span>
                                                        </TableCell>
                                                    )}
                                                    {hasUniqueCode && (
                                                        <TableCell>
                                                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                                                {contributor.contributor_unique_code || '—'}
                                                            </span>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-4">No contributors</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activity" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {filteredContributors.length > 0 ? (
                                <div className="space-y-4">
                                    {filteredContributors.slice(0, 5).map((contributor) => (
                                        <div key={contributor.id} className="flex justify-between items-center border-b pb-3">
                                            <div>
                                                <p className="font-medium">{contributor.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {new Date(contributor.created_at).toLocaleDateString('en-NG')}
                                                </p>
                                            </div>
                                            <p className="font-bold">₦{contributor.amount?.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-4">No activity</p>
                            )}
                            <Button
                                onClick={handleWithdraw}
                                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
                                disabled={withdrawableAmount <= 0}
                            >
                                Withdraw ₦{withdrawableAmount.toLocaleString()}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Drawer open={isShareDrawerOpen} onOpenChange={setIsShareDrawerOpen}>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Share Collection</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 py-4">
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
                                        title: currentCollection.title,
                                        url: shareUrl,
                                    });
                                } else {
                                    navigator.clipboard.writeText(shareUrl);
                                    toast.success('Link copied!');
                                }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            Share
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
                    availableBalance={withdrawableAmount}
                    collectionId={id || ''}
                    collectionTitle={currentCollection.title || ''}
                />
            )}

            <EditCollectionDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                collectionId={id || ''}
                initialData={{
                    title: currentCollection.title,
                    description: currentCollection.description || '',
                    amount: Number(currentCollection.amount || 0),
                    deadline: currentCollection.deadline,
                    type: colType,
                    max_contributions: currentCollection.max_contributions,
                    price_tiers: currentCollection.price_tiers,
                    code_prefix: currentCollection.code_prefix || '',
                    contributions_fields: currentCollection.contributions_fields || [],
                    total_contributions: currentCollection.total_contributions || 0,
                    collection_type: currentCollection.collection_type || currentCollection.type || colType,
                }}
                onSuccess={handleEditSuccess}
            />

            {colType === 'fundraising' && (
                <FundraisingShareDialog
                    open={isFlierOpen}
                    onOpenChange={setIsFlierOpen}
                    collection={currentCollection as any}
                    totalRaised={totalCollected}
                    donorCount={contributorsCount}
                    shareUrl={shareUrl}
                />
            )}
        </div>
    );
};

export default PwaCollectionDetails;
