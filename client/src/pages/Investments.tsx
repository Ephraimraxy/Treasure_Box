import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, Shield, Activity, Clock, Plus, Info, History,
    PieChart, Wallet, ArrowUpRight, CheckCircle2, Calendar, Target
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

        const minInvest = 5000;
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
        <div className="space-y-4 animate-fade-in pb-8">
            {/* Compact Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-card border border-border">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] -translate-y-1/2 translate-x-1/2 rounded-full" />

                <div className="relative z-10 p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-center md:text-left">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold mb-2 uppercase tracking-wider">
                            <TrendingUp size={12} /> Wealth Portfolio
                        </div>
                        <h1 className="text-xl md:text-2xl font-black text-foreground mb-1 leading-tight">Grow Your Assets <span className="text-primary">Automated.</span></h1>
                        <p className="text-muted text-xs max-w-md">Secure investments with competitive cycles.</p>
                    </div>

                    <div className="w-full md:w-auto grid grid-cols-3 gap-2">
                        <div className="bg-background/50 backdrop-blur-md border border-border p-3 rounded-xl">
                            <div className="text-muted text-[9px] uppercase tracking-widest font-bold mb-0.5">Invested</div>
                            <div className="text-base font-black text-foreground font-mono leading-none">
                                <FormatCurrency amount={totalInvested} />
                            </div>
                        </div>
                        <div className="bg-background/50 backdrop-blur-md border border-border p-3 rounded-xl">
                            <div className="text-muted text-[9px] uppercase tracking-widest font-bold mb-0.5">ROI</div>
                            <div className="text-base font-black text-emerald-500 font-mono leading-none">
                                <FormatCurrency amount={totalReturns} />
                            </div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                            <div className="text-[9px] text-amber-500/70 uppercase font-bold mb-0.5">Balance</div>
                            <div className="text-base font-bold text-amber-500"><FormatCurrency amount={user?.balance || 0} /></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex p-1 bg-muted/50 border border-border rounded-xl max-w-sm mx-auto">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted hover:text-foreground'
                        }`}
                >
                    <Activity size={14} /> My Plans
                </button>
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'new' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted hover:text-foreground'
                        }`}
                >
                    <Plus size={14} /> New Plan
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted hover:text-foreground'
                        }`}
                >
                    <History size={14} /> History
                </button>
            </div>

            {/* Content Area */}
            <div className="max-w-3xl mx-auto">
                {activeTab === 'active' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">Active Investments</h2>
                            <span className="text-xs text-muted">{activePlans.length + maturedPlans.length} Total</span>
                        </div>

                        {activePlans.length === 0 && maturedPlans.length === 0 ? (
                            <Card className="flex flex-col items-center justify-center py-12 text-center border-dashed">
                                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                                    <PieChart size={24} className="text-muted-foreground" />
                                </div>
                                <h3 className="text-foreground font-bold mb-1 text-sm">No active plans found</h3>
                                <p className="text-muted text-xs max-w-xs mb-4">Start your first investment today.</p>
                                <Button onClick={() => setActiveTab('new')} variant="outline" size="sm">Start Investment</Button>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Matured Plans First */}
                                {maturedPlans.map(inv => (
                                    <Card key={inv.id} className="relative border-emerald-500/30 bg-emerald-500/5 group p-3">
                                        <div className="absolute top-2 right-2">
                                            <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Matured</span>
                                        </div>
                                        <div className="mb-3">
                                            <div className="text-muted text-[10px] mb-0.5 uppercase tracking-wider font-bold">Principal</div>
                                            <div className="text-xl font-black text-foreground"><FormatCurrency amount={inv.principal} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <div className="text-[10px] text-muted">Return ({inv.baseRate + inv.bonusRate}%)</div>
                                                <div className="text-xs font-bold text-emerald-500 font-mono">
                                                    + <FormatCurrency amount={(inv.principal * (inv.baseRate + inv.bonusRate) / 100)} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-muted">Total Payout</div>
                                                <div className="text-xs font-bold text-foreground font-mono">
                                                    <FormatCurrency amount={inv.principal * (1 + (inv.baseRate + inv.bonusRate) / 100)} />
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => handleWithdraw(inv.id)}
                                            disabled={withdrawLoading === inv.id}
                                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-primary-foreground"
                                            size="sm"
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
                                        <Card key={inv.id} className="group hover:border-primary/30 transition-all p-3">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="text-muted text-[10px] mb-0.5 uppercase tracking-wider font-bold">Invested</div>
                                                    <div className="text-lg font-black text-foreground"><FormatCurrency amount={inv.principal} /></div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-primary">{daysLeft}d left</div>
                                                    <div className="text-[9px] text-muted">{maturity.toLocaleDateString()}</div>
                                                </div>
                                            </div>

                                            <div className="space-y-1 mb-3">
                                                <div className="flex justify-between text-[9px] uppercase font-bold tracking-widest">
                                                    <span className="text-muted">Progress</span>
                                                    <span className="text-primary">{Math.round(progress)}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-background rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] p-2 bg-background/50 rounded-lg border border-border">
                                                <div className="flex items-center gap-1.5 text-muted">
                                                    <Target size={12} className="text-primary" />
                                                    <span>ROI</span>
                                                </div>
                                                <span className="font-bold text-emerald-500 font-mono">
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
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-3 space-y-3">
                            <Card className="bg-card border-border p-3">
                                <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                                    <Plus size={16} className="text-primary" /> Configure Plan
                                </h2>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest">Select Duration</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {DURATIONS.map((d) => (
                                                <button
                                                    key={d.days}
                                                    onClick={() => setDuration(d.days)}
                                                    className={`relative p-3 rounded-xl border transition-all text-left overflow-hidden group ${duration === d.days
                                                        ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/10'
                                                        : 'bg-background border-border text-muted hover:border-primary/50'
                                                        }`}
                                                >
                                                    <div className={`text-[9px] font-black uppercase mb-0.5 ${duration === d.days ? 'text-primary-foreground' : 'text-muted'}`}>{d.label}</div>
                                                    <div className="text-base font-black leading-none mb-0.5">{d.days} Days</div>
                                                    <div className={`text-xs font-bold ${duration === d.days ? 'text-primary-foreground' : 'text-primary'}`}>{d.baseRate}% Return</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest">Investment Amount</label>
                                        <div className="relative group">
                                            <Input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="Enter amount (Min ₦20,000)"
                                                className="bg-input border-input py-4 text-lg font-bold font-mono pl-10"
                                            />
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted group-focus-within:text-primary">₦</div>
                                        </div>
                                        <div className="flex justify-between text-[9px] font-bold text-muted uppercase px-1">
                                            <span>Min: ₦20,000</span>
                                            <span>Balance: <FormatCurrency amount={user?.balance || 0} /></span>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleCreateInvestment}
                                        disabled={actionLoading || !amount || parseFloat(amount) < 20000}
                                        className="w-full py-3 text-sm"
                                    >
                                        {actionLoading ? <Spinner className="w-5 h-5" /> : `Create ${duration} Day Plan`}
                                    </Button>
                                </div>
                            </Card>

                            <div className="bg-muted/50 border border-border p-3 rounded-xl flex items-start gap-2">
                                <div className="p-1.5 bg-blue-500/10 rounded-lg shrink-0">
                                    <Info className="text-blue-500" size={14} />
                                </div>
                                <div className="text-[10px] text-muted leading-relaxed">
                                    <span className="text-foreground font-bold block mb-0.5">Maturity Clause</span>
                                    Investments are locked for the selected duration. Payout requests can only be initiated after maturity.
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-3">
                            <Card className="bg-card border-border sticky top-24 p-3">
                                <h3 className="font-bold text-foreground text-sm mb-3 border-b border-border pb-2">Plan Summary</h3>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Duration</span>
                                        <span className="text-foreground font-bold">{duration} Days</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">ROI</span>
                                        <span className="text-emerald-500 font-bold">{investmentPlan?.baseRate}%</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Principal</span>
                                        <span className="text-foreground font-mono font-bold"><FormatCurrency amount={parseFloat(amount) || 0} /></span>
                                    </div>

                                    <div className="pt-3 border-t border-border">
                                        <div className="text-[10px] text-muted mb-0.5">Total Payout at Maturity</div>
                                        <div className="text-2xl font-black text-emerald-500 font-mono">
                                            <FormatCurrency amount={estimatedReturn} />
                                        </div>
                                    </div>

                                    <div className="p-2 bg-muted rounded-lg space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted">
                                            <Calendar size={12} className="text-primary" />
                                            <span>Starts: Today</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted">
                                            <ArrowUpRight size={12} className="text-emerald-500" />
                                            <span>Maturity: {new Date(new Date().getTime() + duration * 86400000).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">Investment History</h2>
                            <span className="text-xs text-muted">Completed cycles</span>
                        </div>

                        {historyPlans.length === 0 ? (
                            <Card className="flex flex-col items-center justify-center py-12 text-center border-dashed">
                                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                                    <History size={24} className="text-muted-foreground" />
                                </div>
                                <h3 className="text-foreground font-bold mb-1 text-sm">No history yet</h3>
                                <p className="text-muted text-xs max-w-xs">Completed investments will appear here.</p>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {historyPlans.map(inv => (
                                    <div key={inv.id} className="p-3 bg-card border border-border rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${inv.status === 'PAYOUT_PROCESSED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                                                {inv.status === 'PAYOUT_PROCESSED' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-foreground text-sm"><FormatCurrency amount={inv.principal} /></div>
                                                <div className="text-[9px] text-muted uppercase tracking-widest leading-none mt-0.5">
                                                    {inv.durationDays} Days • {inv.status.replace('_', ' ')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-emerald-500">
                                                + <FormatCurrency amount={inv.principal * (inv.baseRate + inv.bonusRate) / 100} />
                                            </div>
                                            <div className="text-[9px] text-muted">{new Date(inv.maturityDate).toLocaleDateString()}</div>
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
                <div className="mt-8 bg-muted/30 border-t border-border pt-8">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="text-center mb-6">
                            <h2 className="text-lg font-black text-foreground mb-1">How it Works</h2>
                            <p className="text-muted text-xs">Simple, secure, and transparent.</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {[
                                {
                                    icon: <Wallet className="text-primary" size={20} />,
                                    title: "1. Fund",
                                    desc: "Deposit funds via card or virtual account."
                                },
                                {
                                    icon: <Activity className="text-blue-500" size={20} />,
                                    title: "2. Choose",
                                    desc: "Pick a duration that fits your goals."
                                },
                                {
                                    icon: <CheckCircle2 className="text-emerald-500" size={20} />,
                                    title: "3. Earn",
                                    desc: "Collect principal and returns at maturity."
                                }
                            ].map((step, idx) => (
                                <div key={idx} className="flex flex-col items-center text-center">
                                    <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center mb-2 border border-border">
                                        {step.icon}
                                    </div>
                                    <h4 className="text-foreground font-bold text-xs mb-1">{step.title}</h4>
                                    <p className="text-[10px] text-muted leading-relaxed">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
