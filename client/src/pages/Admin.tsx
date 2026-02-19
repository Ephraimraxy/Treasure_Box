import React, { useState, useEffect } from 'react'; // rebuild trigger
import { Users, DollarSign, TrendingUp, Clock, Check, X, Shield, Activity, Settings, AlertTriangle, FileText, Search, ExternalLink, MessageSquare, Edit3, Download, Loader2, Zap, Eye, BarChart3, RefreshCw, Heart, Plus, Building, ChevronRight, CheckCircle, Building2, Send, Info, ReceiptText, Wallet } from 'lucide-react';
import { adminApi, paymentApi } from '../api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, FormatCurrency, Spinner, Modal, Input } from '../components/ui';

interface Stats {
    totalUsers: number;
    totalBalance: number;
    activeInvestments: number;
    pendingWithdrawals: number;
    platformProfit: {
        total: number;
        breakdown: {
            quizFees: number;
            systemWins: number;
            investmentProfit: number;
        }
    };
    quizStats?: {
        pendingPool: number;
        activeGames: number;
        completedGames: number;
    };
    financials?: {
        paystackAvailable: number | null;
        paystackPending: number | null;
        snapshotAge: string | null;
        liquidityRatio: number | null;
        netPlatformEquity: number | null;
        totalUserLiability: number;
    };
    risk?: {
        largestWallet: { email: string; username: string | null; name: string | null; balance: number } | null;
        lockedCapital: number;
        upcomingMaturities: { count: number; totalAmount: number };
    };
    profitTimeline?: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        lifetime: number;
    };
    activityFeed?: { id: string; type: string; amount: number; status: string; description: string; user: string; timestamp: string }[];
    systemHealth?: {
        lastWebhookAt: string | null;
        lastSuccessfulTransferAt: string | null;
        lastFailedTransferAt: string | null;
        failedTransferCount24h: number;
    } | null;
}

interface QuizGame {
    id: string;
    mode: 'SOLO' | 'DUEL' | 'LEAGUE';
    matchCode?: string;
    status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
    entryAmount: number;
    platformFee: number;
    prizePool: number;
    maxPlayers: number;
    currentPlayers: number;
    creator?: { username: string; email: string };
    participants: { username: string; email: string; score: number; isWinner: boolean; payout: number }[];
    course: string;
    module: string;
    level: string;
    expiresAt?: string;
    createdAt: string;
    endedAt?: string;
}

interface QuizHistory {
    id: string;
    type: string;
    amount: number;
    status: string;
    description: string;
    userName: string;
    userEmail: string;
    createdAt: string;
}

interface Withdrawal {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    user: {
        email: string;
        name: string;
        bankDetails?: {
            bankName: string;
            accountNumber: string;
            accountName: string;
        };
    };
}

// ═══════════════════════════════════════════════
//  FINANCIAL CONTROL CENTER — Dashboard
// ═══════════════════════════════════════════════

import { FinancialStatementReport } from '../components/reports/FinancialStatementReport';

