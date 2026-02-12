import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Shield, Clock, DollarSign, Activity, Eye, EyeOff, RefreshCw, Plus, ArrowUpRight, ArrowDownLeft, Copy, Flag, Info, ChevronRight, Send, Building2, Search, CheckCircle, Loader2, ArrowLeft, FileText } from 'lucide-react';
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
    const [activeAction, setActiveAction] = useState<'deposit' | 'transfer' | 'invest' | null>(null);
    const [amount, setAmount] = useState('');
    const [duration, setDuration] = useState(7);

    // Loading States
    const [actionLoading, setActionLoading] = useState(false);
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

    // ═══════════════════════════════════════
    // TRANSFER FLOW STATE
    // ═══════════════════════════════════════
    const [transferStep, setTransferStep] = useState(1); // 1: Amount, 2: Bank, 3: Description + PIN, 4: Confirm
    const [transferAmount, setTransferAmount] = useState('');
    const [transferPin, setTransferPin] = useState('');
    const [transferDescription, setTransferDescription] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);
    const [showTransferPin, setShowTransferPin] = useState(false);

    // Bank selection state (inline in transfer)
    const [banks, setBanks] = useState<any[]>([]);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankData, setBankData] = useState({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
    const [verifyingAccount, setVerifyingAccount] = useState(false);
    const [accountVerified, setAccountVerified] = useState(false);
    const [selectedExistingBankId, setSelectedExistingBankId] = useState('');

    // Fetch banks on mount
    useEffect(() => {
        paymentApi.getBanks().then(res => setBanks(res.data || [])).catch(console.error);
    }, []);

    // Auto-verify when bank + account filled
    useEffect(() => {
        if (bankData.accountNumber.length === 10 && bankData.bankCode && !selectedExistingBankId) {
            verifyAccountInline();
        } else if (!selectedExistingBankId) {
            setAccountVerified(false);
            setBankData(prev => ({ ...prev, accountName: '' }));
        }
    }, [bankData.accountNumber, bankData.bankCode]);

    const verifyAccountInline = async () => {
        setVerifyingAccount(true);
        setAccountVerified(false);
        try {
            const res = await paymentApi.verifyAccount(bankData.accountNumber, bankData.bankCode);
            setBankData(prev => ({ ...prev, accountName: res.data.accountName }));
            setAccountVerified(true);
        } catch {
            setBankData(prev => ({ ...prev, accountName: '' }));
            addToast('error', 'Could not verify account.');
        } finally {
            setVerifyingAccount(false);
        }
    };

    const filteredBanks = banks.filter((b: any) => b.name?.toLowerCase().includes(bankSearch.toLowerCase()));
    const selectBank = (bank: any) => {
        setBankData(prev => ({ ...prev, accountName: '', bankName: bank.name, bankCode: bank.code }));
        setBankSearch('');
        setShowBankDropdown(false);
        setAccountVerified(false);
    };

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
            setActionLoading(false);
        }
    };

    // ═══════════════════════════════════════
    // TRANSFER HANDLER (multi-step)
    // ═══════════════════════════════════════
    const openTransferFlow = () => {
        setActiveAction('transfer');
        setTransferStep(1);
        setTransferAmount('');
        setTransferPin('');
        setTransferDescription('');
        setSelectedExistingBankId('');
        setBankData({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
        setAccountVerified(false);
        setShowTransferPin(false);
    };

    const handleTransferSubmit = async () => {
        const amt = parseFloat(transferAmount);
        if (!user?.transactionPin) {
            setActiveAction(null);
            setPinModal({ open: true, mode: 'create' });
            return;
        }
        if (!transferPin) {
            addToast('error', 'Please enter your transaction PIN');
            return;
        }

        setTransferLoading(true);
        try {
            const bankId = selectedExistingBankId || undefined;
            // If using a new bank, save it first
            if (!bankId && accountVerified) {
                await userApi.updateBankDetails({
                    bankName: bankData.bankName,
                    bankCode: bankData.bankCode,
                    accountNumber: bankData.accountNumber,
                    accountName: bankData.accountName
                });
                await refreshUser();
            }
            await transactionApi.withdraw(amt, transferPin, bankId);
            addToast('success', 'Transfer submitted successfully');
            await refreshUser();
            setActiveAction(null);
            // Refresh transactions
            const txRes = await transactionApi.getAll(1, 5);
            setTransactions(txRes.data.data);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Transfer failed');
        } finally {
            setTransferLoading(false);
        }
    };

    const canProceedStep1 = () => {
        const amt = parseFloat(transferAmount);
        return amt >= settings.minWithdrawal && amt <= (user?.balance || 0);
    };

    const canProceedStep2 = () => {
        return selectedExistingBankId || accountVerified;
    };

    const canProceedStep3 = () => {
        return transferPin.length === 4;
    };

    const getBankRecipientDisplay = () => {
        if (selectedExistingBankId) {
            const bank = user?.bankDetails?.find((b: any) => b.id === selectedExistingBankId);
            return bank ? `${bank.accountName} • ${bank.bankName}` : '';
        }
        if (accountVerified) {
            return `${bankData.accountName} • ${bankData.bankName}`;
        }
        return '';
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
                                {user.suspensionReason || 'Your account has been suspended.'} You can still receive deposits, but transfers and investments are restricted.
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
                        onClick={openTransferFlow}
                        className="flex items-center gap-3 p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all group text-left"
                    >
                        <div className="p-2 bg-blue-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                            <Send size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="font-bold text-white">Transfer</div>
                            <div className="text-xs text-blue-400">To Bank</div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/investments')}
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


            {/* Featured Carousel */}
            <FeaturedCarousel />

            {/* Content Section: Recent Transactions */}
            <div className="max-w-3xl mx-auto w-full">
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
                        <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h4 className="text-sm font-bold text-white mb-1">Instant Card Funding</h4>
                            <p className="text-xs text-slate-400">Fund your wallet instantly using your debit card.</p>
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

            {/* ═══════════════════════════════════════ */}
            {/* TRANSFER MODAL (Multi-Step) */}
            {/* ═══════════════════════════════════════ */}
            <Modal
                isOpen={activeAction === 'transfer'}
                onClose={() => setActiveAction(null)}
                title={`Transfer${transferStep > 1 ? ` — Step ${transferStep}/4` : ''}`}
            >
                <div className="space-y-4">
                    {/* Step Progress */}
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`flex-1 h-1 rounded-full transition-all ${s <= transferStep ? 'bg-blue-500' : 'bg-slate-800'}`} />
                        ))}
                    </div>

                    {/* STEP 1: Amount */}
                    {transferStep === 1 && (
                        <>
                            <div className="text-center py-2">
                                <p className="text-sm text-slate-400">How much do you want to transfer?</p>
                                <p className="text-xs text-slate-600 mt-1">
                                    Balance: <FormatCurrency amount={user?.balance || 0} /> • Min: ₦{settings.minWithdrawal.toLocaleString()}
                                </p>
                            </div>
                            <Input
                                label="Amount (₦)"
                                type="number"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="Enter amount"
                            />
                            {parseFloat(transferAmount) > (user?.balance || 0) && (
                                <p className="text-xs text-red-400">Insufficient balance</p>
                            )}
                            <Button
                                onClick={() => setTransferStep(2)}
                                disabled={!canProceedStep1()}
                                className="w-full"
                            >
                                Continue
                            </Button>
                        </>
                    )}

                    {/* STEP 2: Bank Details */}
                    {transferStep === 2 && (
                        <>
                            <button onClick={() => setTransferStep(1)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                                <ArrowLeft size={14} /> Back
                            </button>
                            <p className="text-sm text-slate-400">Where should we send <span className="text-white font-bold"><FormatCurrency amount={parseFloat(transferAmount)} /></span>?</p>

                            {/* Existing Bank Accounts */}
                            {user?.bankDetails && user.bankDetails.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saved Accounts</label>
                                    {user.bankDetails.map((b: any) => (
                                        <button
                                            key={b.id}
                                            onClick={() => {
                                                setSelectedExistingBankId(b.id);
                                                setBankData({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
                                                setAccountVerified(false);
                                            }}
                                            className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${selectedExistingBankId === b.id
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                                                }`}
                                        >
                                            <div className="w-9 h-9 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0">
                                                <Building2 size={16} className="text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-white truncate">{b.accountName}</div>
                                                <div className="text-[10px] text-slate-500">{b.accountNumber} • {b.bankName}</div>
                                            </div>
                                            {selectedExistingBankId === b.id && (
                                                <CheckCircle size={16} className="text-blue-400 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Divider */}
                            {user?.bankDetails && user.bankDetails.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-slate-800" />
                                    <span className="text-[10px] text-slate-600 uppercase font-bold">Or new account</span>
                                    <div className="flex-1 h-px bg-slate-800" />
                                </div>
                            )}

                            {/* New Bank Entry */}
                            <div className={`space-y-3 transition-opacity ${selectedExistingBankId ? 'opacity-40' : 'opacity-100'}`}
                                onClick={() => selectedExistingBankId && setSelectedExistingBankId('')}
                            >
                                {/* Bank Selector */}
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Bank</label>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedExistingBankId(''); setShowBankDropdown(!showBankDropdown); }}
                                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-left hover:border-slate-600 transition-colors text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Building2 size={16} className="text-slate-500" />
                                            <span className={bankData.bankName ? 'text-white' : 'text-slate-500'}>{bankData.bankName || 'Choose your bank'}</span>
                                        </div>
                                        <Search size={14} className="text-slate-500" />
                                    </button>
                                    {showBankDropdown && (
                                        <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                                            <div className="p-2">
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500"
                                                    placeholder="Search banks..."
                                                    value={bankSearch}
                                                    onChange={(e) => setBankSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-36 overflow-y-auto">
                                                {filteredBanks.length === 0 ? (
                                                    <div className="px-4 py-3 text-sm text-slate-500">No banks found</div>
                                                ) : filteredBanks.slice(0, 30).map((bank: any) => (
                                                    <button
                                                        key={bank.code}
                                                        onClick={() => selectBank(bank)}
                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${bankData.bankCode === bank.code ? 'bg-amber-500/10 text-amber-400' : 'text-white'}`}
                                                    >
                                                        {bank.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Account Number */}
                                <Input
                                    label="Account Number"
                                    value={bankData.accountNumber}
                                    onChange={(e) => {
                                        setSelectedExistingBankId('');
                                        const val = e.target.value.replace(/\D/g, '');
                                        setBankData({ ...bankData, accountNumber: val });
                                    }}
                                    placeholder="Enter 10-digit account number"
                                    maxLength={10}
                                />

                                {/* Account Name (auto-verified) */}
                                <div className={`px-3 py-2.5 rounded-xl border flex items-center gap-2 text-sm ${accountVerified ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900 border-slate-700'}`}>
                                    {verifyingAccount ? (
                                        <><Loader2 size={14} className="text-amber-400 animate-spin" /><span className="text-slate-400 text-xs">Verifying...</span></>
                                    ) : accountVerified ? (
                                        <><CheckCircle size={14} className="text-emerald-400" /><span className="text-white font-medium text-xs">{bankData.accountName}</span></>
                                    ) : (
                                        <span className="text-xs text-slate-500">{bankData.bankCode && bankData.accountNumber.length === 10 ? 'Could not verify' : 'Select bank & enter account number'}</span>
                                    )}
                                </div>
                            </div>

                            <Button
                                onClick={() => setTransferStep(3)}
                                disabled={!canProceedStep2()}
                                className="w-full"
                            >
                                Continue
                            </Button>
                        </>
                    )}

                    {/* STEP 3: Description + PIN */}
                    {transferStep === 3 && (
                        <>
                            <button onClick={() => setTransferStep(2)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                                <ArrowLeft size={14} /> Back
                            </button>

                            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                                <div className="text-xs text-slate-400">Sending</div>
                                <div className="text-lg font-bold text-white"><FormatCurrency amount={parseFloat(transferAmount)} /></div>
                                <div className="text-xs text-blue-400 mt-0.5">to {getBankRecipientDisplay()}</div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description (optional)</label>
                                <input
                                    type="text"
                                    value={transferDescription}
                                    onChange={(e) => setTransferDescription(e.target.value)}
                                    placeholder="e.g. School fees, Family support..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 placeholder-slate-600"
                                    maxLength={60}
                                />
                            </div>

                            <div className="relative">
                                <Input
                                    label="Transaction PIN"
                                    type={showTransferPin ? 'text' : 'password'}
                                    maxLength={4}
                                    value={transferPin}
                                    onChange={(e) => setTransferPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="****"
                                    className="tracking-widest text-center"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button onClick={() => { setActiveAction(null); setPinModal({ open: true, mode: 'reset' }); }} className="text-xs text-slate-500 hover:text-amber-500">
                                    Forgot PIN?
                                </button>
                            </div>

                            <Button
                                onClick={() => setTransferStep(4)}
                                disabled={!canProceedStep3()}
                                className="w-full"
                            >
                                Review Transfer
                            </Button>
                        </>
                    )}

                    {/* STEP 4: Confirmation */}
                    {transferStep === 4 && (
                        <>
                            <button onClick={() => setTransferStep(3)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                                <ArrowLeft size={14} /> Back
                            </button>

                            <div className="text-center py-2">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Confirm Transfer</p>
                            </div>

                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Amount</span>
                                    <span className="text-white font-bold"><FormatCurrency amount={parseFloat(transferAmount)} /></span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Recipient</span>
                                    <span className="text-white font-semibold text-right text-xs max-w-[180px] break-words">{getBankRecipientDisplay()}</span>
                                </div>
                                {transferDescription && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Description</span>
                                        <span className="text-white text-xs max-w-[180px] break-words">{transferDescription}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">PIN</span>
                                    <span className="text-white font-mono tracking-widest">••••</span>
                                </div>
                            </div>

                            <div className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 flex items-start gap-2">
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <span>Funds will be sent to the recipient's bank account. Processing may take 1–24 hours.</span>
                            </div>

                            <Button
                                onClick={handleTransferSubmit}
                                disabled={transferLoading}
                                className="w-full"
                            >
                                {transferLoading ? 'Processing...' : 'Confirm & Send'}
                            </Button>
                        </>
                    )}
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
