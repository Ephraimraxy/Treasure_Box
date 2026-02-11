import React, { useEffect, useState } from 'react';
import { Copy, Users, UserPlus, Award, Rocket, Share2, ChevronRight, History, TrendingUp, DollarSign, Wallet, ShieldCheck, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, Card, FormatCurrency, Spinner } from '../components/ui';
import { userApi, transactionApi } from '../api';

interface Referral {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    kycVerified: boolean;
}

interface Transaction {
    id: string;
    type: string;
    amount: number;
    description: string;
    status: string;
    createdAt: string;
}

type Tab = 'overview' | 'history';

export const ReferralsPage = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [history, setHistory] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    useEffect(() => {
        fetchReferrals();
    }, []);

    const fetchReferrals = async () => {
        setLoading(true);
        try {
            const response = await userApi.getReferrals();
            setReferrals(response.data);
        } catch (error) {
            console.error('Failed to fetch referrals:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const response = await transactionApi.getAll(1, 20, 'referral');
            setHistory(response.data.data);
        } catch (error) {
            console.error('Failed to fetch referral history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'history' && history.length === 0) {
            fetchHistory();
        }
    }, [activeTab]);

    const copyReferralCode = () => {
        navigator.clipboard.writeText(user?.referralCode || '');
        addToast('success', 'Referral code copied!');
    };

    const shareReferralLink = () => {
        const link = `${window.location.origin}/register?ref=${user?.referralCode}`;
        if (navigator.share) {
            navigator.share({
                title: 'Join Treasure Box',
                text: 'Join me on Treasure Box and earn bonuses on your investments!',
                url: link,
            });
        } else {
            navigator.clipboard.writeText(link);
            addToast('success', 'Referral link copied!');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Premium Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 blur-[100px] -translate-y-1/2 translate-x-1/2 rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[80px] translate-y-1/3 -translate-x-1/4 rounded-full" />

                <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider mb-2">
                            <Award size={14} /> Referral Program
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                            Refer Friends. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                                Earn Together.
                            </span>
                        </h1>
                        <p className="text-slate-400 max-w-md text-sm md:text-base">
                            Invite your friends to the Treasure Box community. You'll receive instant bonuses whenever they fund their accounts and start their investment journey.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <Button onClick={shareReferralLink} className="shadow-lg shadow-amber-500/20 group">
                                <Share2 size={18} className="mr-2 group-hover:rotate-12 transition-transform" /> Share Link
                            </Button>
                            <div className="flex items-center gap-2 p-1 pl-4 bg-slate-950/50 border border-slate-800 rounded-xl group hover:border-slate-700 transition-colors">
                                <span className="text-slate-400 text-sm font-mono truncate max-w-[120px]">{user?.referralCode}</span>
                                <button
                                    onClick={copyReferralCode}
                                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:block relative w-64 h-64">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full animate-pulse" />
                        <div className="absolute inset-4 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center shadow-inner">
                            <div className="text-center">
                                <Users size={48} className="text-amber-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-white leading-none">{user?._count?.referrals || 0}</div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Direct Referrals</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Wallet size={14} className="text-emerald-500" /> Total Earnings
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">
                        <FormatCurrency amount={user?.referralEarnings || 0} />
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Users size={14} className="text-blue-500" /> Total Referred
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-white">{user?._count?.referrals || 0}</div>
                </div>
                <div className="col-span-2 md:col-span-1 bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <div className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-amber-500" /> Current Rank
                        </div>
                        <div className="text-lg font-bold text-white">Associate</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <Award size={20} className="text-amber-500" />
                    </div>
                </div>
            </div>

            {/* Tabs & Content */}
            <div className="space-y-4">
                <div className="flex p-1 bg-slate-900/80 border border-slate-800 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Users size={16} /> My Team
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <History size={16} /> Earnings History
                    </button>
                </div>

                {activeTab === 'overview' ? (
                    <Card className="min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <Users size={18} className="text-amber-500" /> Direct Referrals
                            </h3>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                <Spinner />
                                <span className="text-sm text-slate-500 animate-pulse">Loading your team...</span>
                            </div>
                        ) : referrals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
                                    <Users size={32} className="text-slate-700" />
                                </div>
                                <div>
                                    <p className="text-slate-300 font-bold">No referrals yet</p>
                                    <p className="text-xs text-slate-500 mt-1">Invite your first friend and watch your earnings grow!</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={shareReferralLink}>Get Sharing Link</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {referrals.map((ref) => (
                                    <div key={ref.id} className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center group-hover:bg-amber-500/10 transition-colors">
                                                <UserPlus size={18} className="text-slate-500 group-hover:text-amber-500 transition-colors" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-white">{ref.name || 'User'}</div>
                                                <div className="text-[10px] text-slate-500">{new Date(ref.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {ref.kycVerified ? (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                                                    <ShieldCheck size={10} /> Verified
                                                </div>
                                            ) : (
                                                <div className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                                    Pending
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                ) : (
                    <Card className="min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <DollarSign size={18} className="text-emerald-500" /> Earnings history
                            </h3>
                        </div>

                        {historyLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                <Spinner />
                                <span className="text-sm text-slate-500 animate-pulse">Fetching history...</span>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
                                    <History size={32} className="text-slate-700" />
                                </div>
                                <div>
                                    <p className="text-slate-300 font-bold">No earning history</p>
                                    <p className="text-xs text-slate-500 mt-1">Earnings will appear here once your referrals start investing.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800 rounded-2xl">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                                                <TrendingUp size={20} className="text-emerald-500" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{item.description}</div>
                                                <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-emerald-400">
                                                +<FormatCurrency amount={item.amount} />
                                            </div>
                                            <div className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter">Bonus Received</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                )}
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h4 className="font-bold text-white flex items-center gap-2">
                        <Info size={18} className="text-blue-500" /> How it Works
                    </h4>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-500 font-black shrink-0">1</div>
                            <div>
                                <div className="text-sm font-bold text-white mb-0.5">Invite your Inner Circle</div>
                                <p className="text-xs text-slate-500 leading-relaxed">Share your unique link or referral code with friends, family, and colleagues.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-500 font-black shrink-0">2</div>
                            <div>
                                <div className="text-sm font-bold text-white mb-0.5">Friends Start Investing</div>
                                <p className="text-xs text-slate-500 leading-relaxed">When they register and make their first investment, they join your referral network.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-500 font-black shrink-0">3</div>
                            <div>
                                <div className="text-sm font-bold text-white mb-0.5">Unlock Instant Bonuses</div>
                                <p className="text-xs text-slate-500 leading-relaxed">Get paid a percentage bonus directly to your wallet for every investment they make.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col justify-center items-center text-center space-y-4">
                    <div className="w-20 h-20 bg-amber-500 shadow-xl shadow-amber-500/20 rounded-3xl flex items-center justify-center -rotate-6">
                        <Rocket size={40} className="text-slate-900" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-white mb-2">Ready to Scale?</h4>
                        <p className="text-sm text-slate-400 max-w-xs">
                            Maximize your earnings by sharing your link on social media. There's no limit to how many friends you can invite!
                        </p>
                    </div>
                    <Button onClick={shareReferralLink} variant="secondary" className="w-full">
                        Spread the Word <ChevronRight size={16} className="ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