export const AdminDashboardPage = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [profitModalOpen, setProfitModalOpen] = useState(false);
    const [snapshotLoading, setSnapshotLoading] = useState(false);
    const [snapshotResult, setSnapshotResult] = useState<any>(null);
    const [protectionStatus, setProtectionStatus] = useState<any>(null);
    const [statementLoading, setStatementLoading] = useState(false);
    const [statementRange, setStatementRange] = useState({
        start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Financial Report State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const [agentBalances, setAgentBalances] = useState<{ paystack: { available: number, pending: number, currency: string }, vtpass: { balance: number } } | null>(null);

    const { addToast } = useToast();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await adminApi.getStats();
                setStats(response.data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };
        const fetchProtection = async () => {
            try {
                const res = await adminApi.getProtectionStatus();
                setProtectionStatus(res.data);
            } catch (error) {
                console.error('Failed to fetch protection status:', error);
            }
        };
        const fetchAgentBalances = async () => {
            try {
                const res = await adminApi.getAgentBalances();
                setAgentBalances(res.data);
            } catch (error) {
                console.error('Failed to fetch agent balances:', error);
            }
        };

        fetchStats();
        fetchProtection();
        fetchAgentBalances();
    }, []);

    // Paystack Operations State
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [fundModalOpen, setFundModalOpen] = useState(false);
    const [withdrawStep, setWithdrawStep] = useState(1); // 1=Type+Amount, 2=Bank, 3=Details+PIN, 4=Confirm
    const [withdrawType, setWithdrawType] = useState<'PROFIT' | 'WHOLE'>('PROFIT');
    const [withdrawForm, setWithdrawForm] = useState({ amount: '', bankCode: '', accountNumber: '', accountName: '', description: '', pin: '' });
    const [fundAmount, setFundAmount] = useState('');
    const [processing, setProcessing] = useState(false);
    const [banks, setBanks] = useState<any[]>([]);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [accountVerification, setAccountVerification] = useState<{ loading: boolean, name: string | null, error: string | null }>({ loading: false, name: null, error: null });

    // Fetch banks when modal opens
    useEffect(() => {
        if (withdrawModalOpen && banks.length === 0) {
            paymentApi.getBanks().then(res => setBanks(res.data)).catch(console.error);
        }
    }, [withdrawModalOpen]);

    const handleVerifyAccount = async () => {
        if (!withdrawForm.accountNumber || !withdrawForm.bankCode || withdrawForm.accountNumber.length < 10) return;
        setAccountVerification({ loading: true, name: null, error: null });
        try {
            const res = await paymentApi.verifyAccount(withdrawForm.accountNumber, withdrawForm.bankCode);
            setAccountVerification({ loading: false, name: res.data.accountName, error: null });
            setWithdrawForm(prev => ({ ...prev, accountName: res.data.accountName }));
        } catch (error) {
            setAccountVerification({ loading: false, name: null, error: 'Invalid account' });
        }
    };

    // Auto-verify when account number changes
    useEffect(() => {
        if (withdrawForm.accountNumber.length === 10 && withdrawForm.bankCode) {
            handleVerifyAccount();
        } else {
            setAccountVerification({ loading: false, name: null, error: null });
            setWithdrawForm(prev => ({ ...prev, accountName: '' }));
        }
    }, [withdrawForm.accountNumber, withdrawForm.bankCode]);

    const filteredBanks = banks.filter((b: any) =>
        b.name?.toLowerCase().includes(bankSearch.toLowerCase())
    );

    const selectBank = (bank: any) => {
        setWithdrawForm(prev => ({ ...prev, accountName: '', bankCode: bank.code }));
        setBankSearch('');
        setShowBankDropdown(false);
        setAccountVerification({ loading: false, name: null, error: null });
    };

    // Calculate available balance based on withdrawal type
    const getAvailableBalance = () => {
        if (withdrawType === 'PROFIT') {
            return stats?.platformProfit.total || 0;
        } else {
            return stats?.financials?.paystackAvailable || 0;
        }
    };

    const canProceedStep1 = () => {
        const amt = parseFloat(withdrawForm.amount.replace(/,/g, ''));
        if (isNaN(amt) || amt <= 0) return false;
        const available = getAvailableBalance();
        return amt <= available && amt >= 100; // Minimum 100
    };

    const canProceedStep2 = () => accountVerification.name && withdrawForm.bankCode;
    const canProceedStep3 = () => withdrawForm.pin.length === 4;

    const handleWithdraw = async () => {
        if (!withdrawForm.amount || !withdrawForm.accountNumber || !withdrawForm.bankCode || !withdrawForm.pin) return;
        setProcessing(true);
        try {
            await adminApi.withdrawPaystack({
                amount: parseFloat(withdrawForm.amount),
                bankCode: withdrawForm.bankCode,
                accountNumber: withdrawForm.accountNumber,
                accountName: withdrawForm.accountName,
                description: withdrawForm.description || `Admin ${withdrawType === 'PROFIT' ? 'Profit' : 'Balance'} Withdrawal`,
                withdrawalType: withdrawType,
                pin: withdrawForm.pin
            });
            addToast('success', 'Withdrawal initiated successfully');
            setWithdrawModalOpen(false);
            setWithdrawStep(1);
            setWithdrawForm({ amount: '', bankCode: '', accountNumber: '', accountName: '', description: '', pin: '' });
            setBankSearch('');
            setShowBankDropdown(false);
            // Refresh stats
            const statsRes = await adminApi.getStats();
            setStats(statsRes.data);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Withdrawal failed');
        } finally {
            setProcessing(false);
        }
    };

    const resetWithdrawModal = () => {
        setWithdrawModalOpen(false);
        setWithdrawStep(1);
        setWithdrawForm({ amount: '', bankCode: '', accountNumber: '', accountName: '', description: '', pin: '' });
        setBankSearch('');
        setShowBankDropdown(false);
        setAccountVerification({ loading: false, name: null, error: null });
    };

    const handleFund = async () => {
        if (!fundAmount || parseFloat(fundAmount) < 100) {
            addToast('error', 'Minimum amount is ₦100');
            return;
        }
        setProcessing(true);
        try {
            const res = await adminApi.fundPaystack(parseFloat(fundAmount));
            window.location.href = res.data.authorization_url; // Direct redirect for simplicity
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Funding failed');
            setProcessing(false);
        }
    };

    const handleSnapshot = async () => {
        setSnapshotLoading(true);
        try {
            const res = await adminApi.createSnapshot();
            setSnapshotResult(res.data.summary);
            addToast('success', `Reconciliation: ${res.data.summary.status}`);
            const statsRes = await adminApi.getStats();
            setStats(statsRes.data);
            const protRes = await adminApi.getProtectionStatus();
            setProtectionStatus(protRes.data);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Snapshot failed');
        } finally {
            setSnapshotLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            const { data } = await adminApi.getStatementData(statementRange.start, statementRange.end);
            setReportData(data);
            setShowReportModal(true);
        } catch (error) {
            console.error('Failed to generate report', error);
            addToast('error', 'Failed to generate report');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleDownloadStatement = async () => {
        setStatementLoading(true);
        try {
            const res = await adminApi.downloadStatement(statementRange.start, statementRange.end);
            const blob = new Blob([res.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `TreasureBox_Statement_${statementRange.start}_to_${statementRange.end}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            addToast('success', 'Statement downloaded successfully');
        } catch (error: any) {
            addToast('error', 'Failed to download statement');
        } finally {
            setStatementLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    const fin = stats?.financials;
    const risk = stats?.risk;
    const timeline = stats?.profitTimeline;
    const health = stats?.systemHealth;

    const isHealthy = (date: string | null | undefined, thresholdMinutes = 60) => {
        if (!date) return false;
        const diff = Date.now() - new Date(date).getTime();
        return diff < thresholdMinutes * 60 * 1000;
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-slate-900 dark:text-foreground">Financial Control Center</h1>
                <Button
                    onClick={handleSnapshot}
                    disabled={snapshotLoading}
                    className="text-xs px-3 py-2"
                >
                    {snapshotLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
                    {snapshotLoading ? 'Syncing...' : 'Run Reconciliation'}
                </Button>
            </div>

            {/* ── Capital Protection Banner ── */}
            {protectionStatus && (
                <div className={`p-4 rounded-xl border text-sm flex items-center gap-3 ${protectionStatus.active
                    ? 'bg-red-500/10 dark:bg-red-500/10 border-red-500/30 dark:border-red-500/30 text-red-700 dark:text-red-400'
                    : 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    }`}>
                    <Shield size={18} className="shrink-0" />
                    <span className="font-semibold">
                        Capital Protection: {protectionStatus.active ? '🔴 ACTIVE — Transfers Blocked' : '🟢 Inactive — Transfers Allowed'}
                    </span>
                    {protectionStatus.coverage !== null && (
                        <span className="ml-auto text-xs font-medium opacity-90">
                            Coverage: {protectionStatus.coverage === Infinity ? '∞' : protectionStatus.coverage?.toFixed(2)}x
                            {protectionStatus.threshold && ` / ${protectionStatus.threshold}x threshold`}
                        </span>
                    )}
                    {protectionStatus.recentBlocks > 0 && (
                        <span className="text-xs font-semibold bg-red-500/20 dark:bg-red-500/20 px-2.5 py-1 rounded-full ml-2">
                            {protectionStatus.recentBlocks} blocks (24h)
                        </span>
                    )}
                </div>
            )}

            {/* ── Financial Health ── */}
            {fin && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="text-xs font-bold text-slate-500 dark:text-foreground-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Heart size={12} /> Financial Health
                        </div>
                        <div className="ml-auto flex gap-2">
                            <button onClick={() => setFundModalOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-emerald-500/30 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors">
                                <Plus size={12} /> Fund Balance
                            </button>
                            <button onClick={() => setWithdrawModalOpen(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-border dark:border-border text-slate-700 dark:text-foreground-muted hover:bg-slate-100 dark:hover:bg-surface-highlight transition-colors">
                                <Building size={12} /> Withdraw
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Paystack Available</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">
                                {fin.paystackAvailable !== null ? <FormatCurrency amount={fin.paystackAvailable} /> : <span className="text-slate-400 dark:text-foreground-subtle">N/A</span>}
                            </div>
                            {fin.snapshotAge && <div className="text-[10px] text-slate-400 dark:text-foreground-subtle mt-1.5">Updated: {new Date(fin.snapshotAge).toLocaleString()}</div>}
                        </Card>
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Paystack Pending</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">
                                {fin.paystackPending !== null ? <FormatCurrency amount={fin.paystackPending} /> : <span className="text-slate-400 dark:text-foreground-subtle">N/A</span>}
                            </div>
                        </Card>
                        <Card className={`bg-white dark:bg-surface border ${fin.liquidityRatio !== null && fin.liquidityRatio < 1.2 ? 'border-red-500/50 dark:border-red-500/40' : 'border-slate-200 dark:border-border'}`}>
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Liquidity Ratio</div>
                            <div className={`text-lg font-bold ${fin.liquidityRatio !== null && fin.liquidityRatio < 1.2 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-foreground'}`}>
                                {fin.liquidityRatio !== null ? fin.liquidityRatio.toFixed(2) + 'x' : <span className="text-slate-400 dark:text-foreground-subtle">N/A</span>}
                            </div>
                            {fin.liquidityRatio !== null && fin.liquidityRatio < 1.2 && (
                                <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 mt-1.5 font-bold">
                                    <AlertTriangle size={10} /> BELOW SAFE THRESHOLD
                                </div>
                            )}
                        </Card>
                        <Card className={`bg-white dark:bg-surface border ${fin.netPlatformEquity !== null && fin.netPlatformEquity < 0 ? 'border-red-500/50 dark:border-red-500/40' : 'border-slate-200 dark:border-border'}`}>
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Net Platform Equity</div>
                            <div className={`text-lg font-bold ${fin.netPlatformEquity !== null && fin.netPlatformEquity < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-foreground'}`}>
                                {fin.netPlatformEquity !== null ? <FormatCurrency amount={fin.netPlatformEquity} /> : <span className="text-slate-400 dark:text-foreground-subtle">N/A</span>}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ── Agent Balances ── */}
            {agentBalances && (
                <div className="mb-5">
                    <div className="text-xs font-bold text-slate-500 dark:text-foreground-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Wallet size={12} className="text-indigo-500" /> Agent Wallets
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Paystack (Payout Ready)</div>
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                <FormatCurrency amount={agentBalances.paystack.available} />
                            </div>
                        </Card>
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Paystack (Settlement Pending)</div>
                            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                <FormatCurrency amount={agentBalances.paystack.pending} />
                            </div>
                        </Card>
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">VTPass (Utility Bal)</div>
                            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                <FormatCurrency amount={agentBalances.vtpass.balance} />
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ── Snapshot Result Banner ── */}
            {snapshotResult && (
                <Card className={`border ${snapshotResult.status === 'CRITICAL' ? 'border-red-500/40 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/10' : snapshotResult.status === 'WARNING' ? 'border-amber-500/40 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10' : 'border-emerald-500/40 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${snapshotResult.status === 'CRITICAL' ? 'bg-red-500' : snapshotResult.status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <span className="text-sm font-bold text-slate-900 dark:text-foreground">Reconciliation: {snapshotResult.status}</span>
                        </div>
                        <div className="text-xs font-medium text-slate-600 dark:text-foreground-muted">
                            Diff: <FormatCurrency amount={snapshotResult.difference} />
                            {snapshotResult.liquidityRatio !== null && ` • Ratio: ${snapshotResult.liquidityRatio.toFixed(2)}x`}
                        </div>
                    </div>
                </Card>
            )}

            {/* ── Core Stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <Card
                    className="bg-white dark:bg-surface border border-slate-200 dark:border-border cursor-pointer hover:border-primary/30 dark:hover:border-primary/30 transition-all group"
                    onClick={() => setProfitModalOpen(true)}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/15 rounded-lg group-hover:scale-105 transition-transform">
                            <Activity className="text-indigo-600 dark:text-indigo-400" size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-0.5">Platform Profit</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">
                                <FormatCurrency amount={stats?.platformProfit.total || 0} />
                            </div>
                        </div>
                    </div>
                </Card>
                <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-500/15 rounded-lg">
                            <Users className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-0.5">Total Users</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">{stats?.totalUsers || 0}</div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/15 rounded-lg">
                            <DollarSign className="text-emerald-600 dark:text-emerald-400" size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-0.5">User Liability</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">
                                <FormatCurrency amount={stats?.totalBalance || 0} />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 dark:bg-purple-500/15 rounded-lg">
                            <TrendingUp className="text-purple-600 dark:text-purple-400" size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-0.5">Active Plans</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">{stats?.activeInvestments || 0}</div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-500/15 rounded-lg">
                            <Clock className="text-amber-600 dark:text-amber-400" size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-0.5">Pending Withdrawals</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">{stats?.pendingWithdrawals || 0}</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ── Risk Monitor ── */}
            {risk && (
                <div>
                    <div className="text-xs font-bold text-slate-500 dark:text-foreground-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Shield size={12} /> Risk Monitor
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Largest Wallet (Whale)</div>
                            {risk.largestWallet ? (
                                <>
                                    <div className="text-lg font-bold text-slate-900 dark:text-foreground"><FormatCurrency amount={risk.largestWallet.balance} /></div>
                                    <div className="text-[10px] text-slate-500 dark:text-foreground-subtle truncate mt-1">{risk.largestWallet.username || risk.largestWallet.name || risk.largestWallet.email}</div>
                                </>
                            ) : (
                                <div className="text-slate-400 dark:text-foreground-subtle">No users</div>
                            )}
                        </Card>
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Locked Capital (Active Investments)</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground"><FormatCurrency amount={risk.lockedCapital} /></div>
                        </Card>
                        <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                            <div className="text-xs font-medium text-slate-500 dark:text-foreground-muted mb-1.5">Maturing in 7 Days</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-foreground">{risk.upcomingMaturities.count} plans</div>
                            <div className="text-xs text-slate-500 dark:text-foreground-subtle mt-1"><FormatCurrency amount={risk.upcomingMaturities.totalAmount} /> exposure</div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ── Profit Timeline ── */}
            {timeline && (
                <div>
                    <div className="text-xs font-bold text-slate-500 dark:text-foreground-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <BarChart3 size={12} /> Profit Timeline
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        <Card className="bg-slate-50 dark:bg-surface border border-slate-200 dark:border-border text-center">
                            <div className="text-[10px] font-medium text-slate-500 dark:text-foreground-muted uppercase mb-1.5">Today</div>
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400"><FormatCurrency amount={timeline.today} /></div>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-surface border border-slate-200 dark:border-border text-center">
                            <div className="text-[10px] font-medium text-slate-500 dark:text-foreground-muted uppercase mb-1.5">This Week</div>
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400"><FormatCurrency amount={timeline.thisWeek} /></div>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-surface border border-slate-200 dark:border-border text-center">
                            <div className="text-[10px] font-medium text-slate-500 dark:text-foreground-muted uppercase mb-1.5">This Month</div>
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400"><FormatCurrency amount={timeline.thisMonth} /></div>
                        </Card>
                        <Card className="bg-slate-50 dark:bg-surface border border-slate-200 dark:border-border text-center">
                            <div className="text-[10px] font-medium text-slate-500 dark:text-foreground-muted uppercase mb-1.5">Lifetime</div>
                            <div className="text-sm font-bold text-slate-900 dark:text-foreground"><FormatCurrency amount={timeline.lifetime} /></div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ── System Health + Quiz Stats Row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* System Health */}
                <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                    <div className="text-xs font-bold text-slate-500 dark:text-foreground-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Zap size={12} /> System Health
                    </div>
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-foreground-muted">Webhook</span>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isHealthy(health?.lastWebhookAt) ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="text-xs font-medium text-slate-600 dark:text-foreground-subtle">
                                    {health?.lastWebhookAt ? new Date(health.lastWebhookAt).toLocaleString() : 'Never'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-foreground-muted">Last Transfer</span>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isHealthy(health?.lastSuccessfulTransferAt, 1440) ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className="text-xs font-medium text-slate-600 dark:text-foreground-subtle">
                                    {health?.lastSuccessfulTransferAt ? new Date(health.lastSuccessfulTransferAt).toLocaleString() : 'Never'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-foreground-muted">Failed Transfers (24h)</span>
                            <span className={`text-xs font-bold ${(health?.failedTransferCount24h || 0) > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {health?.failedTransferCount24h || 0}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Quiz Stats */}
                <Card className="bg-white dark:bg-surface border border-slate-200 dark:border-border">
                    <div className="text-xs font-bold text-slate-500 dark:text-foreground-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Activity size={12} /> Quiz Economy
                    </div>
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-foreground-muted">Quiz Pool (Locked)</span>
                            <span className="font-bold text-slate-900 dark:text-foreground"><FormatCurrency amount={stats?.quizStats?.pendingPool || 0} /></span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-foreground-muted">Active Games</span>
                            <span className="font-bold text-slate-900 dark:text-foreground">{stats?.quizStats?.activeGames || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-foreground-muted">Completed Games</span>
                            <span className="font-bold text-slate-900 dark:text-foreground">{stats?.quizStats?.completedGames || 0}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ── Activity Feed ── */}
            {stats?.activityFeed && stats.activityFeed.length > 0 && (
                <div>
                    <div className="text-xs font-bold text-slate-500 dark:text-foreground-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Eye size={12} /> Activity Feed (Last 20)
                    </div>
                    <Card className="bg-white dark:bg-surface max-h-64 overflow-y-auto border border-slate-200 dark:border-border">
                        <div className="space-y-0">
                            {stats.activityFeed.map((item) => (
                                <div key={item.id} className="flex items-center justify-between py-2.5 px-1 border-b border-slate-100 dark:border-border-divider last:border-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                            item.type === 'WITHDRAWAL' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                                                item.type === 'QUIZ_ENTRY' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                                                    item.type === 'QUIZ_WINNING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                        'bg-slate-100 text-slate-600 dark:bg-surface-highlight dark:text-foreground-subtle'
                                            }`}>
                                            {item.type.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-slate-600 dark:text-foreground-muted truncate">{item.user}</span>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                        <div className="text-xs font-bold text-slate-900 dark:text-foreground"><FormatCurrency amount={item.amount} /></div>
                                        <div className="text-[10px] text-slate-400 dark:text-foreground-subtle">{new Date(item.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}

            {/* Profit Breakdown Modal */}
            <Modal isOpen={profitModalOpen} onClose={() => setProfitModalOpen(false)} title="Platform Profit Breakdown">
                <div className="space-y-4">
                    <div className="bg-primary/10 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 p-5 rounded-xl">
                        <div className="text-slate-600 dark:text-foreground-muted text-sm font-medium mb-2">Total Platform Profit</div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-foreground">
                            <FormatCurrency amount={stats?.platformProfit.total || 0} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div className="p-4 bg-slate-50 dark:bg-surface-highlight rounded-xl flex justify-between items-center border border-slate-200 dark:border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-lg">
                                    <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-foreground">Investment Profit</div>
                                    <div className="text-xs text-slate-500 dark:text-foreground-subtle">Computed from matured plans</div>
                                </div>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-foreground">
                                <FormatCurrency amount={stats?.platformProfit.breakdown.investmentProfit || 0} />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-surface-highlight rounded-xl flex justify-between items-center border border-slate-200 dark:border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/15 rounded-lg">
                                    <Activity size={18} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-foreground">Quiz Fees</div>
                                    <div className="text-xs text-slate-500 dark:text-foreground-subtle">Platform commission</div>
                                </div>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-foreground">
                                <FormatCurrency amount={stats?.platformProfit.breakdown.quizFees || 0} />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-surface-highlight rounded-xl flex justify-between items-center border border-slate-200 dark:border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/15 rounded-lg">
                                    <Shield size={18} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-foreground">System Wins</div>
                                    <div className="text-xs text-slate-500 dark:text-foreground-subtle">Solo mode losses</div>
                                </div>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-foreground">
                                <FormatCurrency amount={stats?.platformProfit.breakdown.systemWins || 0} />
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* ── Financial Statement Export ── */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Financial Statement Export</h3>
                </div>
                <p className="text-xs text-slate-400 mb-3">Generate and download a detailed financial transcript including all transactions, investments, risk events, and platform metrics for the selected period.</p>
                <div className="flex flex-wrap items-end gap-3 mt-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                        <Input
                            type="date"
                            value={statementRange.start}
                            onChange={(e) => setStatementRange({ ...statementRange, start: e.target.value })}
                            className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-9 focus:ring-amber-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">End Date</label>
                        <Input
                            type="date"
                            value={statementRange.end}
                            onChange={(e) => setStatementRange({ ...statementRange, end: e.target.value })}
                            className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white h-9 focus:ring-amber-500"
                        />
                    </div>
                    <Button onClick={handleGenerateReport} disabled={isGeneratingReport} variant="primary" className="h-9">
                        {isGeneratingReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                        Preview Report
                    </Button>
                    <Button onClick={handleDownloadStatement} disabled={statementLoading} variant="outline" className="h-9 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">
                        {statementLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Download CSV
                    </Button>
                </div>
            </Card>

            {/* Financial Report Modal */}
            {showReportModal && reportData && (
                <FinancialStatementReport
                    data={reportData}
                    onClose={() => setShowReportModal(false)}
                />
            )}

            {/* Paystack Withdraw Modal - Multi-step */}
            <Modal isOpen={withdrawModalOpen} onClose={resetWithdrawModal} title="Withdraw Funds">
                <div className="space-y-4">
                    {/* Step Indicator */}
                    <div className="flex items-center gap-1 mb-4">
                        {['Type & Amount', 'Bank', 'Details', 'Confirm'].map((label, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className={`w-full h-1 rounded-full transition-all ${i + 1 <= withdrawStep ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${i + 1 === withdrawStep ? 'text-amber-500' : i + 1 < withdrawStep ? 'text-amber-500/50' : 'text-slate-400 dark:text-slate-500'}`}>{label}</span>
                            </div>
                        ))}
                    </div>

                    {/* STEP 1: Withdrawal Type & Amount */}
                    {withdrawStep === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Withdrawal Type</label>
                                <select
                                    value={withdrawType}
                                    onChange={(e) => {
                                        setWithdrawType(e.target.value as 'PROFIT' | 'WHOLE');
                                        setWithdrawForm(prev => ({ ...prev, amount: '' }));
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
                                >
                                    <option value="PROFIT">Platform Profit Only</option>
                                    <option value="WHOLE">Whole Money in System (Paystack Balance)</option>
                                </select>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                    {withdrawType === 'PROFIT'
                                        ? 'Withdraw only platform profit (quiz fees, system wins, investment profit)'
                                        : 'Withdraw from entire Paystack balance'}
                                </p>
                            </div>

                            <div>
                                <div className="text-center mb-3">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Available Balance</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                                        <FormatCurrency amount={getAvailableBalance()} />
                                    </p>
                                </div>

                                <Input
                                    label="Amount (₦)"
                                    type="number"
                                    value={withdrawForm.amount}
                                    onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                                    placeholder="0"
                                />

                                {(() => {
                                    const amt = parseFloat(withdrawForm.amount.replace(/,/g, ''));
                                    const available = getAvailableBalance();
                                    if (!withdrawForm.amount) return null;
                                    if (isNaN(amt)) return <p className="text-xs text-red-400 mt-1">Invalid amount</p>;
                                    if (amt > available) return <p className="text-xs text-red-400 mt-1">Insufficient balance</p>;
                                    if (amt < 100) return <p className="text-xs text-red-400 mt-1">Minimum withdrawal is ₦100</p>;
                                    return null;
                                })()}

                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center">
                                    Min: ₦100 • Max: <FormatCurrency amount={getAvailableBalance()} />
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={resetWithdrawModal} className="flex-1">Cancel</Button>
                                <Button onClick={() => setWithdrawStep(2)} disabled={!canProceedStep1()} className="flex-1">Continue</Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Bank Details */}
                    {withdrawStep === 2 && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Where should we send <span className="text-amber-500 font-bold"><FormatCurrency amount={parseFloat(withdrawForm.amount)} /></span>?
                            </p>

                            {/* Bank Selector */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Select Bank</label>
                                <button
                                    type="button"
                                    onClick={() => setShowBankDropdown(!showBankDropdown)}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-left hover:border-amber-500/50 transition-colors text-sm"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Building2 size={16} className="text-slate-400 dark:text-slate-500" />
                                        <span className={withdrawForm.bankCode ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'}>
                                            {banks.find((b: any) => b.code === withdrawForm.bankCode)?.name || 'Choose your bank'}
                                        </span>
                                    </div>
                                    <ChevronRight size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${showBankDropdown ? 'rotate-90' : ''}`} />
                                </button>

                                {showBankDropdown && (
                                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                                        <div className="p-2">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                                <input
                                                    type="text"
                                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500"
                                                    placeholder="Search banks..."
                                                    value={bankSearch}
                                                    onChange={(e) => setBankSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto">
                                            {filteredBanks.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">No banks found</div>
                                            ) : filteredBanks.slice(0, 30).map((bank: any) => (
                                                <button
                                                    key={bank.code}
                                                    onClick={() => selectBank(bank)}
                                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between ${withdrawForm.bankCode === bank.code ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}
                                                >
                                                    {bank.name}
                                                    {withdrawForm.bankCode === bank.code && <CheckCircle size={14} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Account Number */}
                            <div>
                                <Input
                                    label="Account Number"
                                    value={withdrawForm.accountNumber}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setWithdrawForm({ ...withdrawForm, accountNumber: val });
                                    }}
                                    placeholder="Enter 10-digit account number"
                                    maxLength={10}
                                />
                            </div>

                            {/* Account Verification Status */}
                            <div className={`px-4 py-3 rounded-xl border flex items-center gap-2.5 ${accountVerification.name
                                ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/20'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                }`}>
                                {accountVerification.loading ? (
                                    <><Loader2 size={16} className="text-amber-500 animate-spin" /><span className="text-slate-400 dark:text-slate-500 text-xs">Verifying account...</span></>
                                ) : accountVerification.name ? (
                                    <>
                                        <div className="w-8 h-8 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                                            <Users size={14} className="text-emerald-500 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <div className="text-slate-900 dark:text-white font-semibold text-sm">{accountVerification.name}</div>
                                            <div className="text-[10px] text-emerald-500 dark:text-emerald-400">✓ Account verified</div>
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                        {withdrawForm.bankCode && withdrawForm.accountNumber.length === 10
                                            ? 'Could not verify account'
                                            : 'Select a bank & enter account number to verify'}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setWithdrawStep(1)} className="flex-1">Back</Button>
                                <Button onClick={() => setWithdrawStep(3)} disabled={!canProceedStep2()} className="flex-1">Continue</Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Description + PIN */}
                    {withdrawStep === 3 && (
                        <div className="space-y-4">
                            {/* Transfer Summary Card */}
                            <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/20 p-4 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">Sending</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white"><FormatCurrency amount={parseFloat(withdrawForm.amount)} /></div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{accountVerification.name}</div>
                                        <div className="text-[10px] text-amber-400 dark:text-amber-500">{withdrawForm.accountNumber} • {banks.find((b: any) => b.code === withdrawForm.bankCode)?.name}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Description <span className="text-slate-400 dark:text-slate-500">(optional)</span></label>
                                <input
                                    type="text"
                                    value={withdrawForm.description}
                                    onChange={(e) => setWithdrawForm({ ...withdrawForm, description: e.target.value })}
                                    placeholder="e.g. Monthly Profit Withdrawal"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    maxLength={60}
                                />
                            </div>

                            {/* PIN */}
                            <div>
                                <Input
                                    label="Transaction PIN"
                                    type="password"
                                    maxLength={4}
                                    value={withdrawForm.pin}
                                    onChange={(e) => setWithdrawForm({ ...withdrawForm, pin: e.target.value.replace(/\D/g, '') })}
                                    placeholder="Enter 4-digit PIN"
                                    className="tracking-[0.3em] text-center text-lg"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setWithdrawStep(2)} className="flex-1">Back</Button>
                                <Button onClick={() => setWithdrawStep(4)} disabled={!canProceedStep3()} className="flex-1">Review</Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Confirmation */}
                    {withdrawStep === 4 && (
                        <div className="space-y-4">
                            <div className="text-center mb-4">
                                <div className="w-14 h-14 bg-amber-500/10 dark:bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Send size={24} className="text-amber-500 dark:text-amber-400" />
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-widest">Review & Confirm</p>
                            </div>

                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                                {[
                                    { label: 'Withdrawal Type', value: <span className="text-xs font-bold">{withdrawType === 'PROFIT' ? 'Platform Profit Only' : 'Whole Money in System'}</span> },
                                    { label: 'Amount', value: <span className="font-bold font-mono"><FormatCurrency amount={parseFloat(withdrawForm.amount)} /></span> },
                                    { label: 'Recipient', value: <span className="text-xs">{accountVerification.name}</span> },
                                    { label: 'Account', value: <span className="font-mono text-xs">{withdrawForm.accountNumber}</span> },
                                    { label: 'Bank', value: <span className="text-xs">{banks.find((b: any) => b.code === withdrawForm.bankCode)?.name}</span> },
                                    ...(withdrawForm.description ? [{ label: 'Description', value: <span className="text-xs">{withdrawForm.description}</span> }] : []),
                                    { label: 'PIN', value: <span className="font-mono tracking-widest">••••</span> },
                                ].map((row, i) => (
                                    <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700 last:border-0">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{row.label}</span>
                                        <span className="text-slate-900 dark:text-white">{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="text-xs text-amber-400 dark:text-amber-500 bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 dark:border-amber-500/20 flex items-start gap-2">
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <span>Funds will be sent to the recipient's bank account. Processing may take 1–24 hours.</span>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => setWithdrawStep(3)} className="flex-1">Back</Button>
                                <Button
                                    onClick={handleWithdraw}
                                    disabled={processing}
                                    className="flex-1"
                                >
                                    {processing ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                                        </span>
                                    ) : (
                                        'Confirm & Send'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Paystack Fund Modal */}
            <Modal isOpen={fundModalOpen} onClose={() => setFundModalOpen(false)} title="Fund Paystack Balance">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Add funds to your Paystack balance to ensure liquidity for withdrawals and payouts. This will redirect you to Paystack secure checkout.
                    </p>
                    <Input
                        label="Amount to Fund (₦)"
                        type="number"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(e.target.value)}
                        placeholder="e.g. 100000"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setFundModalOpen(false)} className="flex-1">Cancel</Button>
                        <Button onClick={handleFund} disabled={processing || !fundAmount} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
                            {processing ? 'Redirecting...' : 'Proceed to Payment'}
                        </Button>
                    </div>
                </div>
            </Modal>

        </div >
    );
};

export const AdminWithdrawalsPage = () => {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const { addToast } = useToast();

    const fetchWithdrawals = async () => {
        try {
            const response = await adminApi.getPendingWithdrawals();
            setWithdrawals(response.data);
        } catch (error) {
            console.error('Failed to fetch withdrawals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWithdrawals();
    }, []);

    const handleApprove = async (id: string) => {
        setProcessing(id);
        try {
            await adminApi.approveWithdrawal(id);
            addToast('success', 'Withdrawal approved');
            fetchWithdrawals();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to approve');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModal || !rejectReason) return;
        setProcessing(rejectModal);
        try {
            await adminApi.rejectWithdrawal(rejectModal, rejectReason);
            addToast('success', 'Withdrawal rejected and refunded');
            setRejectModal(null);
            setRejectReason('');
            fetchWithdrawals();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to reject');
        } finally {
            setProcessing(null);
        }
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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Pending Withdrawals</h1>

            {withdrawals.length === 0 ? (
                <Card className="text-center py-12">
                    <Clock className="mx-auto text-slate-600 mb-4" size={48} />
                    <p className="text-slate-500">No pending withdrawals</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {withdrawals.map((w) => (
                        <Card key={w.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">{w.user.name || w.user.email}</div>
                                <div className="text-sm text-slate-400">{w.user.email}</div>
                                {w.user.bankDetails && (
                                    <div className="text-xs text-slate-500 mt-1">
                                        {w.user.bankDetails.bankName} • {w.user.bankDetails.accountNumber}
                                    </div>
                                )}
                                <div className="text-xs text-slate-600 mt-1">
                                    {new Date(w.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-bold text-amber-500 mb-2">
                                    <FormatCurrency amount={w.amount} />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="success"
                                        onClick={() => handleApprove(w.id)}
                                        disabled={processing === w.id}
                                        className="px-3 py-2 text-sm"
                                    >
                                        <Check size={16} /> Approve
                                    </Button>
                                    <Button
                                        variant="danger"
                                        onClick={() => setRejectModal(w.id)}
                                        disabled={processing === w.id}
                                        className="px-3 py-2 text-sm"
                                    >
                                        <X size={16} /> Reject
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Withdrawal">
                <div className="space-y-4">
                    <p className="text-slate-400 text-sm">
                        Please provide a reason for rejection. The user will be notified and funds will be refunded.
                    </p>
                    <Input
                        label="Reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Invalid bank details"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setRejectModal(null)} className="flex-1">
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={handleReject} disabled={!rejectReason} className="flex-1">
                            Reject & Refund
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// ═══════════════════════════════════════════════
//  ADMIN TRANSACTIONS EXPLORER
// ═══════════════════════════════════════════════

type AdminTxStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
type AdminTxType = 'DEPOSIT' | 'WITHDRAWAL' | 'INVESTMENT_PAYOUT' | 'INVESTMENT_DEBIT' | 'UTILITY_BILL' | 'REFERRAL_BONUS' | 'all';

interface AdminTx {
    id: string;
    userId: string;
    type: string;
    amount: number;
    status: AdminTxStatus;
    description: string;
    rejectionReason?: string | null;
    meta?: any;
    createdAt: string;
    updatedAt: string;
    user: {
        id: string;
        email: string;
        name?: string | null;
        username?: string | null;
        balance: number;
        isSuspended?: boolean;
        suspensionReason?: string | null;
    };
}

export const AdminTransactionsPage = () => {
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AdminTx[]>([]);
    const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);

    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [status, setStatus] = useState<'all' | AdminTxStatus>('all');
    const [type, setType] = useState<AdminTxType>('all');
    const [provider, setProvider] = useState<'all' | 'paystack' | 'vtpass' | 'dataverify' | 'system'>('all');
    const [q, setQ] = useState('');
    const [range, setRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState<{ transaction: AdminTx; timeline: { at: string; label: string; details?: string }[] } | null>(null);

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [reason, setReason] = useState('');

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getTransactions({
                page,
                limit,
                status,

                type,
                provider,
                q: q.trim() || undefined,
                start: range.start || undefined,
                end: range.end || undefined
            });
            setData(res.data.data || []);
            setMeta(res.data.meta || null);
        } catch (e: any) {
            addToast('error', e?.response?.data?.error || 'Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    const openDetails = async (id: string) => {
        setSelectedId(id);
        setDetail(null);
        setNote('');
        setReason('');
        setDetailLoading(true);
        try {
            const res = await adminApi.getTransaction(id);
            setDetail(res.data);
            const existingNote = res.data?.transaction?.meta?.adminNote;
            if (existingNote) setNote(existingNote);
        } catch (e: any) {
            addToast('error', e?.response?.data?.error || 'Failed to load transaction');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, status, type, provider]);

    const handleSearch = () => {
        setPage(1);
        fetchList();
    };

    const runPendingRequery = async () => {
        setActionLoading('requeryPending');
        try {
            await adminApi.requeryPending();
            addToast('success', 'Pending requery completed');
            fetchList();
            if (selectedId) openDetails(selectedId);
        } catch (e: any) {
            addToast('error', e?.response?.data?.error || 'Requery failed');
        } finally {
            setActionLoading(null);
        }
    };

    const action = async (kind: 'note' | 'refund' | 'forceFail' | 'forceSuccess' | 'requery') => {
        if (!selectedId) return;
        setActionLoading(kind);
        try {
            if (kind === 'note') {
                await adminApi.addTransactionNote(selectedId, note);
                addToast('success', 'Note saved');
            }
            if (kind === 'refund') {
                await adminApi.refundTransaction(selectedId, reason);
                addToast('success', 'Refund completed');
            }
            if (kind === 'forceFail') {
                await adminApi.forceFailTransaction(selectedId, reason);
                addToast('success', 'Transaction marked failed');
            }
            if (kind === 'forceSuccess') {
                await adminApi.forceSuccessTransaction(selectedId, reason);
                addToast('success', 'Transaction marked success');
            }
            if (kind === 'requery') {
                await adminApi.requeryTransaction(selectedId);
                addToast('success', 'Requery executed');
            }

            await fetchList();
            await openDetails(selectedId);
        } catch (e: any) {
            addToast('error', e?.response?.data?.error || 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ReceiptText size={18} /> Transactions
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Search, inspect, and take audited actions on transactions.</p>
                </div>
                <Button onClick={runPendingRequery} disabled={actionLoading === 'requeryPending'} className="text-xs">
                    {actionLoading === 'requeryPending' ? 'Running...' : 'Requery Pending (Safety Net)'}
                </Button>
            </div>

            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                        <Input
                            label="Search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Tx ID, User ID, email, Paystack ref..."
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            className="mt-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                        >
                            <option value="all">All</option>
                            <option value="PENDING">Pending</option>
                            <option value="SUCCESS">Success</option>
                            <option value="FAILED">Failed</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider">Provider</label>
                        <select
                            value={provider}
                            onChange={(e) => setProvider(e.target.value as any)}
                            className="mt-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                        >
                            <option value="all">All Providers</option>
                            <option value="paystack">Paystack</option>
                            <option value="vtpass">VTPass</option>
                            <option value="dataverify">DataVerify</option>
                            <option value="system">System</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted uppercase tracking-wider">Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="mt-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                        >
                            <option value="all">All</option>
                            <option value="DEPOSIT">Deposit</option>
                            <option value="WITHDRAWAL">Withdrawal</option>
                            <option value="INVESTMENT_DEBIT">Investment Debit</option>
                            <option value="INVESTMENT_PAYOUT">Investment Payout</option>
                            <option value="UTILITY_BILL">Utility Bill</option>
                            <option value="REFERRAL_BONUS">Referral Bonus</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <Button onClick={handleSearch} className="w-full">Search</Button>
                    </div>
                </div >

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <Input
                        label="Start Date (optional)"
                        type="date"
                        value={range.start}
                        onChange={(e) => setRange({ ...range, start: e.target.value })}
                    />
                    <Input
                        label="End Date (optional)"
                        type="date"
                        value={range.end}
                        onChange={(e) => setRange({ ...range, end: e.target.value })}
                    />
                </div>
            </Card >

            {
                loading ? (
                    <div className="flex items-center justify-center h-64" > <Spinner /></div>
                ) : data.length === 0 ? (
                    <Card className="text-center py-12">
                        <p className="text-slate-500">No transactions found.</p>
                    </Card>
                ) : (
                    <Card className="p-0 overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {data.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => openDetails(t.id)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900 dark:text-white">{t.type}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : t.status === 'FAILED' ? 'bg-red-500/15 text-red-700 dark:text-red-400' : t.status === 'REJECTED' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400' : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'}`}>
                                                    {t.status}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    {t.user.name || t.user.username || t.user.email}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                {t.id} • {new Date(t.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                <FormatCurrency amount={t.amount} />
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{t.description}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </Card>
                )}

            {
                meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            Page {meta.page} of {meta.totalPages} • {meta.total} total
                        </span>
                        <Button variant="ghost" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                    </div>
                )
            }

            <Modal isOpen={!!selectedId} onClose={() => setSelectedId(null)} title="Transaction Details">
                {detailLoading ? (
                    <div className="flex items-center justify-center h-48"><Spinner /></div>
                ) : !detail ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No details.</div>
                ) : (
                    <div className="space-y-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white">{detail.transaction.type} • <FormatCurrency amount={detail.transaction.amount} /></div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{detail.transaction.id}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                        User: {detail.transaction.user.name || detail.transaction.user.username || detail.transaction.user.email} • Balance: <FormatCurrency amount={detail.transaction.user.balance} />
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${detail.transaction.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : detail.transaction.status === 'FAILED' ? 'bg-red-500/15 text-red-700 dark:text-red-400' : detail.transaction.status === 'REJECTED' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400' : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'}`}>
                                    {detail.transaction.status}
                                </span>
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Card className="p-4">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Timeline</div>
                                <div className="space-y-2">
                                    {detail.timeline?.length ? detail.timeline
                                        .slice()
                                        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                                        .map((e, i) => (
                                            <div key={i} className="text-xs">
                                                <div className="text-slate-900 dark:text-white font-semibold">{e.label}</div>
                                                <div className="text-slate-500 dark:text-slate-400">{new Date(e.at).toLocaleString()} {e.details ? `• ${e.details}` : ''}</div>
                                            </div>
                                        )) : (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">No timeline events.</div>
                                    )}
                                </div>
                            </Card>

                            <Card className="p-4">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Paystack refs</div>
                                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                    <div><span className="text-slate-500 dark:text-slate-400">reference:</span> {detail.transaction.meta?.reference || '-'}</div>
                                    <div><span className="text-slate-500 dark:text-slate-400">paystackReference:</span> {detail.transaction.meta?.paystackReference || '-'}</div>
                                    <div><span className="text-slate-500 dark:text-slate-400">transferCode:</span> {detail.transaction.meta?.transferCode || '-'}</div>
                                    <div><span className="text-slate-500 dark:text-slate-400">transferFinalEvent:</span> {detail.transaction.meta?.transferFinalEvent || '-'}</div>
                                </div>
                            </Card>
                        </div>

                        <Card className="p-4 space-y-3">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Actions (Audited)</div>

                            <Input
                                label="Admin Note"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add an internal note..."
                            />
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => action('note')} disabled={actionLoading === 'note' || !note.trim()} className="flex-1">
                                    {actionLoading === 'note' ? 'Saving...' : 'Save Note'}
                                </Button>
                                <Button variant="outline" onClick={() => action('requery')} disabled={actionLoading === 'requery'} className="flex-1">
                                    {actionLoading === 'requery' ? 'Running...' : 'Requery'}
                                </Button>
                            </div>

                            <Input
                                label="Reason (required for refund/force)"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Explain why you are taking this action..."
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <Button
                                    variant="danger"
                                    onClick={() => action('refund')}
                                    disabled={actionLoading === 'refund' || !reason.trim()}
                                >
                                    {actionLoading === 'refund' ? 'Working...' : 'Manual Refund (Withdrawal)'}
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => action('forceFail')}
                                    disabled={actionLoading === 'forceFail' || !reason.trim()}
                                >
                                    {actionLoading === 'forceFail' ? 'Working...' : 'Force Fail'}
                                </Button>
                                <Button
                                    onClick={() => action('forceSuccess')}
                                    disabled={actionLoading === 'forceSuccess' || !reason.trim()}
                                >
                                    {actionLoading === 'forceSuccess' ? 'Working...' : 'Force Success (Deposit)'}
                                </Button>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Safety rules: refunds only apply to pending withdrawals; force success only allowed for deposits.
                            </p>
                        </Card>
                    </div>
                )}
            </Modal>
        </div >
    );
};

export const AdminUsersPage = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const { addToast } = useToast();

    // Modal states
    const [editUser, setEditUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
    const [deleteUser, setDeleteUser] = useState<any>(null);
    const [suspendUser, setSuspendUser] = useState<any>(null);
    const [suspendReason, setSuspendReason] = useState('');

    const fetchUsers = async () => {
        try {
            const response = await adminApi.getUsers();
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleEdit = async () => {
        if (!editUser) return;
        setProcessing(true);
        try {
            await adminApi.updateUser(editUser.id, editForm);
            addToast('success', 'User updated');
            setEditUser(null);
            fetchUsers();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Update failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setProcessing(true);
        try {
            await adminApi.deleteUser(deleteUser.id);
            addToast('success', 'User deleted');
            setDeleteUser(null);
            fetchUsers();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Delete failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleSuspendToggle = async () => {
        if (!suspendUser) return;
        setProcessing(true);
        const willSuspend = !suspendUser.isSuspended;
        try {
            await adminApi.toggleSuspension(suspendUser.id, willSuspend, suspendReason);
            addToast('success', willSuspend ? 'User suspended' : 'User unsuspended');
            setSuspendUser(null);
            setSuspendReason('');
            fetchUsers();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed');
        } finally {
            setProcessing(false);
        }
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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Users ({users.length})</h1>

            <div className="space-y-3">
                {users.map((user) => (
                    <Card key={user.id} className={`relative ${user.isSuspended ? 'border border-red-500/30' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white truncate">{user.name || user.email}</span>
                                    {user.isSuspended && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold whitespace-nowrap">
                                            <AlertTriangle size={10} /> SUSPENDED
                                        </span>
                                    )}
                                    {user.role === 'ADMIN' && (
                                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold">ADMIN</span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-400 truncate">{user.email}</div>
                                {user.username && <div className="text-xs text-slate-500">@{user.username}</div>}
                                <div className="text-xs text-slate-600 mt-1">
                                    Joined: {new Date(user.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-bold text-slate-900 dark:text-white">
                                    <FormatCurrency amount={user.balance} />
                                </div>
                                <div className={`text-xs uppercase font-bold ${user.kycVerified ? 'text-emerald-400' :
                                    user.emailVerified ? 'text-blue-400' : 'text-slate-500'
                                    }`}>
                                    {user.kycVerified ? 'KYC Verified' : user.emailVerified ? 'Verified' : 'Unverified'}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {user.role !== 'ADMIN' && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                                <button
                                    onClick={() => {
                                        setEditUser(user);
                                        setEditForm({ name: user.name || '', email: user.email, phone: user.phone || '' });
                                    }}
                                    className="flex-1 text-xs py-2 px-3 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        setSuspendUser(user);
                                        setSuspendReason('');
                                    }}
                                    className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors ${user.isSuspended
                                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                        }`}
                                >
                                    {user.isSuspended ? 'Unsuspend' : 'Suspend'}
                                </button>
                                <button
                                    onClick={() => setDeleteUser(user)}
                                    className="flex-1 text-xs py-2 px-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {/* Edit Modal */}
            <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
                <div className="space-y-4">
                    <Input
                        label="Name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Full name"
                    />
                    <Input
                        label="Email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="Email address"
                    />
                    <Input
                        label="Phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Phone number"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setEditUser(null)} className="flex-1">Cancel</Button>
                        <Button onClick={handleEdit} disabled={processing} className="flex-1">
                            {processing ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User">
                <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                            <AlertTriangle size={18} />
                            <span className="font-bold">Irreversible Action</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            This will permanently delete <strong className="text-slate-900 dark:text-white">{deleteUser?.name || deleteUser?.email}</strong> and all their data (transactions, investments, virtual account).
                        </p>
                        {deleteUser?.balance > 0 && (
                            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <p className="text-sm text-amber-400">
                                    ⚠ This user has a balance of <strong><FormatCurrency amount={deleteUser.balance} /></strong>
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setDeleteUser(null)} className="flex-1">Cancel</Button>
                        <Button variant="danger" onClick={handleDelete} disabled={processing} className="flex-1">
                            {processing ? 'Deleting...' : 'Delete Permanently'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Suspend Modal */}
            <Modal
                isOpen={!!suspendUser}
                onClose={() => setSuspendUser(null)}
                title={suspendUser?.isSuspended ? 'Unsuspend User' : 'Suspend User'}
            >
                <div className="space-y-4">
                    {suspendUser?.isSuspended ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Remove suspension from <strong className="text-slate-900 dark:text-white">{suspendUser?.name || suspendUser?.email}</strong>?
                            They will regain full access to withdrawals, investments, and services.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Suspend <strong className="text-slate-900 dark:text-white">{suspendUser?.name || suspendUser?.email}</strong>?
                                They will be unable to withdraw, invest, or purchase services. Deposits will still work.
                            </p>
                            <Input
                                label="Reason"
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="e.g. Suspicious activity"
                            />
                        </>
                    )}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setSuspendUser(null)} className="flex-1">Cancel</Button>
                        <Button
                            variant={suspendUser?.isSuspended ? 'success' : 'danger'}
                            onClick={handleSuspendToggle}
                            disabled={processing || (!suspendUser?.isSuspended && !suspendReason)}
                            className="flex-1"
                        >
                            {processing ? 'Processing...' : suspendUser?.isSuspended ? 'Unsuspend' : 'Suspend User'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export const AdminAuditPage = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await adminApi.getAuditLogs();
                setLogs(response.data);
            } catch (error) {
                console.error('Failed to fetch logs:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Audit Logs</h1>

            {logs.length === 0 ? (
                <Card className="text-center py-12">
                    <p className="text-slate-500">No audit logs yet</p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {logs.map((log) => (
                        <Card key={log.id} className="p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white">{log.action}</div>
                                    <div className="text-sm text-slate-400">{log.details}</div>
                                    <div className="text-xs text-slate-600 mt-1">By: {log.adminEmail}</div>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════
//  ADMIN QUIZ PAGE
// ═══════════════════════════════════════════════

export const AdminQuizPage = () => {
    const [view, setView] = useState<'games' | 'history'>('games');
    const [games, setGames] = useState<QuizGame[]>([]);
    const [history, setHistory] = useState<QuizHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>({});
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        if (view === 'games') fetchGames();
        else fetchHistory();
    }, [view, page, filterStatus]);

    const fetchGames = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getQuizGames(page, filterStatus);
            setGames(res.data.data);
            setMeta(res.data.meta);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getQuizHistory(page);
            setHistory(res.data.data);
            setMeta(res.data.meta);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quiz Management</h2>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => { setView('games'); setPage(1); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'games' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Active Games
                    </button>
                    <button
                        onClick={() => { setView('history'); setPage(1); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Full History
                    </button>
                </div>
            </div>

            {view === 'games' && (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700 outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="WAITING">Waiting</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="EXPIRED">Expired</option>
                        </select>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase">
                                    <tr>
                                        <th className="p-4">Game Info</th>
                                        <th className="p-4">Creator</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Pool / Fee</th>
                                        <th className="p-4">Participants</th>
                                        <th className="p-4">Age</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {loading ? (
                                        <tr><td colSpan={6} className="p-8 text-center"><Spinner /></td></tr>
                                    ) : games.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-500">No games found</td></tr>
                                    ) : (
                                        games.map(game => (
                                            <tr key={game.id} className="hover:bg-slate-800/30">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-900 dark:text-white text-sm">{game.mode}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{game.matchCode || '-'}</div>
                                                    <div className="text-[10px] text-slate-400">{game.level}</div>
                                                </td>
                                                <td className="p-4">
                                                    {game.creator ? (
                                                        <>
                                                            <div className="text-sm text-slate-900 dark:text-white">{game.creator.username}</div>
                                                            <div className="text-xs text-slate-500">{game.creator.email}</div>
                                                        </>
                                                    ) : <span className="text-slate-500">-</span>}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold
                                                        ${game.status === 'WAITING' ? 'bg-amber-500/20 text-amber-500' :
                                                            game.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-500' :
                                                                game.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-500' :
                                                                    game.status === 'EXPIRED' ? 'bg-red-500/20 text-red-500' :
                                                                        'bg-slate-700 text-slate-400'}`}>
                                                        {game.status}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white"><FormatCurrency amount={game.entryAmount * game.currentPlayers} /></div>
                                                    <div className="text-xs text-indigo-400">Fee: <FormatCurrency amount={game.platformFee} /></div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-sm text-slate-600 dark:text-slate-300">{game.currentPlayers} / {game.maxPlayers}</div>
                                                </td>
                                                <td className="p-4 text-xs text-slate-500">
                                                    {new Date(game.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {view === 'history' && (
                <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center"><Spinner /></td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">No history found</td></tr>
                                ) : (
                                    history.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-800/30">
                                            <td className="p-4 text-xs text-slate-400">
                                                {new Date(item.createdAt).toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm text-slate-900 dark:text-white">{item.userName}</div>
                                                <div className="text-xs text-slate-500">{item.userEmail}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.type === 'QUIZ_WINNING' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-700 text-slate-400'}`}>
                                                    {item.type.replace('QUIZ_', '')}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-slate-900 dark:text-white">
                                                <FormatCurrency amount={item.amount} />
                                            </td>
                                            <td className="p-4 text-sm text-slate-600 dark:text-slate-300 truncate max-w-xs" title={item.description}>
                                                {item.description}
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs text-emerald-500 font-bold">{item.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination Controls */}
            {meta.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <Button
                        variant="ghost"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                    >
                        Previous
                    </Button>
                    <span className="flex items-center text-sm text-slate-400">
                        Page {page} of {meta.totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        disabled={page === meta.totalPages}
                        onClick={() => setPage(p => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
};

export const AdminSettingsPage = () => {
    const { addToast } = useToast();
    const { refetchGlobalTheme } = useTheme();
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        minDeposit: 1000,
        minWithdrawal: 1000,
        maxWithdrawal: 1000000,
        minInvestment: 5000,
        autoTransferThreshold: 50000,
        minLiquidityRatio: 1.05,
        isSystemPaused: false,
        paystackPublicKey: '',
        kycRequiredForAccount: true,
        enableEmailLoginAlerts: true,
        enableWithdrawalApproval: true,
        defaultTheme: 'dark',
        showUserQuizNav: true,
        showUserBoxNav: true,
        enableUserAdsPopup: true,
    });

    const [saveLoading, setSaveLoading] = useState(false);

    // Admin transaction PIN management (for admin's own account)
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const [pinAction, setPinAction] = useState<'SET' | 'CHANGE' | 'RESET'>('SET');
    const [pinLoading, setPinLoading] = useState(false);
    const [pinForm, setPinForm] = useState({
        pin: '',
        confirm: '',
        oldPin: '',
        newPin: '',
        password: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await adminApi.getSettings();
                // Ensure we merge with defaults in case of new fields
                setSettings(prev => ({ ...prev, ...response.data }));
            } catch (error: any) {
                console.error('Failed to fetch settings:', error);
                addToast('error', 'Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaveLoading(true);
        try {
            await adminApi.updateSettings(settings);
            addToast('success', 'Settings saved successfully');
            await refetchGlobalTheme();
        } catch (error: any) {
            console.error('Failed to save settings:', error);
            addToast('error', 'Failed to save settings');
        } finally {
            setSaveLoading(false);
        }
    };

    const openPinModal = (action: 'SET' | 'CHANGE' | 'RESET') => {
        setPinAction(action);
        setPinForm({ pin: '', confirm: '', oldPin: '', newPin: '', password: '' });
        setPinModalOpen(true);
    };

    const handlePinSubmit = async () => {
        setPinLoading(true);
        try {
            const { userApi } = await import('../api');

            if (pinAction === 'SET') {
                if (pinForm.pin.length !== 4) throw new Error('PIN must be 4 digits');
                if (pinForm.pin !== pinForm.confirm) throw new Error('PINs do not match');
                if (!pinForm.password) throw new Error('Password is required');
                await userApi.setPin(pinForm.pin, pinForm.password);
                addToast('success', 'Transaction PIN set');
            }

            if (pinAction === 'CHANGE') {
                if (pinForm.oldPin.length !== 4) throw new Error('Old PIN must be 4 digits');
                if (pinForm.newPin.length !== 4) throw new Error('New PIN must be 4 digits');
                if (pinForm.newPin !== pinForm.confirm) throw new Error('PINs do not match');
                await userApi.changePin(pinForm.oldPin, pinForm.newPin);
                addToast('success', 'Transaction PIN changed');
            }

            if (pinAction === 'RESET') {
                if (pinForm.newPin.length !== 4) throw new Error('New PIN must be 4 digits');
                if (pinForm.newPin !== pinForm.confirm) throw new Error('PINs do not match');
                if (!pinForm.password) throw new Error('Password is required');
                await userApi.resetPin(pinForm.password, pinForm.newPin);
                addToast('success', 'Transaction PIN reset');
            }

            await refreshUser();
            setPinModalOpen(false);
        } catch (error: any) {
            addToast('error', error?.response?.data?.error || error?.message || 'Failed');
        } finally {
            setPinLoading(false);
        }
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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">System Settings</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">General Configuration</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">System Pause</div>
                                <div className="text-xs text-slate-400">Suspend all withdrawals & deposits</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.isSystemPaused}
                                    onChange={e => setSettings({ ...settings, isSystemPaused: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Show Quiz in User Nav</div>
                                <div className="text-xs text-slate-400">Toggle visibility of the Quiz tab for users</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.showUserQuizNav ?? true}
                                    onChange={e => setSettings({ ...settings, showUserQuizNav: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Show Box (Investments) in User Nav</div>
                                <div className="text-xs text-slate-400">Toggle visibility of the Box tab for users</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.showUserBoxNav ?? true}
                                    onChange={e => setSettings({ ...settings, showUserBoxNav: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Show Advert Popup Banner</div>
                                <div className="text-xs text-slate-400">Enable or disable the advert image popup for users</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enableUserAdsPopup ?? true}
                                    onChange={e => setSettings({ ...settings, enableUserAdsPopup: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Require KYC for Virtual Account</div>
                                <div className="text-xs text-slate-400">Enforce KYC verification before account generation</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.kycRequiredForAccount}
                                    onChange={e => setSettings({ ...settings, kycRequiredForAccount: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Withdrawal Approval Required</div>
                                <div className="text-xs text-slate-400">If disabled, withdrawals are instant (automated)</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enableWithdrawalApproval ?? true}
                                    onChange={e => setSettings({ ...settings, enableWithdrawalApproval: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Email Login Alerts</div>
                                <div className="text-xs text-slate-400">Send email when user logs in</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enableEmailLoginAlerts ?? true}
                                    onChange={e => setSettings({ ...settings, enableEmailLoginAlerts: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">Global Default Theme</div>
                                <div className="text-xs text-slate-400">Default appearance for new users</div>
                            </div>
                            <select
                                value={(settings as any).defaultTheme || 'dark'}
                                onChange={e => setSettings({ ...settings, defaultTheme: e.target.value } as any)}
                                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2"
                            >
                                <option value="dark">Dark Mode (Default)</option>
                                <option value="light">Light Mode</option>
                                <option value="system">System Default</option>
                            </select>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Admin Transaction PIN</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">PIN Status</div>
                                <div className="text-xs text-slate-400">
                                    {user?.transactionPin ? 'Transaction PIN is set for this admin account.' : 'No transaction PIN set yet.'}
                                </div>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user?.transactionPin ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30'}`}>
                                {user?.transactionPin ? 'SET' : 'NOT SET'}
                            </span>
                        </div>

                        {!user?.transactionPin ? (
                            <Button onClick={() => openPinModal('SET')} className="w-full">
                                Set Transaction PIN
                            </Button>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Button variant="outline" onClick={() => openPinModal('CHANGE')} className="w-full">
                                    Change PIN
                                </Button>
                                <Button variant="danger" onClick={() => openPinModal('RESET')} className="w-full">
                                    Reset PIN
                                </Button>
                            </div>
                        )}

                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            This PIN is required for admin withdrawals and sensitive financial actions.
                        </p>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Financial Limits (Minimums)</h3>
                    <div className="space-y-4">
                        <Input
                            label="Minimum Funding Amount (₦)"
                            type="number"
                            value={settings.minDeposit}
                            onChange={e => setSettings({ ...settings, minDeposit: parseInt(e.target.value) || 0 })}
                            hint="Minimum amount a user can deposit"
                        />
                        <Input
                            label="Minimum Transfer Amount (₦)"
                            type="number"
                            value={settings.minWithdrawal}
                            onChange={e => setSettings({ ...settings, minWithdrawal: parseInt(e.target.value) || 0 })}
                            hint="Minimum amount a user can transfer per transaction"
                        />
                        <Input
                            label="Maximum Transfer Amount (₦)"
                            type="number"
                            value={settings.maxWithdrawal}
                            onChange={e => setSettings({ ...settings, maxWithdrawal: parseInt(e.target.value) || 0 })}
                            hint="Maximum amount a user can transfer per transaction"
                        />
                        <Input
                            label="Auto Transfer Threshold (₦)"
                            type="number"
                            value={settings.autoTransferThreshold}
                            onChange={e => setSettings({ ...settings, autoTransferThreshold: parseInt(e.target.value) || 0 })}
                            hint="Transfers ≤ this amount auto-process; above requires manual approval"
                        />
                        <Input
                            label="Minimum Investment Amount (₦)"
                            type="number"
                            value={settings.minInvestment}
                            onChange={e => setSettings({ ...settings, minInvestment: parseInt(e.target.value) || 0 })}
                            hint="Minimum amount required to create an investment"
                        />
                        <Input
                            label="Min Liquidity Ratio"
                            type="number"
                            step="0.01"
                            value={settings.minLiquidityRatio}
                            onChange={e => setSettings({ ...settings, minLiquidityRatio: parseFloat(e.target.value) || 1.05 })}
                            hint="Capital protection threshold. Transfers blocked when coverage falls below this (e.g. 1.05 = 105%)"
                        />
                    </div>
                </Card>
            </div >

            <div className="flex justify-end">
                <Button onClick={handleSave} className="w-full md:w-auto" disabled={saveLoading}>
                    {saveLoading ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <Modal
                isOpen={pinModalOpen}
                onClose={() => setPinModalOpen(false)}
                title={pinAction === 'SET' ? 'Set Transaction PIN' : pinAction === 'CHANGE' ? 'Change Transaction PIN' : 'Reset Transaction PIN'}
            >
                <div className="space-y-4">
                    {pinAction === 'SET' && (
                        <>
                            <Input
                                label="New PIN"
                                type="password"
                                maxLength={4}
                                value={pinForm.pin}
                                onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value.replace(/\D/g, '') })}
                                placeholder="Enter 4-digit PIN"
                                className="tracking-[0.35em] text-center text-lg"
                            />
                            <Input
                                label="Confirm PIN"
                                type="password"
                                maxLength={4}
                                value={pinForm.confirm}
                                onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '') })}
                                placeholder="Re-enter PIN"
                                className="tracking-[0.35em] text-center text-lg"
                            />
                            <Input
                                label="Password"
                                type="password"
                                value={pinForm.password}
                                onChange={(e) => setPinForm({ ...pinForm, password: e.target.value })}
                                placeholder="Enter account password"
                            />
                        </>
                    )}

                    {pinAction === 'CHANGE' && (
                        <>
                            <Input
                                label="Old PIN"
                                type="password"
                                maxLength={4}
                                value={pinForm.oldPin}
                                onChange={(e) => setPinForm({ ...pinForm, oldPin: e.target.value.replace(/\D/g, '') })}
                                placeholder="Enter old PIN"
                                className="tracking-[0.35em] text-center text-lg"
                            />
                            <Input
                                label="New PIN"
                                type="password"
                                maxLength={4}
                                value={pinForm.newPin}
                                onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value.replace(/\D/g, '') })}
                                placeholder="Enter new PIN"
                                className="tracking-[0.35em] text-center text-lg"
                            />
                            <Input
                                label="Confirm New PIN"
                                type="password"
                                maxLength={4}
                                value={pinForm.confirm}
                                onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '') })}
                                placeholder="Re-enter new PIN"
                                className="tracking-[0.35em] text-center text-lg"
                            />
                        </>
                    )}

                    {pinAction === 'RESET' && (
                        <>
                            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-slate-600 dark:text-slate-300">
                                Reset requires your password. Use this only if you forgot the old PIN.
                            </div>
                            <Input
                                label="New PIN"
                                type="password"
                                maxLength={4}
                                value={pinForm.newPin}
                                onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value.replace(/\D/g, '') })}
                                placeholder="Enter new PIN"
                                className="tracking-[0.35em] text-center text-lg"
                            />
                            <Input
                                label="Confirm New PIN"
                                type="password"
                                maxLength={4}
                                value={pinForm.confirm}
                                onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '') })}
                                placeholder="Re-enter new PIN"
                                className="tracking-[0.35em] text-center text-lg"
                            />
                            <Input
                                label="Password"
                                type="password"
                                value={pinForm.password}
                                onChange={(e) => setPinForm({ ...pinForm, password: e.target.value })}
                                placeholder="Enter account password"
                            />
                        </>
                    )}

                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" onClick={() => setPinModalOpen(false)} className="flex-1" disabled={pinLoading}>
                            Cancel
                        </Button>
                        <Button onClick={handlePinSubmit} className="flex-1" disabled={pinLoading}>
                            {pinLoading ? 'Saving...' : 'Save PIN'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};

// ═══════════════════════════════════════════════
//  RESEARCH TYPES
// ═══════════════════════════════════════════════

interface ResearchRequest {
    id: string;
    userId: string;
    fullName: string;
    email: string;
    role: string;
    institution?: string;
    serviceCategory: string;
    specificService: string;
    researchLevel: string;
    discipline: string;
    description: string;
    preferredDate?: string;
    urgency: string;
    attachmentUrl?: string;
    status: string;
    adminNotes?: string;
    quoteAmount?: number;
    deliveryUrl?: string;
    createdAt: string;
    user: {
        username: string;
        email: string;
    }
}

// ═══════════════════════════════════════════════
//  ADMIN RESEARCH MANAGEMENT
// ═══════════════════════════════════════════════

export const AdminResearchPage = () => {
    const [requests, setRequests] = useState<ResearchRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<ResearchRequest | null>(null);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [updateLoading, setUpdateLoading] = useState(false);
    const { addToast } = useToast();

    // Update Form State
    const [updateForm, setUpdateForm] = useState({
        status: '',
        adminNotes: '',
        quoteAmount: '0',
        deliveryUrl: ''
    });

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getResearchRequests();
            setRequests(res.data);
        } catch (error) {
            console.error(error);
            addToast('error', 'Failed to fetch research requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleUpdateClick = (req: ResearchRequest) => {
        setSelectedRequest(req);
        setUpdateForm({
            status: req.status,
            adminNotes: req.adminNotes || '',
            quoteAmount: (req.quoteAmount || 0).toString(),
            deliveryUrl: req.deliveryUrl || ''
        });
        setUpdateModalOpen(true);
    };

    const handleSaveUpdate = async () => {
        if (!selectedRequest) return;
        setUpdateLoading(true);
        try {
            await adminApi.updateResearchRequest(selectedRequest.id, {
                ...updateForm,
                quoteAmount: parseFloat(updateForm.quoteAmount)
            });
            addToast('success', 'Request updated successfully');
            setUpdateModalOpen(false);
            fetchRequests();
        } catch (error) {
            console.error(error);
            addToast('error', 'Update failed');
        } finally {
            setUpdateLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Spinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Research Services Management</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Review, quote, and deliver academic research requests.</p>
                </div>
                <Button onClick={fetchRequests} variant="secondary" className="gap-2">
                    <Activity size={16} /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {requests.length === 0 ? (
                    <Card className="text-center py-20 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <FileText className="mx-auto text-slate-700 mb-4" size={48} />
                        <p className="text-slate-500">No research requests found.</p>
                    </Card>
                ) : (
                    requests.map((req) => (
                        <Card key={req.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 border-l-4 border-l-indigo-500 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between gap-6">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${req.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' :
                                            req.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-500' :
                                                req.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-500' :
                                                    'bg-blue-500/20 text-blue-500'
                                            }`}>
                                            {req.status}
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${req.urgency === 'Urgent' ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                            }`}>
                                            {req.urgency}
                                        </div>
                                        <span className="text-[10px] text-slate-500">{new Date(req.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">{req.specificService}</h3>
                                        <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
                                            <Users size={12} /> {req.fullName} • {req.user.username || req.email}
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800/50 italic">
                                        "{req.description}"
                                    </p>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Category</div>
                                            <div className="text-xs text-slate-700 dark:text-slate-300">{req.serviceCategory}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Discipline</div>
                                            <div className="text-xs text-slate-700 dark:text-slate-300">{req.discipline}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Role</div>
                                            <div className="text-xs text-slate-700 dark:text-slate-300">{req.role}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Preferred Date</div>
                                            <div className="text-xs text-slate-700 dark:text-slate-300">{req.preferredDate ? new Date(req.preferredDate).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:w-64 space-y-4 md:border-l md:border-slate-200 dark:md:border-slate-800 md:pl-6 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Quote Amount</div>
                                            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">₦{req.quoteAmount?.toLocaleString()}</div>
                                        </div>
                                        {req.attachmentUrl && (
                                            <a href={req.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-amber-500 hover:text-amber-400 font-bold p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 transition-colors">
                                                <Download size={14} /> View Supporting Doc
                                            </a>
                                        )}
                                    </div>
                                    <Button onClick={() => handleUpdateClick(req)} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2">
                                        <Edit3 size={16} /> Manage Request
                                    </Button>
                                </div>
                            </div>
                            {req.adminNotes && (
                                <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                    <span className="font-bold text-slate-500 block mb-1">ADMIN NOTES</span>
                                    {req.adminNotes}
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </div>

            <Modal isOpen={updateModalOpen} onClose={() => setUpdateModalOpen(false)} title="Manage Research Request">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Update Status</label>
                        <select
                            value={updateForm.status}
                            onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        >
                            <option value="PENDING">Pending Review</option>
                            <option value="REVIEWING">Reviewing</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    <Input
                        label="Service Quote (₦)"
                        type="number"
                        value={updateForm.quoteAmount}
                        onChange={(e) => setUpdateForm({ ...updateForm, quoteAmount: e.target.value })}
                        placeholder="Cost of service"
                    />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Admin Feedback / Notes</label>
                        <textarea
                            value={updateForm.adminNotes}
                            onChange={(e) => setUpdateForm({ ...updateForm, adminNotes: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500 min-h-[100px]"
                            placeholder="Response to user..."
                        />
                    </div>

                    <Input
                        label="Delivery / Download URL"
                        value={updateForm.deliveryUrl}
                        onChange={(e) => setUpdateForm({ ...updateForm, deliveryUrl: e.target.value })}
                        placeholder="Link to final document/result"
                    />

                    <div className="flex gap-3 pt-4 border-t border-slate-800 mt-4">
                        <Button variant="secondary" onClick={() => setUpdateModalOpen(false)} className="flex-1">Cancel</Button>
                        <Button onClick={handleSaveUpdate} disabled={updateLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                            {updateLoading ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
