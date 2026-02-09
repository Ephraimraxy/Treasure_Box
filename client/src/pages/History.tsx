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

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const response = await transactionApi.getAll();
                setTransactions(response.data);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, []);

    const filteredTransactions = transactions.filter(tx => {
        if (filter === 'all') return true;
        if (filter === 'deposit') return tx.type === 'DEPOSIT';
        if (filter === 'withdrawal') return tx.type === 'WITHDRAWAL';
        if (filter === 'investment') return tx.type.includes('INVESTMENT');
        return true;
    });

    const getTypeIcon = (type: string) => {
        if (type.includes('DEBIT') || type === 'WITHDRAWAL' || type === 'UTILITY_BILL') {
            return <ArrowUpRight className="text-red-400" size={18} />;
        }
        return <ArrowDownRight className="text-emerald-400" size={18} />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-white">Transaction History</h1>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {(['all', 'deposit', 'withdrawal', 'investment'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
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
            {filteredTransactions.length === 0 ? (
                <Card className="text-center py-12">
                    <Receipt className="mx-auto text-slate-600 mb-4" size={48} />
                    <p className="text-slate-500">No transactions found</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredTransactions.map((tx) => (
                        <Card key={tx.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-3 bg-slate-900 rounded-xl">
                                    {getTypeIcon(tx.type)}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">{tx.description}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(tx.createdAt).toLocaleString()} • {tx.type.replace(/_/g, ' ')}
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
                                <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded inline-block mt-1 ${tx.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' :
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
        </div>
    );
};
