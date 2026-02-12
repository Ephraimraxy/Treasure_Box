import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Smartphone, Wifi, Zap, Tv, ArrowRightLeft, ArrowLeft, Loader2, UserCheck, ShieldCheck, CheckCircle, UserCog, Search, Edit, Wallet } from 'lucide-react';
import { Card, Button, Input } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { transactionApi } from '../api';
import { useAuth } from '../contexts/AuthContext';

// ─── Service Definitions ───
const SERVICE_MAP: Record<string, { name: string; icon: any; color: string; bg: string; description: string }> = {
    airtime: { name: 'Buy Airtime', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10', description: 'Top up airtime on any Nigerian mobile network instantly.' },
    data: { name: 'Buy Data', icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10', description: 'Purchase affordable data bundles for all networks.' },
    power: { name: 'Electricity', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', description: 'Pay your electricity bills — prepaid or postpaid meters.' },
    cable: { name: 'Cable TV', icon: Tv, color: 'text-purple-400', bg: 'bg-purple-500/10', description: 'Subscribe or renew your DStv, GOtv, or StarTimes plan.' },
    airtime_cash: { name: 'Airtime to Cash', icon: ArrowRightLeft, color: 'text-pink-400', bg: 'bg-pink-500/10', description: 'Convert your excess airtime back to wallet balance.' },
    nin_validation: { name: 'NIN Validation', icon: UserCheck, color: 'text-orange-400', bg: 'bg-orange-500/10', description: 'Verify the authenticity of a National Identification Number.' },
    nin_modification: { name: 'NIN Modification', icon: Edit, color: 'text-orange-400', bg: 'bg-orange-500/10', description: 'Request updates/corrections to your NIN record.' },
    nin_personalization: { name: 'NIN Personalization', icon: UserCog, color: 'text-orange-400', bg: 'bg-orange-500/10', description: 'Personalize your NIN slip with updated biometric data.' },
    bvn_validation: { name: 'BVN Validation', icon: ShieldCheck, color: 'text-teal-400', bg: 'bg-teal-500/10', description: 'Verify a Bank Verification Number for authenticity.' },
    bvn_modification: { name: 'BVN Modification', icon: Edit, color: 'text-teal-400', bg: 'bg-teal-500/10', description: 'Apply corrections to your BVN details.' },
    bvn_retrieval: { name: 'BVN Retrieval', icon: Search, color: 'text-teal-400', bg: 'bg-teal-500/10', description: 'Retrieve your BVN using your registered phone number.' },
};

const dataPlans: Record<string, { id: string; name: string; price: number }[]> = {
    MTN: [{ id: 'MTN_500MB', name: '500MB (30 Days)', price: 500 }, { id: 'MTN_1GB', name: '1GB (30 Days)', price: 1000 }, { id: 'MTN_2GB', name: '2GB (30 Days)', price: 2000 }, { id: 'MTN_5GB', name: '5GB (30 Days)', price: 3500 }, { id: 'MTN_10GB', name: '10GB (30 Days)', price: 6000 }],
    AIRTEL: [{ id: 'AIRTEL_750MB', name: '750MB (14 Days)', price: 500 }, { id: 'AIRTEL_1.5GB', name: '1.5GB (30 Days)', price: 1000 }, { id: 'AIRTEL_3GB', name: '3GB (30 Days)', price: 1500 }, { id: 'AIRTEL_4.5GB', name: '4.5GB (30 Days)', price: 2000 }],
    GLO: [{ id: 'GLO_1GB', name: '1GB (5 Days)', price: 300 }, { id: 'GLO_2.5GB', name: '2.5GB (2 Days)', price: 500 }, { id: 'GLO_5.8GB', name: '5.8GB (30 Days)', price: 2000 }, { id: 'GLO_7.7GB', name: '7.7GB (30 Days)', price: 2500 }],
    '9MOBILE': [{ id: '9MOBILE_500MB', name: '500MB (30 Days)', price: 500 }, { id: '9MOBILE_1.5GB', name: '1.5GB (30 Days)', price: 1000 }, { id: '9MOBILE_2GB', name: '2GB (30 Days)', price: 1200 }, { id: '9MOBILE_4.5GB', name: '4.5GB (30 Days)', price: 2000 }],
};

const electricityProviders = [
    { id: 'IKEDC', name: 'Ikeja Electric (IKEDC)' }, { id: 'EKEDC', name: 'Eko Electric (EKEDC)' },
    { id: 'AEDC', name: 'Abuja Electric (AEDC)' }, { id: 'IBEDC', name: 'Ibadan Electric (IBEDC)' },
    { id: 'KEDCO', name: 'Kano Electric (KEDCO)' }, { id: 'PHED', name: 'Port Harcourt Electric (PHED)' },
    { id: 'JED', name: 'Jos Electric (JED)' }, { id: 'KAEDCO', name: 'Kaduna Electric (KAEDCO)' },
    { id: 'EEDC', name: 'Enugu Electric (EEDC)' }, { id: 'BEDC', name: 'Benin Electric (BEDC)' },
];

// ─── Component ───
export const ServicePaymentPage = () => {
    const { type } = useParams<{ type: string }>();
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();

    const service = type ? SERVICE_MAP[type] : null;

    // Form state
    const [amount, setAmount] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [details, setDetails] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<any>(null);

    // Success state
    const [success, setSuccess] = useState(false);
    const [verificationResult, setVerificationResult] = useState<any>(null);

    if (!service || !type) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <div className="w-16 h-16 bg-surface-highlight rounded-full flex items-center justify-center mb-4">
                    <Search size={32} className="text-muted" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Service Not Found</h2>
                <p className="text-muted mb-6">The service you're looking for doesn't exist.</p>
                <Button onClick={() => navigate('/services')}>Back to Services</Button>
            </div>
        );
    }

    const ServiceIcon = service.icon;

    const isIdentityService = ['nin_validation', 'nin_modification', 'nin_personalization', 'bvn_validation', 'bvn_modification', 'bvn_retrieval'].includes(type);
    const requiresDetails = ['nin_modification', 'nin_personalization', 'bvn_modification'].includes(type);

    const getLabel = () => {
        if (type.includes('airtime') || type.includes('data') || type === 'bvn_retrieval') return "Phone Number";
        if (type.includes('nin')) return "NIN Number";
        if (type.includes('bvn')) return "BVN Number";
        if (type === 'power') return "Meter Number";
        return "Smart Card / IUC Number";
    };

    const handlePlanSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const planId = e.target.value;
        if (!selectedProvider) return;
        const plans = dataPlans[selectedProvider];
        const plan = plans?.find(p => p.id === planId);
        setSelectedPlan(plan || null);
        if (plan) setAmount(plan.price.toString());
    };

    const handlePayment = async () => {
        if (!identifier || !pin) { addToast('error', 'Please fill all required fields'); return; }
        if (type === 'data' && (!selectedProvider || !selectedPlan)) { addToast('error', 'Please select a provider and plan'); return; }
        if (type === 'power' && !selectedProvider) { addToast('error', 'Please select an electricity provider'); return; }
        if (!amount && !selectedPlan) { addToast('error', 'Please enter amount'); return; }
        if (requiresDetails && !details) { addToast('error', 'Please provide details for the request'); return; }
        if (parseFloat(amount) > (user?.balance || 0)) { addToast('error', 'Insufficient balance'); return; }

        setLoading(true);
        try {
            const response = await transactionApi.payUtility({
                type: type.toUpperCase(),
                amount: parseFloat(amount),
                meta: { identifier, details, serviceName: service.name, provider: selectedProvider, plan: selectedPlan?.id },
                pin
            });
            await refreshUser();

            if (response.data.verificationData) {
                setVerificationResult(response.data.verificationData);
            }
            setSuccess(true);
            addToast('success', `${service.name} successful!`);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

    // ─── Success View ───
    if (success) {
        return (
            <div className="max-w-lg mx-auto animate-fade-in space-y-6 py-8">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle size={40} className="text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-1">Transaction Successful</h2>
                    <p className="text-muted">{service.name} completed successfully</p>
                </div>

                {verificationResult && (
                    <Card>
                        <h3 className="font-bold text-foreground mb-4">Verification Details</h3>
                        <div className="space-y-3">
                            {verificationResult.firstName && (
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span className="text-muted">First Name</span>
                                    <span className="font-bold text-foreground">{verificationResult.firstName}</span>
                                </div>
                            )}
                            {verificationResult.lastName && (
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span className="text-muted">Last Name</span>
                                    <span className="font-bold text-foreground">{verificationResult.lastName}</span>
                                </div>
                            )}
                            {verificationResult.valid !== undefined && (
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span className="text-muted">Valid</span>
                                    <span className="font-bold text-emerald-500">{verificationResult.valid ? 'Yes' : 'No'}</span>
                                </div>
                            )}
                            {verificationResult.bvn && (
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span className="text-muted">BVN</span>
                                    <span className="font-bold text-foreground">{verificationResult.bvn}</span>
                                </div>
                            )}
                            {verificationResult.status && (
                                <div className="flex justify-between border-b border-border pb-2">
                                    <span className="text-muted">Status</span>
                                    <span className="font-bold text-foreground">{verificationResult.status}</span>
                                </div>
                            )}
                            {verificationResult.reference && (
                                <div className="flex justify-between">
                                    <span className="text-muted">Ref ID</span>
                                    <span className="font-bold text-primary font-mono">{verificationResult.reference}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => navigate('/services')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Services
                    </Button>
                    <Button className="flex-1" onClick={() => navigate('/')}>
                        Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    // ─── Payment Form View ───
    return (
        <div className="max-w-lg mx-auto animate-fade-in space-y-6">
            {/* Back Button */}
            <button
                onClick={() => navigate('/services')}
                className="flex items-center gap-2 text-muted hover:text-foreground transition-colors group"
            >
                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-sm font-medium">Back to Services</span>
            </button>

            {/* Service Header */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${type.includes('nin') || type.includes('bvn') ? 'from-orange-500 to-teal-500'
                    : type === 'power' ? 'from-yellow-500 to-amber-500'
                        : type === 'cable' ? 'from-purple-500 to-indigo-500'
                            : 'from-blue-500 to-emerald-500'
                    }`} />
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`p-4 rounded-2xl ${service.bg} ${service.color}`}>
                            <ServiceIcon size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">{service.name}</h1>
                            <p className="text-sm text-muted">{service.description}</p>
                        </div>
                    </div>

                    {/* Wallet Balance */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border border-border/50 rounded-xl">
                        <Wallet size={16} className="text-primary" />
                        <span className="text-sm text-muted">Wallet Balance:</span>
                        <span className="font-bold text-foreground">₦{(user?.balance || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Payment Form */}
            <Card>
                <div className="space-y-5">
                    {/* Network Provider (Airtime / Data) */}
                    {(type === 'data' || type === 'airtime') && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted">Select Network</label>
                            <div className="grid grid-cols-4 gap-2">
                                {['MTN', 'AIRTEL', 'GLO', '9MOBILE'].map(net => (
                                    <button
                                        key={net}
                                        onClick={() => { setSelectedProvider(net); setSelectedPlan(null); setAmount(''); }}
                                        className={`py-3 rounded-xl text-sm font-bold transition-all border ${selectedProvider === net
                                            ? 'bg-primary/20 border-primary/50 text-primary'
                                            : 'bg-input border-input text-muted hover:border-ring hover:text-foreground'
                                            }`}
                                    >
                                        {net}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Electricity Provider */}
                    {type === 'power' && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted">Select Provider</label>
                            <select
                                value={selectedProvider}
                                onChange={(e) => setSelectedProvider(e.target.value)}
                                className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary appearance-none"
                            >
                                <option value="">Select Disco</option>
                                {electricityProviders.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Data Plan */}
                    {type === 'data' && selectedProvider && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted">Select Data Plan</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {dataPlans[selectedProvider]?.map(plan => (
                                    <button
                                        key={plan.id}
                                        onClick={() => { setSelectedPlan(plan); setAmount(plan.price.toString()); }}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${selectedPlan?.id === plan.id
                                            ? 'bg-primary/10 border-primary/40 text-foreground'
                                            : 'bg-card border-border text-muted hover:border-primary/40 hover:text-foreground'
                                            }`}
                                    >
                                        <span className="text-sm font-medium">{plan.name}</span>
                                        <span className={`text-sm font-bold ${selectedPlan?.id === plan.id ? 'text-primary' : 'text-muted'}`}>₦{plan.price.toLocaleString()}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Amount */}
                    <Input
                        label={type === 'data' ? "Amount (Auto)" : "Amount (₦)"}
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        icon={<span className="text-muted font-bold">₦</span>}
                        placeholder="0.00"
                        readOnly={!!selectedPlan}
                        className={selectedPlan ? "opacity-70 cursor-not-allowed" : ""}
                    />

                    {/* Identifier (Phone / Meter / NIN / BVN) */}
                    <Input
                        label={getLabel()}
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={`Enter ${getLabel().toLowerCase()}`}
                        maxLength={isIdentityService && type !== 'bvn_retrieval' ? 11 : undefined}
                    />

                    {/* Details for modifications */}
                    {requiresDetails && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted">Request Details</label>
                            <textarea
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors h-24 resize-none"
                                placeholder="Describe the changes required..."
                            />
                        </div>
                    )}

                    {/* Transaction PIN */}
                    <Input
                        label="Transaction PIN"
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        maxLength={4}
                        placeholder="****"
                    />

                    {/* Summary */}
                    {amount && (
                        <div className="bg-muted/50 border border-border/50 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Service</span>
                                <span className="text-foreground font-medium">{service.name}</span>
                            </div>
                            {selectedProvider && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted">Provider</span>
                                    <span className="text-foreground font-medium">{selectedProvider}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                                <span className="text-muted">Total</span>
                                <span className="text-primary font-bold text-lg">₦{parseFloat(amount || '0').toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    <Button onClick={handlePayment} disabled={loading} className="w-full">
                        {loading ? <Loader2 className="animate-spin" /> : `Confirm ${isIdentityService ? 'Request' : 'Payment'}`}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
