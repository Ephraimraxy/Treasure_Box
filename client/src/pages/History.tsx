import React, { useState, useEffect } from 'react';
import { transactionApi } from '../api';
import { Card, FormatCurrency, Spinner } from '../components/ui';
import { ArrowUpRight, ArrowDownRight, Receipt } from 'lucide-react';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    status: string;
    description: string;
    createdAt: string;
}

export const HistoryPage = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'investment'>('all');

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 20;

    useEffect(() => {
        const fetchTransactions = async () => {
            setLoading(true);
            try {
                const response = await transactionApi.getAll(page, limit, filter);
                // Handle new response structure { data, meta }
                const { data, meta } = response.data;
                setTransactions(data);
                setTotalPages(meta.totalPages);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, [page, filter]); // Re-fetch when page or filter changes

    // Reset page when filter changes
    const handleFilterChange = (newFilter: typeof filter) => {
        if (newFilter !== filter) {
            setFilter(newFilter);
            setPage(1);
        }
    };

    const getTypeIcon = (type: string) => {
        if (type.includes('DEBIT') || type === 'WITHDRAWAL' || type === 'UTILITY_BILL') {
            return <ArrowUpRight className="text-red-400" size={18} />;
        }
        return <ArrowDownRight className="text-emerald-400" size={18} />;
    };

    return (
        <div className="space-y-4 animate-fade-in pb-20"> {/* pb-20 for mobile nav clearance */}
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-white">Transaction History</h1>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['all', 'deposit', 'withdrawal', 'investment'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => handleFilterChange(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize whitespace-nowrap ${filter === f
                            ? 'bg-amber-500 text-slate-900'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {f === 'all' ? 'All' : f}
                    </button>
                ))}
            </div>

            {/* Transaction List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Spinner />
                </div>
            ) : transactions.length === 0 ? (
                <Card className="text-center py-12">
                    <Receipt className="mx-auto text-slate-600 mb-4" size={48} />
                    <p className="text-slate-500">No transactions found</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {transactions.map((tx) => (
                        <Card key={tx.id} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                                    {getTypeIcon(tx.type)}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">{tx.description}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(tx.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`font-bold ${tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' || tx.type === 'UTILITY_BILL'
                                    ? 'text-red-400'
                                    : 'text-emerald-400'
                                    }`}>
                                    {tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' || tx.type === 'UTILITY_BILL' ? '-' : '+'}
                                    <FormatCurrency amount={tx.amount} />
                                </div>
                                <div className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${tx.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' :
                                    tx.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                                        tx.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                                            'bg-slate-500/20 text-slate-400'
                                    }`}>
                                    {tx.status}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 bg-slate-800 rounded text-slate-300 disabled:opacity-50 text-sm"
                    >
                        Prev
                    </button>
                    <span className="px-3 py-1 text-slate-500 text-sm">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 bg-slate-800 rounded text-slate-300 disabled:opacity-50 text-sm"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};
