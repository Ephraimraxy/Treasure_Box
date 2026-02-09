import React, { useState, useEffect } from 'react';
import { Copy, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { transactionApi, investmentApi, paymentApi, userApi } from '../api';
import { Button, Input, Card, FormatCurrency } from '../components/ui';

const DURATIONS = [
    { days: 7, baseRate: 2 },
    { days: 14, baseRate: 4 },
    { days: 30, baseRate: 8 },
    { days: 60, baseRate: 12 },
];

const MIN_INVESTMENT = 20000;

export const WalletPage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const [amount, setAmount] = useState('');
    const [duration, setDuration] = useState(7);
    const [tab, setTab] = useState<'deposit' | 'withdraw' | 'invest'>('deposit');
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        minDeposit: 1000,
        minWithdrawal: 1000,
        minInvestment: 5000,
        kycRequiredForAccount: true
    });

    // Fetch system settings on mount
    useEffect(() => {
        userApi.getSettings().then(res => {
            setSettings(res.data);
        }).catch(console.error);
    }, []);

    const handleDeposit = async () => {
        const amt = parseFloat(amount);
        if (amt < settings.minDeposit) {
            addToast('error', `Minimum deposit is ₦${settings.minDeposit.toLocaleString()}`);
            return;
        }
        setLoading(true);
        try {
            const response = await paymentApi.initialize(amt, 'deposit');
            if (response.data.authorization_url) {
                window.location.href = response.data.authorization_url;
            } else {
                addToast('error', 'Failed to initialize payment');
            }
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Deposit failed');
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async () => {
        const amt = parseFloat(amount);
        if (amt > (user?.balance || 0)) {
            addToast('error', 'Insufficient funds');
            return;
        }
        if (amt < settings.minWithdrawal) {
            addToast('error', `Minimum withdrawal is ₦${settings.minWithdrawal.toLocaleString()}`);
            return;
        }
        setLoading(true);
        try {
            await transactionApi.withdraw(amt);
            addToast('success', 'Withdrawal request submitted for approval');
            await refreshUser();
            setAmount('');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Withdrawal failed');
        } finally {
            setLoading(false);
        }
    };

    const handleInvest = async () => {
        const amt = parseFloat(amount);
        if (amt < MIN_INVESTMENT) {
            addToast('error', `Minimum investment is ₦${MIN_INVESTMENT.toLocaleString()}`);
            return;
        }
        if (amt > (user?.balance || 0)) {
            addToast('error', 'Insufficient funds');
            return;
        }
        setLoading(true);
        try {
            await investmentApi.create(amt, duration);
            addToast('success', 'Investment created successfully!');
            await refreshUser();
            setAmount('');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Investment failed');
        } finally {
            setLoading(false);
        }
    };

    const plan = DURATIONS.find(d => d.days === duration);
    const estimatedReturn = plan ? parseFloat(amount || '0') * (1 + plan.baseRate / 100) : 0;

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Balance Card */}
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-slate-400 font-medium mb-1">Total Balance</div>
                        <div className="text-2xl font-bold text-white font-mono mb-3">
                            <FormatCurrency amount={user?.balance || 0} />
                        </div>

                        {user?.virtualAccount ? (
                            <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 mb-2">
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Virtual Account</div>
                                <div className="text-white font-bold">{user.virtualAccount.bankName}</div>
                                <div className="flex justify-between items-center">
                                    <div className="font-mono text-lg">{user.virtualAccount.accountNumber}</div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(user.virtualAccount?.accountNumber || '');
                                            addToast('info', 'Account number copied');
                                        }}
                                        className="p-1 hover:bg-white/10 rounded"
                                    >
                                        <Copy size={14} className="text-slate-400" />
                                    </button>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{user.virtualAccount.accountName}</div>
                            </div>
                        ) : (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg mb-2">
                                <p className="text-xs text-amber-200 mb-2">
                                    {(user?.role === 'ADMIN' || !settings.kycRequiredForAccount || user?.kycVerified)
                                        ? 'Generate your dedicated virtual account number.'
                                        : 'Complete KYC & Profile to get your dedicated account number.'}
                                </p>

                                {(user?.role === 'ADMIN' || !settings.kycRequiredForAccount || user?.kycVerified) ? (
                                    <Button
                                        variant="secondary"
                                        className="w-full text-xs"
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                // Call API to create virtual account
                                                await paymentApi.createVirtualAccount();
                                                addToast('success', 'Virtual Account generated!');
                                                await refreshUser();
                                            } catch (error: any) {
                                                addToast('error', error.response?.data?.error || 'Failed to generate account');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        disabled={loading}
                                    >
                                        {loading ? 'Generating...' : 'Generate Account No.'}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        className="w-full text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                                        onClick={() => window.location.href = '/kyc'}
                                    >
                                        Complete KYC
                                    </Button>
                                )}
                            </div>
                        )}

                        <div className="bg-white/5 p-2.5 rounded-lg border border-white/10">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Referral Code</div>
                            <div className="flex justify-between items-center">
                                <div className="text-white font-bold text-lg font-mono">{user?.referralCode}</div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(user?.referralCode || '');
                                        addToast('info', 'Copied to clipboard');
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg"
                                >
                                    <Copy size={16} className="text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Action Buttons */}
                <Card className="flex flex-col justify-center gap-3">
                    <div className="flex gap-2">
                        <Button
                            variant={tab === 'deposit' ? 'primary' : 'outline'}
                            onClick={() => setTab('deposit')}
                            className="flex-1 text-sm py-2"
                        >
                            Deposit
                        </Button>
                        <Button
                            variant={tab === 'withdraw' ? 'primary' : 'outline'}
                            onClick={() => setTab('withdraw')}
                            className="flex-1 text-sm py-2"
                        >
                            Withdraw
                        </Button>
                    </div>
                    <Button
                        variant={tab === 'invest' ? 'primary' : 'outline'}
                        onClick={() => setTab('invest')}
                        className="w-full text-sm py-2"
                    >
                        New Investment
                    </Button>
                </Card>
            </div>

            {/* Action Form */}
            <Card className="max-w-xl mx-auto">
                <h3 className="text-lg font-bold text-white mb-3 capitalize">{tab} Funds</h3>
                <div className="space-y-4">
                    {tab === 'invest' && (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                {DURATIONS.map((d) => (
                                    <button
                                        key={d.days}
                                        onClick={() => setDuration(d.days)}
                                        className={`p-2.5 rounded-lg border transition-all text-sm ${duration === d.days
                                            ? 'bg-amber-500 text-slate-900 border-amber-500 font-bold'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                                            }`}
                                    >
                                        {d.days} Days ({d.baseRate}%)
                                    </button>
                                ))}
                            </div>
                            {amount && parseFloat(amount) >= MIN_INVESTMENT && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                                    <div className="text-xs text-emerald-400 mb-1">Estimated Return</div>
                                    <div className="text-2xl font-bold text-emerald-400">
                                        <FormatCurrency amount={estimatedReturn} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {tab === 'deposit' && (
                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-start gap-2">
                            <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Instant Card Funding</h4>
                                <p className="text-xs text-slate-400">
                                    Fund your wallet instantly using your debit card. No KYC required for card deposits.
                                </p>
                            </div>
                        </div>
                    )}

                    <Input
                        label="Amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        icon={<span>₦</span>}
                        placeholder="0.00"
                    />

                    {tab === 'withdraw' && (
                        <div className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                            Funds will be sent to your linked bank account. Processing time: 1-24 hours.
                        </div>
                    )}

                    <Button
                        onClick={tab === 'deposit' ? handleDeposit : tab === 'withdraw' ? handleWithdraw : handleInvest}
                        disabled={loading || !amount}
                        className="w-full"
                    >
                        {loading ? 'Processing...' : `Confirm ${tab}`}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
