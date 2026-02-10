import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Shield, Clock, DollarSign, Activity, Eye, EyeOff, RefreshCw, Plus, ArrowUpRight, ArrowDownLeft, Copy, Flag, Info, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { transactionApi, investmentApi, paymentApi, userApi } from '../api';
import { Card, FormatCurrency, Spinner, Button, Modal, Input } from '../components/ui';
import { FeaturedCarousel } from '../components/FeaturedCarousel';

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

const DURATIONS = [
    { days: 7, baseRate: 2 },
    { days: 14, baseRate: 4 },
    { days: 30, baseRate: 8 },
    { days: 60, baseRate: 12 },
];

const MIN_INVESTMENT = 20000;

export const DashboardPage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showBalance, setShowBalance] = useState(true);

    // Wallet Logic State
    const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw' | 'invest' | null>(null);
    const [amount, setAmount] = useState('');
    const [duration, setDuration] = useState(7);
    const [withdrawPin, setWithdrawPin] = useState('');

    // Loading States
    const [actionLoading, setActionLoading] = useState(false); // Shared for deposit/withdraw/invest submit
    const [accountLoading, setAccountLoading] = useState(false);

    // Settings
    const [settings, setSettings] = useState({
        minDeposit: 1000,
        minWithdrawal: 1000,
        minInvestment: 5000,
        kycRequiredForAccount: true
    });

    // Pin Management State
    const [pinModal, setPinModal] = useState({ open: false, mode: 'create' as 'create' | 'reset' });
    const [pinStep, setPinStep] = useState(1);
    const [pinInputs, setPinInputs] = useState({ pin: '', confirm: '', password: '' });
    const [pinLoading, setPinLoading] = useState(false);

    // Suspension Appeal State
    const [appealModal, setAppealModal] = useState(false);
    const [appealMessage, setAppealMessage] = useState('');
    const [appealLoading, setAppealLoading] = useState(false);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [txRes, invRes, settingsRes] = await Promise.all([
                    transactionApi.getAll(1, 5),
                    investmentApi.getAll(),
                    userApi.getSettings()
                ]);
                setTransactions(txRes.data.data);
                setInvestments(invRes.data);
                setSettings(settingsRes.data);
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

    // --- Action Handlers ---

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshUser();
            const [txRes, invRes] = await Promise.all([
                transactionApi.getAll(1, 5),
                investmentApi.getAll()
            ]);
            setTransactions(txRes.data.data);
            setInvestments(invRes.data);
            addToast('success', 'Dashboard updated');
        } catch (error) {
            addToast('error', 'Failed to refresh');
        } finally {
            setRefreshing(false);
        }
    }

    const handleDeposit = async () => {
        const amt = parseFloat(amount);
        if (amt < settings.minDeposit) {
            addToast('error', `Minimum deposit is ₦${settings.minDeposit.toLocaleString()}`);
            return;
        }
        setActionLoading(true);
        try {
            const response = await paymentApi.initialize(amt, 'deposit');
            if (response.data.authorization_url) {
                window.location.href = response.data.authorization_url;
            } else {
                addToast('error', 'Failed to initialize payment');
            }
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Deposit failed');
            setActionLoading(false); // Only stop loading on error, success redirects
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
        if (!user?.transactionPin) {
            setActiveAction(null);
            setPinModal({ open: true, mode: 'create' });
            return;
        }
        if (!withdrawPin) {
            addToast('error', 'Please enter your transaction PIN');
            return;
        }

        setActionLoading(true);
        try {
            await transactionApi.withdraw(amt, withdrawPin);
            addToast('success', 'Withdrawal request submitted');
            await refreshUser();
            setActiveAction(null);
            setAmount('');
            setWithdrawPin('');
        } catch (error: any) {
            if (error.response?.data?.error?.includes('bank account')) {
                addToast('error', 'Please link your bank account in Profile first');
            } else {
                addToast('error', error.response?.data?.error || 'Withdrawal failed');
            }
        } finally {
            setActionLoading(false);
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
        setActionLoading(true);
        try {
            await investmentApi.create(amt, duration);
            addToast('success', 'Investment created successfully!');
            await refreshUser();
            const invRes = await investmentApi.getAll();
            setInvestments(invRes.data);
            setActiveAction(null);
            setAmount('');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Investment failed');
        } finally {
            setActionLoading(false);
        }
    };

    // --- PIN Handlers ---

    const handlePinSubmit = async () => {
        setPinLoading(true);
        try {
            if (pinModal.mode === 'create') {
                if (pinInputs.pin !== pinInputs.confirm) {
                    addToast('error', 'PINs do not match');
                    return;
                }
                await userApi.setPin(pinInputs.pin, pinInputs.password);
                addToast('success', 'Transaction PIN set successfully');
            } else {
                if (pinInputs.pin !== pinInputs.confirm) {
                    addToast('error', 'PINs do not match');
                    return;
                }
                await userApi.resetPin(pinInputs.password, pinInputs.pin);
                addToast('success', 'Transaction PIN reset successfully');
            }
            await refreshUser();
            setPinModal({ ...pinModal, open: false });
            setPinInputs({ pin: '', confirm: '', password: '' });
            setPinStep(1);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to update PIN');
        } finally {
            setPinLoading(false);
        }
    };

    // --- Appeal Handler ---
    const handleAppealSubmit = async () => {
        if (!appealMessage.trim()) return;
        setAppealLoading(true);
        try {
            await userApi.submitAppeal(appealMessage);
            addToast('success', 'Appeal submitted! An admin will review your case.');
            setAppealModal(false);
            setAppealMessage('');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to submit appeal');
        } finally {
            setAppealLoading(false);
        }
    };

    const investmentPlan = DURATIONS.find(d => d.days === duration);
    const estimatedReturn = investmentPlan ? parseFloat(amount || '0') * (1 + investmentPlan.baseRate / 100) : 0;

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Spinner /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in relative">
            {/* Suspension Banner */}
            {user?.isSuspended && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                            <Flag className="text-red-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-red-400 mb-1">Account Suspended</h3>
                            <p className="text-sm text-slate-300">
                                {user.suspensionReason || 'Your account has been suspended.'} You can still receive deposits, but withdrawals and investments are restricted.
                            </p>
                            <button onClick={() => setAppealModal(true)} className="mt-2 text-sm text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2">
                                Submit an Appeal →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Balance Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Balance Card */}
                <Card className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign size={120} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                {user?.kycPhotoUrl && (
                                    <img src={user.kycPhotoUrl} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-slate-600" />
                                )}
                                <div>
                                    <div className="text-sm text-slate-400">Total Balance</div>
                                    <div className="text-3xl font-bold text-white font-mono tracking-tight">
                                        {showBalance ? <FormatCurrency amount={user?.balance || 0} /> : '*******'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowBalance(!showBalance)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                                    {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <button onClick={handleRefresh} className={`p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors ${refreshing ? 'animate-spin' : ''}`} disabled={refreshing}>
                                    <RefreshCw size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Virtual Account Info (Compact) */}
                        {user?.virtualAccount ? (
                            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Virtual Account</div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-white font-bold font-mono">{user.virtualAccount.accountNumber}</span>
                                        <span className="text-xs text-slate-400">• {user.virtualAccount.bankName}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">{user.virtualAccount.accountName}</div>
                                </div>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(user.virtualAccount?.accountNumber || ''); addToast('info', 'Copied!'); }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4">
                                {(user?.role === 'ADMIN' || !settings.kycRequiredForAccount || user?.kycVerified) ? (
                                    <Button
                                        variant="secondary"
                                        onClick={async () => {
                                            setAccountLoading(true);
                                            try { await paymentApi.createVirtualAccount(); await refreshUser(); addToast('success', 'Account created'); }
                                            catch (e: any) { addToast('error', e.response?.data?.error || 'Failed'); }
                                            finally { setAccountLoading(false); }
                                        }}
                                        disabled={accountLoading}
                                        className="w-full text-xs"
                                    >
                                        {accountLoading ? 'Generating...' : 'Generate Virtual Account'}
                                    </Button>
                                ) : (
                                    <div className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                        Complete KYC to get a virtual account.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Quick Actions Integration */}
                <div className="grid grid-rows-3 gap-2">
                    <button
                        onClick={() => { setActiveAction('deposit'); setAmount(''); }}
                        className="flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all group text-left"
                    >
                        <div className="p-2 bg-emerald-500 text-slate-900 rounded-lg group-hover:scale-110 transition-transform">
                            <Plus size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="font-bold text-white">Deposit</div>
                            <div className="text-xs text-emerald-400">Fund Wallet</div>
                        </div>
                    </button>

                    <button
                        onClick={() => { setActiveAction('withdraw'); setAmount(''); setWithdrawPin(''); }}
                        className="flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all group text-left"
                    >
                        <div className="p-2 bg-red-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                            <ArrowUpRight size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="font-bold text-white">Withdraw</div>
                            <div className="text-xs text-red-400">To Bank</div>
                        </div>
                    </button>

                    <button
                        onClick={() => { setActiveAction('invest'); setAmount(''); }}
                        className="flex items-center gap-3 p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all group text-left"
                    >
                        <div className="p-2 bg-amber-500 text-slate-900 rounded-lg group-hover:scale-110 transition-transform">
                            <TrendingUp size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="font-bold text-white">Invest</div>
                            <div className="text-xs text-amber-400">Earn Returns</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900/50 border-slate-800">
                    <div className="text-xs text-slate-400 mb-1">Total Invested</div>
                    <div className="text-lg font-bold text-white"><FormatCurrency amount={totalInvested} /></div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <div className="text-xs text-slate-400 mb-1">Active Plans</div>
                    <div className="text-lg font-bold text-white">{activeInvestments.length}</div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <div className="text-xs text-slate-400 mb-1">Referral Code</div>
                    <div className="text-lg font-bold text-white font-mono flex items-center justify-between">
                        {user?.referralCode}
                        <button onClick={() => { navigator.clipboard.writeText(user?.referralCode || ''); addToast('info', 'Copied'); }} className="text-slate-500 hover:text-white">
                            <Copy size={14} />
                        </button>
                    </div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <div className="text-xs text-slate-400 mb-1">KYC Status</div>
                    <div className={`text-lg font-bold ${user?.kycVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {user?.kycVerified ? 'Verified' : 'Pending'}
                    </div>
                </Card>
            </div>

            {/* Featured Carousel */}
            <FeaturedCarousel />

            {/* Content Section: Transactions & Investments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Active Investments List */}
                <Card>
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-amber-500" /> Active Investments
                    </h3>
                    <div className="space-y-2">
                        {activeInvestments.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-4">No active investments</p>
                        ) : (
                            activeInvestments.map(inv => {
                                const maturity = new Date(inv.maturityDate);
                                const daysLeft = Math.max(0, Math.ceil((maturity.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
                                return (
                                    <div key={inv.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-white"><FormatCurrency amount={inv.principal} /></div>
                                            <div className="text-xs text-slate-400">{inv.durationDays} days @ {(inv.baseRate + inv.bonusRate)}%</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-amber-500">{daysLeft}d left</div>
                                            <div className="text-[10px] text-slate-500">{maturity.toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Card>

                {/* Recent Transactions */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Clock size={18} className="text-slate-400" /> Recent Activity
                        </h3>
                        <button
                            onClick={() => navigate('/history')}
                            className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors font-medium"
                        >
                            View All <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {transactions.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-4">No transactions yet</p>
                        ) : (
                            transactions.map(tx => (
                                <div key={tx.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-medium text-white">{tx.description}</div>
                                        <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold ${tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' ? '-' : '+'} <FormatCurrency amount={tx.amount} />
                                        </div>
                                        <div className={`text-[10px] inline-block px-1.5 rounded ${tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
                                            tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                                            }`}>{tx.status}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* --- ACTION MODALS --- */}

            {/* Action Modal (Deposit / Withdraw / Invest) */}
            <Modal
                isOpen={!!activeAction}
                onClose={() => setActiveAction(null)}
                title={activeAction ? activeAction.charAt(0).toUpperCase() + activeAction.slice(1) : ''}
            >
                <div className="space-y-4">
                    {/* Deposit Info */}
                    {activeAction === 'deposit' && (
                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-start gap-2">
                            <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Instant Card Funding</h4>
                                <p className="text-xs text-slate-400">Fund your wallet instantly using your debit card.</p>
                            </div>
                        </div>
                    )}

                    {/* Investment Options */}
                    {activeAction === 'invest' && (
                        <div className="space-y-3">
                            <label className="text-sm text-slate-300">Select Duration</label>
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
                        </div>
                    )}

                    {/* Amount Input */}
                    <Input
                        label="Amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        icon={<span>₦</span>}
                    />

                    {/* Investment Estimate */}
                    {activeAction === 'invest' && amount && parseFloat(amount) >= MIN_INVESTMENT && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex justify-between items-center">
                            <span className="text-xs text-emerald-400">Estimated Return</span>
                            <span className="text-xl font-bold text-emerald-400"><FormatCurrency amount={estimatedReturn} /></span>
                        </div>
                    )}

                    {/* Withdrawal PIN */}
                    {activeAction === 'withdraw' && (
                        <div className="space-y-2">
                            <Input
                                label="Transaction PIN"
                                type="password"
                                maxLength={4}
                                value={withdrawPin}
                                onChange={(e) => setWithdrawPin(e.target.value.replace(/\D/g, ''))}
                                placeholder="****"
                                className="tracking-widest text-center"
                            />
                            <div className="flex justify-end">
                                <button onClick={() => { setActiveAction(null); setPinModal({ open: true, mode: 'reset' }); }} className="text-xs text-slate-500 hover:text-amber-500">
                                    Forgot PIN?
                                </button>
                            </div>
                            <div className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                                Funds will be sent to your linked bank account (1-24h).
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={activeAction === 'deposit' ? handleDeposit : activeAction === 'withdraw' ? handleWithdraw : handleInvest}
                        disabled={actionLoading || !amount || (activeAction === 'withdraw' && !withdrawPin)}
                        className="w-full"
                    >
                        {actionLoading ? 'Processing...' : `Confirm ${activeAction?.charAt(0).toUpperCase()}${activeAction?.slice(1)}`}
                    </Button>
                </div>
            </Modal>

            {/* PIN Management Modal */}
            <Modal isOpen={pinModal.open} onClose={() => setPinModal({ ...pinModal, open: false })} title={pinModal.mode === 'create' ? 'Set PIN' : 'Reset PIN'}>
                <div className="space-y-4">
                    {pinStep === 1 && (
                        <>
                            <p className="text-sm text-slate-400">Enter a 4-digit PIN for transactions.</p>
                            <Input type="password" placeholder="Enter PIN" maxLength={4} value={pinInputs.pin} onChange={e => setPinInputs({ ...pinInputs, pin: e.target.value.replace(/\D/g, '') })} className="text-center tracking-widest" />
                            <Button onClick={() => pinInputs.pin.length === 4 ? setPinStep(2) : addToast('error', 'Enter 4 digits')} className="w-full">Next</Button>
                        </>
                    )}
                    {pinStep === 2 && (
                        <>
                            <p className="text-sm text-slate-400">Confirm your PIN.</p>
                            <Input type="password" placeholder="Confirm PIN" maxLength={4} value={pinInputs.confirm} onChange={e => setPinInputs({ ...pinInputs, confirm: e.target.value.replace(/\D/g, '') })} className="text-center tracking-widest" />
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setPinStep(1)} className="flex-1">Back</Button>
                                <Button onClick={() => pinInputs.pin === pinInputs.confirm ? setPinStep(3) : addToast('error', 'PINs do not match')} className="flex-1">Next</Button>
                            </div>
                        </>
                    )}
                    {pinStep === 3 && (
                        <>
                            <p className="text-sm text-slate-400">Enter login password to authorize.</p>
                            <Input type="password" placeholder="Password" value={pinInputs.password} onChange={e => setPinInputs({ ...pinInputs, password: e.target.value })} />
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setPinStep(2)} className="flex-1">Back</Button>
                                <Button onClick={handlePinSubmit} disabled={pinLoading || !pinInputs.password} className="flex-1">{pinLoading ? 'Saving...' : 'Submit'}</Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Appeal Modal */}
            <Modal isOpen={appealModal} onClose={() => setAppealModal(false)} title="Appeal Suspension">
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">Explain why your suspension should be lifted.</p>
                    <textarea
                        className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white resize-none focus:border-amber-500 outline-none"
                        rows={4}
                        value={appealMessage}
                        onChange={e => setAppealMessage(e.target.value)}
                        placeholder="Reason..."
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setAppealModal(false)} className="flex-1">Cancel</Button>
                        <Button onClick={handleAppealSubmit} disabled={appealLoading || !appealMessage.trim()} className="flex-1">{appealLoading ? 'Sending...' : 'Send Appeal'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

