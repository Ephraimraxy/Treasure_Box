import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Wifi, Zap, Tv, ArrowRightLeft, X, Loader2, UserCheck, ShieldCheck, CheckCircle, FileText, UserCog, Search, Edit, GraduationCap, BookOpen, ExternalLink } from 'lucide-react';
import { Card, Button, Input } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { transactionApi } from '../api';
import { useAuth } from '../contexts/AuthContext';

const services = [
    { id: 'airtime', name: 'Buy Airtime', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'data', name: 'Buy Data', icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'power', name: 'Electricity', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { id: 'cable', name: 'Cable TV', icon: Tv, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'airtime_cash', name: 'Airtime to Cash', icon: ArrowRightLeft, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    // Identity Services
    { id: 'nin_validation', name: 'NIN Validation', icon: UserCheck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'nin_modification', name: 'NIN Modification', icon: Edit, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'nin_personalization', name: 'NIN Personalization', icon: UserCog, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'bvn_validation', name: 'BVN Validation', icon: ShieldCheck, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { id: 'bvn_modification', name: 'BVN Modification', icon: Edit, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { id: 'bvn_retrieval', name: 'BVN Retrieval', icon: Search, color: 'text-teal-400', bg: 'bg-teal-500/10' },
];

const dataPlans = {
    'MTN': [
        { id: 'MTN_500MB', name: '500MB (30 Days)', price: 500 },
        { id: 'MTN_1GB', name: '1GB (30 Days)', price: 1000 },
        { id: 'MTN_2GB', name: '2GB (30 Days)', price: 2000 },
        { id: 'MTN_5GB', name: '5GB (30 Days)', price: 3500 },
        { id: 'MTN_10GB', name: '10GB (30 Days)', price: 6000 },
    ],
    'AIRTEL': [
        { id: 'AIRTEL_750MB', name: '750MB (14 Days)', price: 500 },
        { id: 'AIRTEL_1.5GB', name: '1.5GB (30 Days)', price: 1000 },
        { id: 'AIRTEL_3GB', name: '3GB (30 Days)', price: 1500 },
        { id: 'AIRTEL_4.5GB', name: '4.5GB (30 Days)', price: 2000 },
    ],
    'GLO': [
        { id: 'GLO_1GB', name: '1GB (5 Days)', price: 300 },
        { id: 'GLO_2.5GB', name: '2.5GB (2 Days)', price: 500 },
        { id: 'GLO_5.8GB', name: '5.8GB (30 Days)', price: 2000 },
        { id: 'GLO_7.7GB', name: '7.7GB (30 Days)', price: 2500 },
    ],
    '9MOBILE': [
        { id: '9MOBILE_500MB', name: '500MB (30 Days)', price: 500 },
        { id: '9MOBILE_1.5GB', name: '1.5GB (30 Days)', price: 1000 },
        { id: '9MOBILE_2GB', name: '2GB (30 Days)', price: 1200 },
        { id: '9MOBILE_4.5GB', name: '4.5GB (30 Days)', price: 2000 },
    ]
};

const electricityProviders = [
    { id: 'IKEDC', name: 'Ikeja Electric (IKEDC)' },
    { id: 'EKEDC', name: 'Eko Electric (EKEDC)' },
    { id: 'AEDC', name: 'Abuja Electric (AEDC)' },
    { id: 'IBEDC', name: 'Ibadan Electric (IBEDC)' },
    { id: 'KEDCO', name: 'Kano Electric (KEDCO)' },
    { id: 'PHED', name: 'Port Harcourt Electric (PHED)' },
    { id: 'JED', name: 'Jos Electric (JED)' },
    { id: 'KAEDCO', name: 'Kaduna Electric (KAEDCO)' },
    { id: 'EEDC', name: 'Enugu Electric (EEDC)' },
    { id: 'BEDC', name: 'Benin Electric (BEDC)' },
];

export const ServicesPage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [selectedService, setSelectedService] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [identifier, setIdentifier] = useState(''); // Phone, Meter, IUC, NIN, BVN
    const [details, setDetails] = useState(''); // For modifications/personalization
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [verificationResult, setVerificationResult] = useState<any>(null);
    const [showResultModal, setShowResultModal] = useState(false);

    // New State for Plans/Providers
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<any>(null);

    const handleServiceClick = (service: any) => {
        setSelectedService(service);
        setAmount('');
        setIdentifier('');
        setDetails('');
        setPin('');
        setSelectedProvider('');
        setSelectedPlan(null);
    };

    const handlePlanSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const planId = e.target.value;
        if (!selectedProvider) return;

        const plans = (dataPlans as any)[selectedProvider];
        const plan = plans?.find((p: any) => p.id === planId);

        setSelectedPlan(plan);
        if (plan) setAmount(plan.price.toString());
    };

    const handlePayment = async () => {
        if (!identifier || !pin) {
            addToast('error', 'Please fill all required fields');
            return;
        }

        // Specific Validation for Data
        if (selectedService.id === 'data' && (!selectedProvider || !selectedPlan)) {
            addToast('error', 'Please select a provider and plan');
            return;
        }

        // Specific Validation for Power
        if (selectedService.id === 'power' && !selectedProvider) {
            addToast('error', 'Please select an electricity provider');
            return;
        }

        if (!amount && !selectedPlan) { // Amount is auto-set for plans, but manual otherwise
            addToast('error', 'Please enter amount');
            return;
        }

        if (requiresDetails(selectedService?.id) && !details) {
            addToast('error', 'Please provide details for the request');
            return;
        }

        if (parseFloat(amount) > (user?.balance || 0)) {
            addToast('error', 'Insufficient balance');
            return;
        }

        setLoading(true);
        try {
            const response = await transactionApi.payUtility({
                type: selectedService.id.toUpperCase(),
                amount: parseFloat(amount),
                meta: {
                    identifier,
                    details,
                    serviceName: selectedService.name,
                    provider: selectedProvider,
                    plan: selectedPlan ? selectedPlan.id : undefined
                },
                pin
            });

            await refreshUser();
            setSelectedService(null);

            if (response.data.verificationData) {
                setVerificationResult(response.data.verificationData);
                setShowResultModal(true);
                addToast('success', 'Service successful');
            } else {
                addToast('success', `${selectedService.name} successful!`);
            }
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

    const isIdentityService = (id: string) => [
        'nin_validation', 'nin_modification', 'nin_personalization',
        'bvn_validation', 'bvn_modification', 'bvn_retrieval'
    ].includes(id);

    const requiresDetails = (id: string) => [
        'nin_modification', 'nin_personalization', 'bvn_modification'
    ].includes(id);

    const getLabel = () => {
        if (!selectedService) return '';
        const id = selectedService.id;

        if (id.includes('airtime') || id.includes('data') || id === 'bvn_retrieval') return "Phone Number";
        if (id.includes('nin')) return "NIN Number";
        if (id.includes('bvn')) return "BVN Number";
        if (id === 'power') return "Meter Number";
        return "Smart Card / Meter No.";
    };

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {/* ─── Hero / Header ─── */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <h1 className="text-3xl font-bold text-white mb-2 relative z-10">Services Hub</h1>
                <p className="text-slate-400 max-w-lg relative z-10">
                    Access all your essential services in one place. Fast, secure, and reliable transactions.
                </p>
            </div>

            {/* ─── Research Services Promo ─── */}
            <div
                onClick={() => navigate('/research-services')}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/50 to-slate-900 border border-indigo-500/30 cursor-pointer transition-all hover:scale-[1.01] hover:border-indigo-500/50"
            >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <GraduationCap size={120} />
                </div>
                <div className="p-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-4 border border-indigo-500/30">
                        <BookOpen size={12} /> ACADEMIC SUPPORT
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Research & Academic Services</h2>
                    <p className="text-slate-400 max-w-xl mb-6">
                        Professional support for students, researchers, and institutions. Get help with thesis writing, data analysis, and grant proposals.
                    </p>
                    <div className="flex items-center gap-2 text-indigo-400 font-bold group-hover:text-indigo-300 transition-colors">
                        Explore Research Services <ExternalLink size={16} />
                    </div>
                </div>
            </div>

            {/* ─── Service Categories ─── */}

            {/* 1. Telecommunication */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                    <Smartphone size={20} className="text-blue-400" />
                    Telecommunication
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {services.filter(s => ['airtime', 'data', 'airtime_cash'].includes(s.id)).map((service) => (
                        <button
                            key={service.id}
                            onClick={() => handleServiceClick(service)}
                            className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:bg-slate-800 active:scale-95 group"
                        >
                            <div className={`p-4 rounded-full ${service.bg} ${service.color} group-hover:scale-110 transition-transform`}>
                                <service.icon size={28} />
                            </div>
                            <span className="font-bold text-white text-sm text-center">{service.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Utilities */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                    <Zap size={20} className="text-yellow-400" />
                    Utilities
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {services.filter(s => ['power', 'cable'].includes(s.id)).map((service) => (
                        <button
                            key={service.id}
                            onClick={() => handleServiceClick(service)}
                            className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:bg-slate-800 active:scale-95 group"
                        >
                            <div className={`p-4 rounded-full ${service.bg} ${service.color} group-hover:scale-110 transition-transform`}>
                                <service.icon size={28} />
                            </div>
                            <span className="font-bold text-white text-sm text-center">{service.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Identity Management */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                    <ShieldCheck size={20} className="text-emerald-400" />
                    Identity Management
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {services.filter(s => s.id.includes('nin') || s.id.includes('bvn')).map((service) => (
                        <button
                            key={service.id}
                            onClick={() => handleServiceClick(service)}
                            className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:bg-slate-800 active:scale-95 group"
                        >
                            <div className={`p-4 rounded-full ${service.bg} ${service.color} group-hover:scale-110 transition-transform`}>
                                <service.icon size={28} />
                            </div>
                            <span className="font-bold text-white text-xs text-center">{service.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Payment Modal */}
            {selectedService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setSelectedService(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-xl ${selectedService.bg} ${selectedService.color}`}>
                                <selectedService.icon size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-white">{selectedService.name}</h2>
                        </div>

                        <div className="space-y-4">
                            {/* Data/Airtime Provider Selection */}
                            {(selectedService.id === 'data' || selectedService.id === 'airtime') && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300">Select Network</label>
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => {
                                            setSelectedProvider(e.target.value);
                                            setSelectedPlan(null);
                                            setAmount('');
                                        }}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 appearance-none"
                                    >
                                        <option value="">Select Network Provider</option>
                                        <option value="MTN">MTN</option>
                                        <option value="AIRTEL">Airtel</option>
                                        <option value="GLO">Glo</option>
                                        <option value="9MOBILE">9mobile</option>
                                    </select>
                                </div>
                            )}

                            {/* Electricity Provider Selection */}
                            {selectedService.id === 'power' && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300">Select Provider</label>
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 appearance-none"
                                    >
                                        <option value="">Select Disco</option>
                                        {electricityProviders.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Data Plan Selection */}
                            {selectedService.id === 'data' && selectedProvider && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300">Select Data Plan</label>
                                    <select
                                        onChange={handlePlanSelect}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 appearance-none"
                                    >
                                        <option value="">Select Plan</option>
                                        {(dataPlans as any)[selectedProvider]?.map((plan: any) => (
                                            <option key={plan.id} value={plan.id}>{plan.name} - ₦{plan.price}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <Input
                                label={selectedService.id === 'data' ? "Amount (Auto)" : "Amount"}
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                icon={<span>₦</span>}
                                placeholder="0.00"
                                readOnly={!!selectedPlan} // Read-only if plan selected
                                className={selectedPlan ? "opacity-70 cursor-not-allowed" : ""}
                            />

                            <Input
                                label={getLabel()}
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="Enter number"
                                maxLength={isIdentityService(selectedService.id) && selectedService.id !== 'bvn_retrieval' ? 11 : undefined}
                            />

                            {requiresDetails(selectedService.id) && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300">Request Details</label>
                                    <textarea
                                        value={details}
                                        onChange={(e) => setDetails(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors h-24"
                                        placeholder="Describe the changes required..."
                                    />
                                </div>
                            )}

                            <Input
                                label="Transaction PIN"
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                maxLength={4}
                                placeholder="****"
                            />

                            <Button onClick={handlePayment} disabled={loading} className="w-full mt-4">
                                {loading ? <Loader2 className="animate-spin" /> : `Confirm ${isIdentityService(selectedService.id) ? 'Request' : 'Payment'}`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Result Modal */}
            {showResultModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowResultModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex flex-col items-center gap-4 mb-6 text-center">
                            <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-500">
                                <CheckCircle size={48} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Success</h2>
                        </div>

                        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                            {verificationResult?.firstName && (
                                <div className="flex justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-400">First Name</span>
                                    <span className="font-bold text-white">{verificationResult.firstName}</span>
                                </div>
                            )}
                            {verificationResult?.lastName && (
                                <div className="flex justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-400">Last Name</span>
                                    <span className="font-bold text-white">{verificationResult.lastName}</span>
                                </div>
                            )}
                            {verificationResult?.valid !== undefined && (
                                <div className="flex justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-400">Valid</span>
                                    <span className="font-bold text-emerald-400">{verificationResult.valid ? 'Yes' : 'No'}</span>
                                </div>
                            )}
                            {verificationResult?.bvn && (
                                <div className="flex justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-400">BVN</span>
                                    <span className="font-bold text-white">{verificationResult.bvn}</span>
                                </div>
                            )}
                            {verificationResult?.status && (
                                <div className="flex justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-400">Status</span>
                                    <span className="font-bold text-white">{verificationResult.status}</span>
                                </div>
                            )}
                            {verificationResult?.reference && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Ref ID</span>
                                    <span className="font-bold text-amber-500 font-mono">{verificationResult.reference}</span>
                                </div>
                            )}
                        </div>

                        <Button onClick={() => setShowResultModal(false)} className="w-full mt-6">
                            Close
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
