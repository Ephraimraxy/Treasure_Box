import React, { useState, useEffect } from 'react';
import { TrendingUp, Shield, Clock, DollarSign, Users, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { transactionApi, investmentApi } from '../api';
import { Card, FormatCurrency, Spinner } from '../components/ui';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    status: string;
    description: string;
    createdAt: string;
}

interface Investment {
    id: string;
    principal: number;
    durationDays: number;
    baseRate: number;
    bonusRate: number;
    maturityDate: string;
    status: string;
}

export const DashboardPage = () => {
    const { user, refreshUser } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [txRes, invRes] = await Promise.all([
                    transactionApi.getAll(),
                    investmentApi.getAll()
                ]);
                setTransactions(txRes.data.slice(0, 5));
                setInvestments(invRes.data);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const activeInvestments = investments.filter(i => i.status === 'ACTIVE');
    const totalInvested = activeInvestments.reduce((sum, i) => sum + i.principal, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Welcome Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        {user?.kycPhotoUrl ? (
                            <img src={user.kycPhotoUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-amber-500" />
                        ) : null}
                        <div>
                            <h1 className="text-lg font-bold text-white">Welcome, {user?.username || 'back!'}</h1>
                            <p className="text-slate-400 text-sm">{user?.email}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card className="bg-gradient-to-br from-amber-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-xl">
                            <DollarSign className="text-amber-500" size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Balance</div>
                            <div className="text-lg font-bold text-white">
                                <FormatCurrency amount={user?.balance || 0} />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                            <TrendingUp className="text-emerald-500" size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Invested</div>
                            <div className="text-lg font-bold text-white">
                                <FormatCurrency amount={totalInvested} />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-xl">
                            <Activity className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Active Plans</div>
                            <div className="text-lg font-bold text-white">{activeInvestments.length}</div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-purple-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-xl">
                            <Shield className="text-purple-500" size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">KYC Status</div>
                            <div className={`text-sm font-bold ${user?.kycVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {user?.kycVerified ? 'Verified' : 'Pending'}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Active Investments */}
            {activeInvestments.length > 0 && (
                <Card>
                    <h3 className="text-base font-bold text-white mb-3">Active Investments</h3>
                    <div className="space-y-2">
                        {activeInvestments.map((inv) => {
                            const maturity = new Date(inv.maturityDate);
                            const now = new Date();
                            const daysLeft = Math.max(0, Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                            const totalRate = inv.baseRate + inv.bonusRate;

                            return (
                                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                                            <TrendingUp className="text-emerald-500" size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">
                                                <FormatCurrency amount={inv.principal} />
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {inv.durationDays} days @ {totalRate}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1 text-amber-500">
                                            <Clock size={14} />
                                            <span className="text-sm font-bold">{daysLeft}d left</span>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Matures: {maturity.toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Recent Transactions */}
            <Card>
                <h3 className="text-base font-bold text-white mb-3">Recent Activity</h3>
                {transactions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">No transactions yet</div>
                ) : (
                    <div className="space-y-2">
                        {transactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg">
                                <div>
                                    <div className="text-sm font-medium text-white">{tx.description}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(tx.createdAt).toLocaleString()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' ? '-' : '+'}
                                        <FormatCurrency amount={tx.amount} />
                                    </div>
                                    <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded inline-block ${tx.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' :
                                        tx.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                        {tx.status}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
