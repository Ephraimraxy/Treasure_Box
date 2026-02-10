import React, { useState } from 'react';
import { Smartphone, Wifi, Zap, Tv, ArrowRightLeft, X, Loader2, UserCheck, ShieldCheck, CheckCircle, FileText, UserCog, Search, Edit } from 'lucide-react';
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

export const ServicesPage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const [selectedService, setSelectedService] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [identifier, setIdentifier] = useState(''); // Phone, Meter, IUC, NIN, BVN
    const [details, setDetails] = useState(''); // For modifications/personalization
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [verificationResult, setVerificationResult] = useState<any>(null);
    const [showResultModal, setShowResultModal] = useState(false);

    const handleServiceClick = (service: any) => {
        setSelectedService(service);
        setAmount('');
        setIdentifier('');
        setDetails('');
        setPin('');
    };

    const handlePayment = async () => {
        if (!amount || !identifier || !pin) {
            addToast('error', 'Please fill all required fields');
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
                meta: { identifier, details, serviceName: selectedService.name },
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
        return "Smart Card / Meter No.";
    };

    return (
        <div className="space-y-4 animate-fade-in relative">
            <h1 className="text-lg font-bold text-white">Other Services</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {services.map((service) => (
                    <button
                        key={service.id}
                        onClick={() => handleServiceClick(service)}
                        className="bg-slate-800 border border-slate-700 hover:border-slate-500 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all active:scale-95"
                    >
                        <div className={`p-4 rounded-full ${service.bg} ${service.color}`}>
                            <service.icon size={32} />
                        </div>
                        <span className="font-bold text-white text-sm text-center">{service.name}</span>
                    </button>
                ))}
            </div>

            <Card className="bg-gradient-to-r from-amber-900/20 to-slate-800">
                <div className="flex items-center gap-2">
                    <div className="p-4 bg-amber-500/20 rounded-xl">
                        <Zap className="text-amber-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Quick & Easy Payments</h3>
                        <p className="text-sm text-slate-400">
                            Pay your utility bills directly from your wallet with instant confirmation.
                        </p>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Card>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-amber-500 mb-1">₦0</div>
                        <div className="text-xs text-slate-400">Transaction Fee</div>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-emerald-500 mb-1">Instant</div>
                        <div className="text-xs text-slate-400">Processing Time</div>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-500 mb-1">24/7</div>
                        <div className="text-xs text-slate-400">Availability</div>
                    </div>
                </Card>
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
                            <Input
                                label="Amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                icon={<span>₦</span>}
                                placeholder="0.00"
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
