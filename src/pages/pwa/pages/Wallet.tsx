import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useCollectionStore, useWithdrawalStore } from '@/store';
import { Wallet, TrendingUp, Clock, AlertCircle, CheckCircle, XCircle, Info, Search, X } from 'lucide-react';

const formatCurrency = (amount: number) =>
    '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 0 });

interface WalletOverview {
    availableBalance: number;
    bookBalance: number;
    ledgerBalance: number;
    pendingDebits: number;
    pendingCredits: number;
    totalGrossEarnings: number;
    totalNetEarnings: number;
    totalWithdrawn: number;
}

interface CollectionEarning {
    id: string;
    name: string;
    amount: number;
    participants: number;
    totalCollected: number;
    grossEarnings: number;
    netEarnings: number;
    balance: number;
    withdrawable: number;
    pendingWithdrawals: number;
}

interface RecentTransaction {
    id: string;
    collection: string;
    amount: number;
    date: string;
    status: 'pending' | 'completed' | 'failed';
    description: string;
}

const PwaWallet: React.FC = () => {
    const [walletOverview, setWalletOverview] = useState<WalletOverview | null>(null);
    const [collectionEarnings, setCollectionEarnings] = useState<CollectionEarning[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [collectionSearch, setCollectionSearch] = useState('');
    const [transactionSearch, setTransactionSearch] = useState('');
    const [transactionStatusFilter, setTransactionStatusFilter] = useState<string>('all');

    const { collections } = useCollectionStore();
    const { withdrawals } = useWithdrawalStore();

    useEffect(() => {
        // Calculate wallet overview
        let totalAvailable = 0;
        let totalBook = 0;
        let totalLedger = 0;
        let totalGross = 0;
        let totalNet = 0;
        let totalWithdrawn = 0;
        let pendingDebits = 0;
        let pendingCredits = 0;

        // Sort collections by created_at descending (newest first)
        const sortedCollections = [...collections].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });

        // Map sorted collections to CollectionEarning format
        const earnings = sortedCollections.map((col) => {
            const wallet = Array.isArray(col.wallets) && col.wallets.length > 0 ? col.wallets[0] : {};

            const available = wallet.available_balance || 0;
            const gross = wallet.gross_payment || 0;
            const net = wallet.net_payment || 0;
            const ledger = wallet.ledger_balance || 0;

            totalAvailable += available;
            totalGross += gross;
            totalNet += net;
            totalLedger += ledger;
            pendingDebits += wallet.pending_withdrawals ?? 0;

            return {
                id: col.id,
                name: col.title || 'Untitled Collection',
                amount: col.amount || 0,
                participants: col.total_contributions || 0,
                totalCollected: col.amount || 0,
                grossEarnings: gross,
                netEarnings: net,
                balance: ledger,
                withdrawable: available,
                pendingWithdrawals: wallet.pending_withdrawals ?? 0,
            };
        });

        setCollectionEarnings(earnings);

        // Calculate total withdrawn from withdrawals
        const withdrawalsArray = Array.isArray(withdrawals) ? withdrawals : withdrawals ? [withdrawals] : [];
        const completedWithdrawals = withdrawalsArray.filter(w => w.status === 'completed');
        totalWithdrawn = completedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

        setWalletOverview({
            availableBalance: totalAvailable,
            bookBalance: totalAvailable + pendingDebits,
            ledgerBalance: totalLedger,
            pendingDebits,
            pendingCredits,
            totalGrossEarnings: totalGross,
            totalNetEarnings: totalNet,
            totalWithdrawn,
        });

        // Sort withdrawals by created_at descending (newest first)
        const sortedWithdrawals = [...withdrawalsArray].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });

        const withdrawalTransactions = sortedWithdrawals.map((w) => ({
            id: w.id,
            collection: w.collections ? w.collections.title : 'Unknown Collection',
            amount: w.amount,
            date: w.created_at ? new Date(w.created_at).toLocaleDateString('en-NG') : '',
            status: w.status || 'pending',
            description: w.destination_account
                ? `Withdrawal to ${w.destination_account.accountName} (${w.destination_account.accountNumber})`
                : 'Withdrawal',
        }));

        setRecentTransactions(withdrawalTransactions);
    }, [collections, withdrawals]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-600" />;
            default:
                return <AlertCircle className="h-4 w-4 text-gray-600" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
            case 'failed':
                return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
        }
    };

    // Filter collections based on search
    const filteredCollections = collectionEarnings.filter((earning) =>
        earning.name.toLowerCase().includes(collectionSearch.toLowerCase())
    );

    // Filter transactions based on search and status
    const filteredTransactions = recentTransactions.filter((transaction) => {
        const matchesSearch = 
            transaction.collection.toLowerCase().includes(transactionSearch.toLowerCase()) ||
            transaction.description.toLowerCase().includes(transactionSearch.toLowerCase()) ||
            formatCurrency(transaction.amount).includes(transactionSearch);
        
        const matchesStatus = transactionStatusFilter === 'all' || transaction.status === transactionStatusFilter;
        
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Wallet className="h-6 w-6" />
                    Wallet
                </h1>
                <p className="text-gray-600 mt-1">Manage and track your funds effectively</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                    {/* Wallet Summary Cards */}
                    {walletOverview && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Available Balance */}
                            <Card className="border-l-4 border-l-emerald-500">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-gray-600">
                                            Available Balance
                                        </CardTitle>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>The total amount you can withdraw right now</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-emerald-600">
                                        {formatCurrency(walletOverview.availableBalance)}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Book Balance */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-gray-600">
                                            Book Balance
                                        </CardTitle>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>Expected balance after pending transactions clear</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-gray-700">
                                        {formatCurrency(walletOverview.bookBalance)}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Ledger Balance */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-gray-600">
                                            Ledger Balance
                                        </CardTitle>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>Total confirmed funds in your wallet</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-gray-700">
                                        {formatCurrency(walletOverview.ledgerBalance)}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Pending Debits */}
                            <Card className="border-l-4 border-l-yellow-500">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-gray-600">
                                            Pending Debits
                                        </CardTitle>
                                        <Clock className="h-4 w-4 text-yellow-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-yellow-600">
                                        {formatCurrency(walletOverview.pendingDebits)}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Pending Credits */}
                            <Card className="border-l-4 border-l-blue-500">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-gray-600">
                                            Pending Credits
                                        </CardTitle>
                                        <Clock className="h-4 w-4 text-blue-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {formatCurrency(walletOverview.pendingCredits)}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Total Gross Earnings */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-gray-600">
                                            Gross Earnings
                                        </CardTitle>
                                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-gray-700">
                                        {formatCurrency(walletOverview.totalGrossEarnings)}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Total Net Earnings */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">
                                        Net Earnings
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-gray-700">
                                        {formatCurrency(walletOverview.totalNetEarnings)}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Total Withdrawn */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">
                                        Total Withdrawn
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-gray-700">
                                        {formatCurrency(walletOverview.totalWithdrawn)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Collection Earnings */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <CardTitle>Collection Earnings</CardTitle>
                                <div className="relative flex-1 sm:flex-initial">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search collections..."
                                        value={collectionSearch}
                                        onChange={(e) => setCollectionSearch(e.target.value)}
                                        className="pl-10 w-full sm:w-64"
                                    />
                                    {collectionSearch && (
                                        <button
                                            onClick={() => setCollectionSearch('')}
                                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredCollections.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs">Collection</TableHead>
                                                <TableHead className="text-xs text-right">Amount</TableHead>
                                                <TableHead className="text-xs text-right">Participants</TableHead>
                                                <TableHead className="text-xs text-right">Earnings</TableHead>
                                                <TableHead className="text-xs text-right">Withdrawable</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredCollections.map((earning) => (
                                                <TableRow key={earning.id}>
                                                    <TableCell className="text-sm font-medium">{earning.name}</TableCell>
                                                    <TableCell className="text-sm text-right">
                                                        {formatCurrency(earning.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-right">{earning.participants}</TableCell>
                                                    <TableCell className="text-sm text-right">
                                                        <div className="text-gray-900 font-medium">
                                                            {formatCurrency(earning.netEarnings)}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            (Gross: {formatCurrency(earning.grossEarnings)})
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-right">
                                                        <span className="font-semibold text-emerald-600">
                                                            {formatCurrency(earning.withdrawable)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-4">
                                    {collectionSearch ? 'No collections match your search' : 'No collections yet'}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="transactions" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <CardTitle>Withdrawal Transactions</CardTitle>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1 sm:flex-initial">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Search transactions..."
                                            value={transactionSearch}
                                            onChange={(e) => setTransactionSearch(e.target.value)}
                                            className="pl-10 w-full sm:w-64"
                                        />
                                        {transactionSearch && (
                                            <button
                                                onClick={() => setTransactionSearch('')}
                                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={transactionStatusFilter}
                                        onChange={(e) => setTransactionStatusFilter(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="completed">Completed</option>
                                        <option value="pending">Pending</option>
                                        <option value="failed">Failed</option>
                                    </select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredTransactions.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs">Date</TableHead>
                                                <TableHead className="text-xs">Collection</TableHead>
                                                <TableHead className="text-xs">Description</TableHead>
                                                <TableHead className="text-xs text-right">Amount</TableHead>
                                                <TableHead className="text-xs text-center">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredTransactions.map((transaction) => (
                                                <TableRow key={transaction.id}>
                                                    <TableCell className="text-sm">{transaction.date}</TableCell>
                                                    <TableCell className="text-sm">{transaction.collection}</TableCell>
                                                    <TableCell className="text-sm text-gray-600">
                                                        {transaction.description}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-semibold text-right">
                                                        {formatCurrency(transaction.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {getStatusIcon(transaction.status)}
                                                            {getStatusBadge(transaction.status)}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-4">
                                    {transactionSearch || transactionStatusFilter !== 'all'
                                        ? 'No transactions match your search or filters'
                                        : 'No transactions yet'}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default PwaWallet;