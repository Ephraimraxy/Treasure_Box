import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, DollarSign, Eye, EyeOff, RefreshCw, Plus, Copy, Flag, Info, ChevronRight, Send } from 'lucide-react';
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

export const DashboardPage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showBalance, setShowBalance] = useState(true);

    // Wallet Logic State
    const [activeAction, setActiveAction] = useState<'deposit' | null>(null);
    const [amount, setAmount] = useState('');

    // Loading States
    const [actionLoading, setActionLoading] = useState(false);
    const [accountLoading, setAccountLoading] = useState(false);

    // Settings
    const [settings, setSettings] = useState({
        minDeposit: 1000,
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
                const [txRes, settingsRes] = await Promise.all([
                    transactionApi.getAll(1, 5),
                    userApi.getSettings()
                ]);
                setTransactions(txRes.data.data);
                setSettings(settingsRes.data);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refreshUser();
            const txRes = await transactionApi.getAll(1, 5);
            setTransactions(txRes.data.data);
            addToast('success', 'Dashboard updated');
        } catch (error) {
            addToast('error', 'Failed to refresh');
        } finally {
            setRefreshing(false);
        }
    };

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
            setActionLoading(false);
        }
    };

    // PIN Handlers
    const handlePinSubmit = async () => {
        setPinLoading(true);
        try {
            if (pinInputs.pin !== pinInputs.confirm) {
                addToast('error', 'PINs do not match');
                return;
            }
            if (pinModal.mode === 'create') {
                await userApi.setPin(pinInputs.pin, pinInputs.password);
                addToast('success', 'Transaction PIN set successfully');
            } else {
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

    // Appeal Handler
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
                            <Flag className="text-red-500" size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-red-500 mb-1">Account Suspended</h3>
                            <p className="text-sm text-foreground/80">
                                {user.suspensionReason || 'Your account has been suspended.'} You can still receive deposits, but transfers and investments are restricted.
                            </p>
                            <button onClick={() => setAppealModal(true)} className="mt-2 text-sm text-primary hover:text-primary/80 font-medium underline underline-offset-2">
                                Submit an Appeal →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Balance Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Balance Card - Keeping Dark for Premium Feel */}
                <Card className="md:col-span-2 bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 relative overflow-hidden flex flex-col justify-between border-slate-200 dark:border-slate-700 shadow-xl">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign size={120} className="text-slate-900 dark:text-white" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                {user?.kycPhotoUrl && (
                                    <img src={user.kycPhotoUrl} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-600" />
                                )}
                                <div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">Total Balance</div>
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                                        {showBalance ? <FormatCurrency amount={user?.balance || 0} /> : '*******'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowBalance(!showBalance)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                    {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <button onClick={handleRefresh} className={`p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ${refreshing ? 'animate-spin' : ''}`} disabled={refreshing}>
                                    <RefreshCw size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Virtual Account Info (Compact) */}
                        {user?.virtualAccount ? (
                            <div className="mt-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Virtual Account</div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-slate-900 dark:text-white font-bold font-mono">{user.virtualAccount.accountNumber}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">• {user.virtualAccount.bankName}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">{user.virtualAccount.accountName}</div>
                                </div>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(user.virtualAccount?.accountNumber || ''); addToast('info', 'Copied!'); }}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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

                {/* Quick Actions */}
                <div className="grid grid-rows-3 gap-2">
                    <button
                        onClick={() => { setActiveAction('deposit'); setAmount(''); }}
                        className="flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all group text-left"
                    >
                        <div className="p-2 bg-emerald-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                            <Plus size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="font-bold text-foreground">Deposit</div>
                            <div className="text-xs text-emerald-500">Fund Wallet</div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/transfer')}
                        className="flex items-center gap-3 p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all group text-left"
                    >
                        <div className="p-2 bg-blue-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                            <Send size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="font-bold text-foreground">Transfer</div>
                            <div className="text-xs text-blue-500">To Bank</div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/investments')}
                        className="flex items-center gap-3 p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all group text-left"
                    >
                        <div className="p-2 bg-amber-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                            <TrendingUp size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="font-bold text-foreground">Invest</div>
                            <div className="text-xs text-amber-500">Earn Returns</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Featured Carousel */}
            <FeaturedCarousel />

            {/* Recent Transactions */}
            <div className="max-w-3xl mx-auto w-full">
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <Clock size={18} className="text-muted" /> Recent Activity
                        </h3>
                        <button
                            onClick={() => navigate('/history')}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                            View All <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {transactions.length === 0 ? (
                            <p className="text-muted text-sm text-center py-4">No transactions yet</p>
                        ) : (
                            transactions.map(tx => (
                                <div key={tx.id} className="p-3 bg-surface-highlight rounded-lg border border-border flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-medium text-foreground">{tx.description}</div>
                                        <div className="text-xs text-muted">{new Date(tx.createdAt).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold ${tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {tx.type.includes('DEBIT') || tx.type === 'WITHDRAWAL' ? '-' : '+'} <FormatCurrency amount={tx.amount} />
                                        </div>
                                        <div className={`text-[10px] inline-block px-1.5 rounded ${tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' :
                                            tx.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                                            }`}>{tx.status}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* Deposit Modal */}
            <Modal
                isOpen={activeAction === 'deposit'}
                onClose={() => setActiveAction(null)}
                title="Deposit"
            >
                <div className="space-y-4">
                    <Input
                        label="Amount (₦)"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                    />
                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-start gap-2">
                        <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h4 className="text-sm font-bold text-foreground mb-1">Instant Card Funding</h4>
                            <p className="text-xs text-muted">Fund your wallet instantly using your debit card.</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleDeposit}
                        disabled={actionLoading || !amount}
                        className="w-full"
                    >
                        {actionLoading ? 'Processing...' : 'Confirm Deposit'}
                    </Button>
                </div>
            </Modal>

            {/* PIN Management Modal */}
            <Modal isOpen={pinModal.open} onClose={() => setPinModal({ ...pinModal, open: false })} title={pinModal.mode === 'create' ? 'Set PIN' : 'Reset PIN'}>
                <div className="space-y-4">
                    {pinStep === 1 && (
                        <>
                            <p className="text-sm text-muted">Enter a 4-digit PIN for transactions.</p>
                            <Input type="password" placeholder="Enter PIN" maxLength={4} value={pinInputs.pin} onChange={e => setPinInputs({ ...pinInputs, pin: e.target.value.replace(/\D/g, '') })} className="text-center tracking-widest" />
                            <Button onClick={() => pinInputs.pin.length === 4 ? setPinStep(2) : addToast('error', 'Enter 4 digits')} className="w-full">Next</Button>
                        </>
                    )}
                    {pinStep === 2 && (
                        <>
                            <p className="text-sm text-muted">Confirm your PIN.</p>
                            <Input type="password" placeholder="Confirm PIN" maxLength={4} value={pinInputs.confirm} onChange={e => setPinInputs({ ...pinInputs, confirm: e.target.value.replace(/\D/g, '') })} className="text-center tracking-widest" />
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setPinStep(1)} className="flex-1">Back</Button>
                                <Button onClick={() => pinInputs.pin === pinInputs.confirm ? setPinStep(3) : addToast('error', 'PINs do not match')} className="flex-1">Next</Button>
                            </div>
                        </>
                    )}
                    {pinStep === 3 && (
                        <>
                            <p className="text-sm text-muted">Enter login password to authorize.</p>
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
                    <p className="text-sm text-muted">Explain why your suspension should be lifted.</p>
                    <textarea
                        className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-foreground resize-none focus:border-primary outline-none"
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
