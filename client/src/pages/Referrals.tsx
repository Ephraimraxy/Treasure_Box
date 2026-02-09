import React, { useEffect, useState } from 'react';
import { Copy, Users, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, Card, FormatCurrency, Spinner } from '../components/ui';
import { userApi } from '../api';

interface Referral {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    kycVerified: boolean;
}

export const ReferralsPage = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReferrals = async () => {
            try {
                const response = await userApi.getReferrals();
                setReferrals(response.data);
            } catch (error) {
                console.error('Failed to fetch referrals:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchReferrals();
    }, []);

    const copyReferralCode = () => {
        navigator.clipboard.writeText(user?.referralCode || '');
        addToast('success', 'Referral code copied!');
    };

    const shareReferralLink = () => {
        const link = `${window.location.origin}/register?ref=${user?.referralCode}`;
        if (navigator.share) {
            navigator.share({
                title: 'Join Treasure Box',
                text: 'Start your investment journey with Treasure Box!',
                url: link,
            });
        } else {
            navigator.clipboard.writeText(link);
            addToast('success', 'Referral link copied!');
        }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Hero Card */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <h2 className="text-lg font-bold mb-2">Refer & Earn</h2>
                    <p className="text-blue-100 mb-6 max-w-md">
                        Share your unique code with friends and earn bonuses on their first investment.
                    </p>

                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 flex items-center justify-between max-w-sm">
                        <div>
                            <div className="text-xs text-blue-200 uppercase font-bold">Your Referral Code</div>
                            <div className="text-2xl font-mono font-bold tracking-widest">{user?.referralCode}</div>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={copyReferralCode}
                            className="h-10 w-10 p-0 rounded-lg flex items-center justify-center"
                        >
                            <Copy size={18} />
                        </Button>
                    </div>

                    <Button onClick={shareReferralLink} className="mt-4">
                        Share Referral Link
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <div className="text-slate-400 text-sm mb-1">Total Earnings</div>
                    <div className="text-3xl font-bold text-white">
                        <FormatCurrency amount={0} /> {/* Can update this later if referral earnings are tracked */}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">From referral bonuses</div>
                </Card>
                <Card>
                    <div className="text-slate-400 text-sm mb-1">Total Referrals</div>
                    <div className="text-3xl font-bold text-white">{user?._count?.referrals || 0}</div>
                    <div className="text-xs text-slate-500 mt-2">Friends joined</div>
                </Card>
            </div>

            {/* Referral List */}
            <Card>
                <h3 className="font-bold text-white mb-4">Your Referrals</h3>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Spinner />
                    </div>
                ) : referrals.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="mx-auto text-slate-600 mb-4" size={48} />
                        <p className="text-slate-500">No referrals yet</p>
                        <p className="text-xs text-slate-600 mt-2">Share your code to start earning!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {referrals.map((ref) => (
                            <div key={ref.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-800 rounded-full">
                                        <UserPlus size={16} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">{ref.name || 'User'}</div>
                                        <div className="text-xs text-slate-500">{ref.email}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-xs px-2 py-0.5 rounded ${ref.kycVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        {ref.kycVerified ? 'Verified' : 'Pending'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        {new Date(ref.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* How it Works - kept same */}
            <Card>
                <h3 className="font-bold text-white mb-4">How It Works</h3>
                <div className="space-y-4">
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold shrink-0">1</div>
                        <div>
                            <div className="font-medium text-white">Share Your Code</div>
                            <div className="text-sm text-slate-400">Give your referral code to friends</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold shrink-0">2</div>
                        <div>
                            <div className="font-medium text-white">They Sign Up</div>
                            <div className="text-sm text-slate-400">Friend registers using your code</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold shrink-0">3</div>
                        <div>
                            <div className="font-medium text-white">Earn Bonus</div>
                            <div className="text-sm text-slate-400">Get rewarded when they invest</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
