import React from 'react'
import {
    ArrowUpIcon,
    ArrowDownIcon,
    ExternalLinkIcon,
    CopyIcon,
} from 'lucide-react'
export const ContributionTransactions = () => {
    const transactions = [
        {
            id: 1,
            type: 'contribution',
            collection: 'Office End-Year Party',
            amount: '₦25,000',
            date: 'Today',
            time: '2:30 PM',
            status: 'success',
            paymentMethod: 'Card Payment',
            reference: 'TRX-12345678',
            contributor: 'Chioma Adebayo',
            bank: 'GTBank',
        },
        {
            id: 2,
            type: 'withdrawal',
            collection: 'Family Savings',
            amount: '₦100,000',
            date: 'Yesterday',
            time: '11:15 AM',
            status: 'success',
            paymentMethod: 'Bank Transfer',
            reference: 'TRX-87654321',
            bank: 'Access Bank',
            accountNumber: '****4532',
        },
        {
            id: 3,
            type: 'contribution',
            collection: 'House Rent',
            amount: '₦50,000',
            date: '2 days ago',
            time: '3:45 PM',
            status: 'pending',
            paymentMethod: 'USSD',
            reference: 'TRX-98765432',
            contributor: 'Emmanuel Okonkwo',
            bank: 'UBA',
        },
    ]
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success':
                return 'bg-green-50 text-green-700'
            case 'pending':
                return 'bg-yellow-50 text-yellow-700'
            case 'failed':
                return 'bg-red-50 text-red-700'
            default:
                return 'bg-gray-50 text-gray-700'
        }
    }
    return (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
            </div>
            <div className="divide-y divide-gray-100">
                {transactions.map((transaction) => (
                    <div key={transaction.id} className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                                <div
                                    className={`
                  rounded-full p-2
                  ${transaction.type === 'contribution' ? 'bg-green-50' : 'bg-blue-50'}
                `}
                                >
                                    {transaction.type === 'contribution' ? (
                                        <ArrowUpIcon className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <ArrowDownIcon className="h-4 w-4 text-blue-600" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {transaction.collection}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {transaction.date} at {transaction.time}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-medium text-gray-900">
                                    {transaction.amount}
                                </p>
                                <span
                                    className={`
                  inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
                  ${getStatusColor(transaction.status)}
                `}
                                >
                                    {transaction.status}
                                </span>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Payment Method</span>
                                <span className="text-gray-900 font-medium">
                                    {transaction.paymentMethod} • {transaction.bank}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Reference ID</span>
                                <div className="flex items-center space-x-2">
                                    <span className="text-gray-900 font-medium">
                                        {transaction.reference}
                                    </span>
                                    <button className="text-blue-600 hover:text-blue-700">
                                        <CopyIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            {transaction.contributor && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Contributor</span>
                                    <span className="text-gray-900 font-medium">
                                        {transaction.contributor}
                                    </span>
                                </div>
                            )}
                            {transaction.accountNumber && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Account Number</span>
                                    <span className="text-gray-900 font-medium">
                                        {transaction.accountNumber}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                                View Details
                                <ExternalLinkIcon className="ml-2 h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="border-t border-gray-100 px-6 py-4">
                <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    View all transactions
                </button>
            </div>
        </div>
    )
}
