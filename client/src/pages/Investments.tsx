import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    Shield,
    Activity,
    Clock,
    Plus,
    ChevronRight,
    Info,
    History,
    PieChart,
    Wallet,
    ArrowUpRight,
    CheckCircle2,
    Calendar,
    Target
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { investmentApi, userApi } from '../api';
import { Card, FormatCurrency, Spinner, Button, Input } from '../components/ui';

interface Investment {
    id: string;
    principal: number;
    durationDays: number;
    baseRate: number;
    bonusRate: number;
    maturityDate: string;
    status: string;
    createdAt: string;
}

const DURATIONS = [
    { days: 7, baseRate: 2, label: 'Weekly Booster' },
    { days: 14, baseRate: 4, label: 'Growth Plan' },
    { days: 30, baseRate: 8, label: 'Wealth Builder' },
    { days: 60, baseRate: 15, label: 'Titan Saver' },
];

type Tab = 'active' | 'new' | 'history';

export const InvestmentsPage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<Tab>('active');
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [withdrawLoading, setWithdrawLoading] = useState<string | null>(null);

    // New Investment Form State
    const [amount, setAmount] = useState('');
    const [duration, setDuration] = useState(7);

    useEffect(() => {
        fetchInvestments();
    }, []);

    const fetchInvestments = async () => {
        try {
            const response = await investmentApi.getAll();
            setInvestments(response.data);
        } catch (error) {
            console.error('Failed to fetch investments:', error);
            addToast('error', 'Failed to load investments');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvestment = async () => {
        const amt = parseFloat(amount);
        if (!amt || isNaN(amt)) {
            addToast('error', 'Please enter a valid amount');
            return;
        }

        const minInvest = 5000; // Default fallback
        if (amt < minInvest) {
            addToast('error', `Minimum investment is ₦${minInvest.toLocaleString()}`);
            return;
        }

        if (amt > (user?.balance || 0)) {
            addToast('error', 'Insufficient wallet balance');
            return;
        }

        setActionLoading(true);
        try {
            await investmentApi.create(amt, duration);
            addToast('success', 'Investment started successfully!');
            setAmount('');
            setActiveTab('active');
            await fetchInvestments();
            await refreshUser();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to create investment');
        } finally {
            setActionLoading(true);
            // Small delay for UI feel
            setTimeout(() => setActionLoading(false), 500);
        }
    };

    const handleWithdraw = async (id: string) => {
        setWithdrawLoading(id);
        try {
            await investmentApi.withdraw(id);
            addToast('success', 'Withdrawal request submitted!');
            await fetchInvestments();
            await refreshUser();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Withdrawal failed');
        } finally {
            setWithdrawLoading(null);
        }
    };

    const activePlans = investments.filter(i => i.status === 'ACTIVE');
    const maturedPlans = investments.filter(i => i.status === 'MATURED');
    const historyPlans = investments.filter(i => i.status === 'PAYOUT_PROCESSED' || i.status === 'PAYOUT_PENDING');

    const totalInvested = activePlans.reduce((sum, i) => sum + i.principal, 0);
    const totalReturns = activePlans.reduce((sum, i) => sum + (i.principal * (i.baseRate + i.bonusRate) / 100), 0);

    const investmentPlan = DURATIONS.find(d => d.days === duration);
    const estimatedReturn = investmentPlan ? parseFloat(amount || '0') * (1 + (investmentPlan.baseRate) / 100) : 0;

    if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Premium Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 blur-[100px] -translate-y-1/2 translate-x-1/2 rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[80px] translate-y-1/3 -translate-x-1/4 rounded-full" />

                <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold mb-4 uppercase tracking-wider">
                            <TrendingUp size={14} /> Wealth Portfolio
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white mb-2 leading-tight">Grow Your Assets <br /><span className="text-amber-500">Automated Returns.</span></h1>
                        <p className="text-slate-400 text-sm md:text-base max-w-md mb-6">Secure investments with competitive cycles. Your capital works for you while you sleep.</p>

                        <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                            <div className="flex items-center gap-2 group cursor-help">
                                <div className="p-1.5 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                                    <Shield size={14} className="text-emerald-500" />
                                </div>
                                <span className="text-xs font-medium text-slate-300">Capital Protection</span>
                            </div>
                            <div className="flex items-center gap-2 group cursor-help">
                                <div className="p-1.5 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                                    <Clock size={14} className="text-blue-500" />
                                </div>
                                <span className="text-xs font-medium text-slate-300">Flexible Cycles</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-auto grid grid-cols-2 gap-3">
                        <div className="bg-slate-950/50 backdrop-blur-md border border-white/5 p-5 rounded-2xl">
                            <div className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-1">Total Invested</div>
                            <div className="text-xl font-black text-white font-mono leading-none">
                                <FormatCurrency amount={totalInvested} />
                            </div>
                        </div>
                        <div className="bg-slate-950/50 backdrop-blur-md border border-white/5 p-5 rounded-2xl">
                            <div className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-1">Projected ROI</div>
                            <div className="text-xl font-black text-emerald-400 font-mono leading-none">
                                <FormatCurrency amount={totalReturns} />
                            </div>
                        </div>
                        <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
                            <div>
                                <div className="text-[10px] text-amber-500/70 uppercase font-bold">Wallet Balance</div>
                                <div className="text-xl font-bold text-amber-500"><FormatCurrency amount={user?.balance || 0} /></div>
                            </div>
                            <Button size="sm" onClick={() => navigate('/')} className="bg-amber-500 text-slate-900 border-none">
                                <Plus size={14} /> Top Up
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex p-1 bg-slate-900/50 border border-slate-800 rounded-xl max-w-md mx-auto">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'
                        }`}
                >
                    <Activity size={16} /> My Plans
                </button>
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'
                        }`}
                >
                    <Plus size={16} /> New Plan
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'
                        }`}
                >
                    <History size={16} /> History
                </button>
            </div>

            {/* Content Area */}
            <div className="max-w-4xl mx-auto">
                {activeTab === 'active' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Active Investments</h2>
                            <span className="text-xs text-slate-500">{activePlans.length + maturedPlans.length} Total</span>
                        </div>

                        {activePlans.length === 0 && maturedPlans.length === 0 ? (
                            <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
                                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                                    <PieChart size={32} className="text-slate-700" />
                                </div>
                                <h3 className="text-white font-bold mb-1">No active plans found</h3>
                                <p className="text-slate-500 text-sm max-w-xs mb-6">Start your first investment today and begin your wealth generation journey.</p>
                                <Button onClick={() => setActiveTab('new')} variant="outline">Start Investment Now</Button>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Matured Plans First */}
                                {maturedPlans.map(inv => (
                                    <Card key={inv.id} className="relative border-emerald-500/30 bg-emerald-500/5 group">
                                        <div className="absolute top-3 right-3">
                                            <span className="bg-emerald-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Matured</span>
                                        </div>
                                        <div className="mb-4">
                                            <div className="text-slate-400 text-xs mb-1 uppercase tracking-wider font-bold">Principal</div>
                                            <div className="text-2xl font-black text-white"><FormatCurrency amount={inv.principal} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div>
                                                <div className="text-xs text-slate-500">Return ({inv.baseRate + inv.bonusRate}%)</div>
                                                <div className="text-sm font-bold text-emerald-400 font-mono">
                                                    + <FormatCurrency amount={(inv.principal * (inv.baseRate + inv.bonusRate) / 100)} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500">Total Payout</div>
                                                <div className="text-sm font-bold text-white font-mono">
                                                    <FormatCurrency amount={inv.principal * (1 + (inv.baseRate + inv.bonusRate) / 100)} />
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => handleWithdraw(inv.id)}
                                            disabled={withdrawLoading === inv.id}
                                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900"
                                        >
                                            {withdrawLoading === inv.id ? <Spinner className="w-4 h-4" /> : 'Request Payout'}
                                        </Button>
                                    </Card>
                                ))}

                                {/* Active Plans */}
                                {activePlans.map(inv => {
                                    const maturity = new Date(inv.maturityDate);
                                    const created = new Date(inv.createdAt);
                                    const totalDays = inv.durationDays;
                                    const elapsed = Math.ceil((new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                                    const progress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
                                    const daysLeft = Math.max(0, Math.ceil((maturity.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

                                    return (
                                        <Card key={inv.id} className="group hover:border-amber-500/30 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="text-slate-400 text-xs mb-1 uppercase tracking-wider font-bold">Invested Amount</div>
                                                    <div className="text-xl font-black text-white"><FormatCurrency amount={inv.principal} /></div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-amber-500">{daysLeft} days left</div>
                                                    <div className="text-[10px] text-slate-500">{maturity.toLocaleDateString()}</div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 mb-4">
                                                <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                                                    <span className="text-slate-500">Progress</span>
                                                    <span className="text-amber-500">{Math.round(progress)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-xs p-2 bg-slate-950/50 rounded-lg border border-white/5">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <Target size={14} className="text-amber-500" />
                                                    <span>Expected ROI</span>
                                                </div>
                                                <span className="font-bold text-emerald-400 font-mono">
                                                    + <FormatCurrency amount={(inv.principal * (inv.baseRate + inv.bonusRate) / 100)} />
                                                </span>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'new' && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                        <div className="md:col-span-3 space-y-4">
                            <Card className="bg-slate-900 border-amber-500/20">
                                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Plus size={18} className="text-amber-500" /> Configure Plan
                                </h2>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Investment Duration</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {DURATIONS.map((d) => (
                                                <button
                                                    key={d.days}
                                                    onClick={() => setDuration(d.days)}
                                                    className={`relative p-4 rounded-2xl border transition-all text-left overflow-hidden group ${duration === d.days
                                                            ? 'bg-amber-500 border-amber-500 text-slate-900 shadow-xl shadow-amber-500/10'
                                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                                        }`}
                                                >
                                                    <div className={`text-[10px] font-black uppercase mb-1 ${duration === d.days ? 'text-slate-800' : 'text-slate-500'}`}>{d.label}</div>
                                                    <div className="text-lg font-black leading-none mb-1">{d.days} Days</div>
                                                    <div className={`text-sm font-bold ${duration === d.days ? 'text-slate-900' : 'text-amber-500'}`}>{d.baseRate}% Return</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Investment Amount</label>
                                        <div className="relative group">
                                            <Input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="Enter amount (Min ₦20,000)"
                                                className="bg-slate-950 border-slate-800 py-6 text-xl font-bold font-mono pl-12"
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-600 group-focus-within:text-amber-500">₦</div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase px-1">
                                            <span>Min: ₦20,000</span>
                                            <span>Balance: <FormatCurrency amount={user?.balance || 0} /></span>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleCreateInvestment}
                                        disabled={actionLoading || !amount || parseFloat(amount) < 20000}
                                        className="w-full py-4 text-base shadow-xl"
                                    >
                                        {actionLoading ? <Spinner className="w-5 h-5" /> : `Create ${duration} Day Investment Plan`}
                                    </Button>
                                </div>
                            </Card>

                            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                                    <Info className="text-blue-400" size={18} />
                                </div>
                                <div className="text-xs text-slate-400 leading-relaxed">
                                    <span className="text-white font-bold block mb-1">Maturity Clause</span>
                                    Investments are locked for the selected duration. Payout requests can only be initiated after the plan has reached full maturity.
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <Card className="bg-slate-950 border-white/5 sticky top-24">
                                <h3 className="font-bold text-white mb-4 border-b border-white/5 pb-2">Plan Summary</h3>

                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Duration</span>
                                        <span className="text-white font-bold">{duration} Days</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">ROI Percentage</span>
                                        <span className="text-emerald-400 font-bold">{investmentPlan?.baseRate}%</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Principal</span>
                                        <span className="text-white font-mono font-bold"><FormatCurrency amount={parseFloat(amount) || 0} /></span>
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <div className="text-xs text-slate-500 mb-1">Total Payout at Maturity</div>
                                        <div className="text-3xl font-black text-emerald-400 font-mono">
                                            <FormatCurrency amount={estimatedReturn} />
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-900 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-slate-300">
                                            <Calendar size={14} className="text-amber-500" />
                                            <span>Starts: Today</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-300">
                                            <ArrowUpRight size={14} className="text-emerald-500" />
                                            <span>Maturity: {new Date(new Date().getTime() + duration * 86400000).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Investment History</h2>
                            <span className="text-xs text-slate-500">Completed cycles</span>
                        </div>

                        {historyPlans.length === 0 ? (
                            <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
                                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                                    <History size={32} className="text-slate-700" />
                                </div>
                                <h3 className="text-white font-bold mb-1">No history yet</h3>
                                <p className="text-slate-500 text-sm max-w-xs">Your completed and paid-out investments will appear here.</p>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {historyPlans.map(inv => (
                                    <div key={inv.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-full ${inv.status === 'PAYOUT_PROCESSED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                {inv.status === 'PAYOUT_PROCESSED' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white"><FormatCurrency amount={inv.principal} /></div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mt-0.5">
                                                    {inv.durationDays} Days • {inv.status.replace('_', ' ')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-emerald-400">
                                                + <FormatCurrency amount={inv.principal * (inv.baseRate + inv.bonusRate) / 100} />
                                            </div>
                                            <div className="text-[10px] text-slate-500">{new Date(inv.maturityDate).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Educational Section */}
            {activeTab === 'new' && (
                <div className="mt-12 bg-slate-900/50 border-t border-slate-800 pt-12">
                    <div className="max-w-4xl mx-auto px-6">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-black text-white mb-2">How it Works</h2>
                            <p className="text-slate-400 text-sm">Simple, secure, and transparent wealth generation.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                {
                                    icon: <Wallet className="text-amber-500" size={24} />,
                                    title: "1. Fund Wallet",
                                    desc: "Deposit funds into your secure wallet via card or virtual account transfer."
                                },
                                {
                                    icon: <Activity className="text-blue-500" size={24} />,
                                    title: "2. Choose Cycle",
                                    desc: "Select a duration that fits your goals, from 7 days to 60 days."
                                },
                                {
                                    icon: <CheckCircle2 className="text-emerald-500" size={24} />,
                                    title: "3. Earn & Withdraw",
                                    desc: "Once matured, your principal and returns are available for instant withdrawal."
                                }
                            ].map((step, idx) => (
                                <div key={idx} className="flex flex-col items-center text-center">
                                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-slate-800">
                                        {step.icon}
                                    </div>
                                    <h4 className="text-white font-bold mb-2">{step.title}</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
