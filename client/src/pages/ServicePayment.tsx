import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Smartphone, Wifi, Zap, Tv, ArrowRightLeft, ArrowLeft, Loader2, UserCheck, ShieldCheck, CheckCircle, UserCog, Search, Edit, Wallet, AlertCircle, Info, Shield, Car, Heart, Home, Ambulance } from 'lucide-react';
import { Card, Button, Input } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { transactionApi } from '../api';
import { useAuth } from '../contexts/AuthContext';

// ─── Constants ───
const SERVICE_CHARGE = 4; // ₦4 per VTU transaction

// ─── Network Detection ───
const NETWORK_PREFIXES: Record<string, string[]> = {
    MTN: ['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906', '0913', '0916'],
    GLO: ['0805', '0807', '0705', '0815', '0905', '0907', '0915'],
    AIRTEL: ['0802', '0808', '0708', '0812', '0701', '0901', '0902', '0904', '0912'],
    '9MOBILE': ['0809', '0817', '0818', '0909', '0908'],
    'SMILE': ['0702'],
};

const NETWORK_COLORS: Record<string, { text: string; bg: string }> = {
    MTN: { text: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    GLO: { text: 'text-green-400', bg: 'bg-green-500/20' },
    AIRTEL: { text: 'text-red-400', bg: 'bg-red-500/20' },
    '9MOBILE': { text: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    'SMILE': { text: 'text-pink-400', bg: 'bg-pink-500/20' },
};

const VTPASS_SERVICE_MAP: Record<string, string> = {
    'MTN-airtime': 'mtn', 'GLO-airtime': 'glo', 'AIRTEL-airtime': 'airtel', '9MOBILE-airtime': 'etisalat',
    'MTN-data': 'mtn-data', 'GLO-data': 'glo-data', 'AIRTEL-data': 'airtel-data', '9MOBILE-data': 'etisalat-data',
    'SMILE-data': 'smile-direct',
};

const detectNetwork = (phone: string): string | null => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 4) return null;
    const prefix = cleaned.substring(0, 4);
    for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix)) return network;
    }
    return null;
};

// ─── Electricity Discos (VTPass serviceIDs) ───
const ELECTRICITY_DISCOS = [
    { id: 'ikeja-electric', name: 'Ikeja Electric (IKEDC)' },
    { id: 'eko-electric', name: 'Eko Electric (EKEDC)' },
    { id: 'abuja-electric', name: 'Abuja Electric (AEDC)' },
    { id: 'ibadan-electric', name: 'Ibadan Electric (IBEDC)' },
    { id: 'kano-electric', name: 'Kano Electric (KEDCO)' },
    { id: 'portharcourt-electric', name: 'Port Harcourt Electric (PHED)' },
    { id: 'jos-electric', name: 'Jos Electric (JED)' },
    { id: 'kaduna-electric', name: 'Kaduna Electric (KAEDCO)' },
    { id: 'enugu-electric', name: 'Enugu Electric (EEDC)' },
    { id: 'benin-electric', name: 'Benin Electric (BEDC)' },
];

// ─── Cable TV Providers (VTPass serviceIDs) ───
const CABLE_PROVIDERS = [
    { id: 'dstv', name: 'DStv' },
    { id: 'gotv', name: 'GOtv' },
    { id: 'startimes', name: 'StarTimes' },
];

// ─── Insurance Types ───
const INSURANCE_TYPES = [
    { id: 'third-party-motor-insurance', name: 'Third Party Motor', icon: Car },
    { id: 'health-insurance', name: 'Health Insurance (HMO)', icon: Heart },
    { id: 'home-cover', name: 'Home Cover', icon: Home },
    { id: 'personal-accident-insurance', name: 'Personal Accident', icon: Ambulance },
];

const INSURANCE_FORM_FIELDS: Record<string, string[]> = {
    'third-party-motor-insurance': ['Insured_Name', 'Engine_Number', 'Chassis_Number', 'Plate_Number', 'Vehicle_Make', 'Vehicle_Color', 'Vehicle_Model', 'Year_of_Make', 'Contact_Address'],
    'health-insurance': ['Insured_Name', 'Contact_Address', 'Date_of_Birth'], // Hypothetical fields
    'home-cover': ['Insured_Name', 'Contact_Address'],
    'personal-accident-insurance': ['Insured_Name', 'Contact_Address'],
};


// ─── Service Definitions ───
const SERVICE_MAP: Record<string, { name: string; icon: any; color: string; bg: string; description: string }> = {
    airtime: { name: 'Buy Airtime', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10', description: 'Top up airtime on any Nigerian mobile network instantly.' },
    data: { name: 'Buy Data', icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10', description: 'Purchase affordable data bundles for all networks.' },
    power: { name: 'Electricity', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', description: 'Pay your electricity bills — prepaid or postpaid meters.' },
    cable: { name: 'Cable TV', icon: Tv, color: 'text-purple-400', bg: 'bg-purple-500/10', description: 'Subscribe or renew your DStv, GOtv, or StarTimes plan.' },
    insurance: { name: 'Insurance', icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10', description: 'Buy Third Party Motor, Health, Home, or Accident insurance.' },
    airtime_cash: { name: 'Airtime to Cash', icon: ArrowRightLeft, color: 'text-pink-400', bg: 'bg-pink-500/10', description: 'Convert your excess airtime back to wallet balance.' },
    nin_validation: { name: 'NIN Validation', icon: UserCheck, color: 'text-orange-400', bg: 'bg-orange-500/10', description: 'Verify the authenticity of a National Identification Number.' },
    nin_modification: { name: 'NIN Modification', icon: Edit, color: 'text-orange-400', bg: 'bg-orange-500/10', description: 'Request updates/corrections to your NIN record.' },
    nin_personalization: { name: 'NIN Personalization', icon: UserCog, color: 'text-orange-400', bg: 'bg-orange-500/10', description: 'Personalize your NIN slip with updated biometric data.' },
    bvn_validation: { name: 'BVN Validation', icon: ShieldCheck, color: 'text-teal-400', bg: 'bg-teal-500/10', description: 'Verify a Bank Verification Number for authenticity.' },
    bvn_modification: { name: 'BVN Modification', icon: Edit, color: 'text-teal-400', bg: 'bg-teal-500/10', description: 'Apply corrections to your BVN details.' },
    bvn_retrieval: { name: 'BVN Retrieval', icon: Search, color: 'text-teal-400', bg: 'bg-teal-500/10', description: 'Retrieve your BVN using your registered phone number.' },
};

// ─── Component ───
export const ServicePaymentPage = () => {
    const { type } = useParams<{ type: string }>();
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();

    const service = type ? SERVICE_MAP[type] : null;

    // Common state
    const [phone, setPhone] = useState('');
    const [amount, setAmount] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [details, setDetails] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [verificationResult, setVerificationResult] = useState<any>(null);

    // Network detection
    const [detectedNetwork, setDetectedNetwork] = useState<string | null>(null);

    // Data plans / Cable bouquets / Insurance types
    const [variations, setVariations] = useState<any[]>([]);
    const [selectedVariation, setSelectedVariation] = useState<any>(null);
    const [loadingVariations, setLoadingVariations] = useState(false);

    // Electricity / Cable / Insurance
    const [selectedProvider, setSelectedProvider] = useState('');
    const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
    const [meterInfo, setMeterInfo] = useState<any>(null);
    const [verifying, setVerifying] = useState(false);

    // Insurance Form State
    const [insuranceFormData, setInsuranceFormData] = useState<Record<string, string>>({});

    const isVTU = type && ['airtime', 'data', 'power', 'cable', 'insurance'].includes(type);
    const isIdentityService = type && ['nin_validation', 'nin_modification', 'nin_personalization', 'bvn_validation', 'bvn_modification', 'bvn_retrieval'].includes(type);
    const requiresDetails = type && ['nin_modification', 'nin_personalization', 'bvn_modification'].includes(type);

    const numericAmount = parseFloat(amount) || 0;
    const totalCost = isVTU ? numericAmount + SERVICE_CHARGE : numericAmount;

    // ─── Auto-detect network from phone number ───
    useEffect(() => {
        if (type === 'airtime' || type === 'data') {
            const network = detectNetwork(phone);
            setDetectedNetwork(network);
        }
    }, [phone, type]);

    // ─── Fetch data plans when network is detected (or changes) ───
    useEffect(() => {
        if (type === 'data') {
            // Reset variations and fetch new plans when network changes
            setVariations([]);
            setSelectedVariation(null);
            setAmount('');
            if (detectedNetwork) {
                const serviceID = VTPASS_SERVICE_MAP[`${detectedNetwork}-data`];
                if (serviceID) {
                    fetchVariations(serviceID);
                }
            }
        }
    }, [detectedNetwork, type]);

    // ─── Fetch cable bouquets / Insurance Variations ───
    useEffect(() => {
        if ((type === 'cable' || type === 'insurance') && selectedProvider) {
            fetchVariations(selectedProvider);
        }
    }, [selectedProvider, type]);

    const fetchVariations = async (serviceID: string) => {
        setLoadingVariations(true);
        setVariations([]);
        try {
            const res = await transactionApi.getVariations(serviceID);
            const content = res.data?.content;
            if (content?.varations) {
                setVariations(content.varations); // VTPass typo: "varations"
            } else if (content?.variations) {
                setVariations(content.variations);
            } else if (Array.isArray(content)) {
                setVariations(content);
            }
        } catch (err: any) {
            console.error('Failed to fetch variations:', err);
            addToast('error', 'Failed to load available plans. Please try again.');
        } finally {
            setLoadingVariations(false);
        }
    };

    // ─── Verify meter / smart card ───
    const handleVerify = async () => {
        if (!identifier || !selectedProvider) return;
        setVerifying(true);
        setMeterInfo(null);
        try {
            const res = await transactionApi.verifyMeter({
                billersCode: identifier,
                serviceID: selectedProvider,
                type: type === 'power' ? meterType : 'prepaid',
            });
            const content = res.data?.content;
            if (content?.Customer_Name || content?.customerName) {
                setMeterInfo({
                    customerName: content.Customer_Name || content.customerName || content.Customer_name,
                    meterNumber: content.MeterNumber || content.meter_number || identifier,
                    address: content.Address || content.address || '',
                    type: content.type || meterType,
                });
                addToast('success', `Verified: ${content.Customer_Name || content.customerName}`);
            } else {
                addToast('error', 'Could not verify. Please check the number and try again.');
            }
        } catch (err: any) {
            addToast('error', err.response?.data?.error || 'Verification failed. Please try again.');
        } finally {
            setVerifying(false);
        }
    };

    // ─── Handle Payment ───
    const handlePayment = async () => {
        if (!pin || pin.length !== 4) { addToast('error', 'Please enter your 4-digit PIN'); return; }
        if (totalCost > (user?.balance || 0)) { addToast('error', 'Insufficient balance'); return; }

        // Validation per type
        if (type === 'airtime') {
            if (!phone || phone.length < 11) { addToast('error', 'Please enter a valid phone number'); return; }
            if (!numericAmount || numericAmount < 50) { addToast('error', 'Minimum airtime is ₦50'); return; }
            if (!detectedNetwork) { addToast('error', 'Could not detect network. Please check the phone number.'); return; }
        } else if (type === 'data') {
            if (!phone || phone.length < 11) { addToast('error', 'Please enter a valid phone number'); return; }
            if (!selectedVariation) { addToast('error', 'Please select a data plan'); return; }
        } else if (type === 'power') {
            if (!selectedProvider) { addToast('error', 'Please select an electricity provider'); return; }
            if (!identifier) { addToast('error', 'Please enter your meter number'); return; }
            if (!meterInfo) { addToast('error', 'Please verify your meter number first'); return; }
        } else if (type === 'cable') {
            if (!selectedProvider) { addToast('error', 'Please select a cable TV provider'); return; }
            if (!identifier) { addToast('error', 'Please enter your smart card number'); return; }
            if (!selectedVariation) { addToast('error', 'Please select a bouquet'); return; }
        } else if (type === 'insurance') {
            if (!selectedProvider) { addToast('error', 'Please select an insurance type'); return; }
            if (!selectedVariation) { addToast('error', 'Please select a plan'); return; }
            // Validate dynamic fields
            const requiredFields = INSURANCE_FORM_FIELDS[selectedProvider] || [];
            for (const field of requiredFields) {
                if (!insuranceFormData[field]) {
                    addToast('error', `Please enter ${field.replace(/_/g, ' ')}`);
                    return;
                }
            }
        } else if (isIdentityService) {
            if (!identifier) { addToast('error', `Please enter the ${type?.includes('nin') ? 'NIN' : 'BVN'} number`); return; }
            if (!numericAmount) { addToast('error', 'Please enter amount'); return; }
        }

        setLoading(true);
        try {
            // Build meta per type
            let meta: any = {};
            let payAmount = numericAmount;

            if (type === 'airtime') {
                const serviceID = VTPASS_SERVICE_MAP[`${detectedNetwork}-airtime`] || 'mtn';
                meta = { identifier: phone, phone, network: detectedNetwork, serviceID, serviceName: service?.name };
                payAmount = numericAmount;
            } else if (type === 'data') {
                const serviceID = VTPASS_SERVICE_MAP[`${detectedNetwork}-data`] || 'mtn-data';
                meta = {
                    identifier: phone, phone, network: detectedNetwork, serviceID,
                    variationCode: selectedVariation.variation_code,
                    planName: selectedVariation.name,
                    serviceName: service?.name,
                };
                payAmount = parseFloat(selectedVariation.variation_amount) || numericAmount;
            } else if (type === 'power') {
                meta = {
                    identifier, meterNumber: identifier, serviceID: selectedProvider,
                    variationCode: meterType, meterType, phone: user?.phone || '',
                    provider: selectedProvider, customerName: meterInfo?.customerName,
                    serviceName: service?.name,
                };
                payAmount = numericAmount;
            } else if (type === 'cable') {
                meta = {
                    identifier, smartCardNumber: identifier, serviceID: selectedProvider,
                    variationCode: selectedVariation.variation_code,
                    bouquetName: selectedVariation.name,
                    provider: selectedProvider, phone: user?.phone || '',
                    serviceName: service?.name,
                };
                payAmount = parseFloat(selectedVariation.variation_amount) || numericAmount;
            } else if (type === 'insurance') {
                meta = {
                    serviceID: selectedProvider,
                    variationCode: selectedVariation.variation_code,
                    planName: selectedVariation.name,
                    serviceName: service?.name,
                    phone: user?.phone || '',
                    billersCode: insuranceFormData['Plate_Number'] || identifier, // Use plate number as identifier if available
                    ...insuranceFormData // Spread dynamic fields
                };
                payAmount = parseFloat(selectedVariation.variation_amount) || numericAmount;
            } else {
                meta = { identifier, details, serviceName: service?.name };
                payAmount = numericAmount;
            }

            const response = await transactionApi.payUtility({
                type: type!.toUpperCase(),
                amount: payAmount,
                meta,
                pin,
            });

            await refreshUser();

            if (response.data.verificationData) {
                setVerificationResult(response.data.verificationData);
            }
            setSuccess(true);
            addToast('success', `${service?.name} successful!`);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

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

    // ─── Network Badge ───
    const NetworkBadge = () => {
        if (!detectedNetwork) return null;
        const colors = NETWORK_COLORS[detectedNetwork];
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${colors?.bg || 'bg-muted/50'} ${colors?.text || 'text-muted'} border border-current/20`}>
                <span className="w-2 h-2 rounded-full bg-current" />
                {detectedNetwork}
            </span>
        );
    };

    // ─── Payment Form ───
    return (
        <div className="max-w-lg mx-auto animate-fade-in space-y-6">
            {/* Back Button / Header (Keep generic) */}
            <button onClick={() => navigate('/services')} className="flex items-center gap-2 text-muted hover:text-foreground transition-colors group">
                <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-sm font-medium">Back to Services</span>
            </button>

            {/* Service Header */}
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${service.bg.replace('/10', '')}`} />
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

                    {/* ═══════ AIRTIME FLOW ═══════ */}
                    {type === 'airtime' && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted">Phone Number</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                        placeholder="0803 XXX XXXX"
                                        maxLength={11}
                                        className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors pr-24"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {phone.length >= 4 && <NetworkBadge />}
                                    </div>
                                </div>
                                {phone.length >= 4 && !detectedNetwork && (
                                    <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} /> Unrecognized network prefix</p>
                                )}
                            </div>
                            <Input label="Amount (₦)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} icon={<span className="text-muted font-bold">₦</span>} placeholder="100" />
                        </>
                    )}

                    {/* ═══════ DATA FLOW ═══════ */}
                    {type === 'data' && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted">Phone Number (MTN, Glo, Airtel, 9Mobile, Smile)</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                        placeholder="0803 XXX XXXX or 0702..."
                                        maxLength={11}
                                        className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors pr-24"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {phone.length >= 4 && <NetworkBadge />}
                                    </div>
                                </div>
                            </div>

                            {detectedNetwork && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted">
                                        Select Data Plan {loadingVariations && <Loader2 size={14} className="inline animate-spin ml-1" />}
                                    </label>
                                    {loadingVariations ? (
                                        <div className="flex items-center justify-center py-8 text-muted"><Loader2 size={24} className="animate-spin mr-2" /> Loading plans...</div>
                                    ) : variations.length === 0 ? (
                                        <div className="text-center py-6 text-muted text-sm">No plans available.</div>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                            {variations.map((v: any, i: number) => (
                                                <button
                                                    key={v.variation_code || i}
                                                    onClick={() => { setSelectedVariation(v); setAmount(v.variation_amount?.toString() || '0'); }}
                                                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${selectedVariation?.variation_code === v.variation_code ? 'bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/30' : 'bg-card border-border text-muted hover:border-primary/30 hover:text-foreground'}`}
                                                >
                                                    <span className="text-sm font-medium flex-1 pr-3">{v.name}</span>
                                                    <span className={`text-sm font-bold whitespace-nowrap ${selectedVariation?.variation_code === v.variation_code ? 'text-primary' : 'text-muted'}`}>₦{parseFloat(v.variation_amount || 0).toLocaleString()}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══════ ELECTRICITY FLOW ═══════ */}
                    {type === 'power' && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted">Select Provider (DisCo)</label>
                                <select value={selectedProvider} onChange={(e) => { setSelectedProvider(e.target.value); setMeterInfo(null); setIdentifier(''); }} className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary appearance-none">
                                    <option value="">Select DisCo</option>
                                    {ELECTRICITY_DISCOS.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                                </select>
                            </div>
                            {selectedProvider && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted">Meter Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['prepaid', 'postpaid'] as const).map(mt => (
                                                <button key={mt} onClick={() => { setMeterType(mt); setMeterInfo(null); }} className={`py-3 rounded-xl text-sm font-bold transition-all border capitalize ${meterType === mt ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-input border-input text-muted hover:border-ring hover:text-foreground'}`}>{mt}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted">Meter Number</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setMeterInfo(null); }} placeholder="Enter meter number" className="flex-1 bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors" />
                                            <Button onClick={handleVerify} disabled={verifying || !identifier} variant="secondary" className="shrink-0">{verifying ? <Loader2 size={16} className="animate-spin" /> : 'Verify'}</Button>
                                        </div>
                                    </div>
                                    {meterInfo && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm"><CheckCircle size={16} /> Meter Verified</div>
                                            <div className="text-sm space-y-1">
                                                <div className="flex justify-between"><span className="text-muted">Customer</span><span className="font-bold text-foreground">{meterInfo.customerName}</span></div>
                                            </div>
                                        </div>
                                    )}
                                    {meterInfo && (<Input label="Amount (₦)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} icon={<span className="text-muted font-bold">₦</span>} placeholder="1000" />)}
                                </>
                            )}
                        </>
                    )}

                    {/* ═══════ CABLE TV FLOW ═══════ */}
                    {type === 'cable' && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted">Select Provider</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CABLE_PROVIDERS.map(p => (
                                        <button key={p.id} onClick={() => { setSelectedProvider(p.id); setSelectedVariation(null); setAmount(''); setIdentifier(''); }} className={`py-3 rounded-xl text-sm font-bold transition-all border ${selectedProvider === p.id ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-input border-input text-muted hover:border-ring hover:text-foreground'}`}>{p.name}</button>
                                    ))}
                                </div>
                            </div>
                            {selectedProvider && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted">Smart Card / IUC Number</label>
                                        <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Enter smart card number" className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted">Select Bouquet {loadingVariations && <Loader2 size={14} className="inline animate-spin ml-1" />}</label>
                                        {variations.length > 0 && (
                                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                                {variations.map((v: any, i: number) => (
                                                    <button key={v.variation_code || i} onClick={() => { setSelectedVariation(v); setAmount(v.variation_amount?.toString() || '0'); }} className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${selectedVariation?.variation_code === v.variation_code ? 'bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/30' : 'bg-card border-border text-muted hover:border-primary/30 hover:text-foreground'}`}>
                                                        <span className="text-sm font-medium flex-1 pr-3">{v.name}</span>
                                                        <span className={`text-sm font-bold whitespace-nowrap ${selectedVariation?.variation_code === v.variation_code ? 'text-primary' : 'text-muted'}`}>₦{parseFloat(v.variation_amount || 0).toLocaleString()}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* ═══════ INSURANCE FLOW ═══════ */}
                    {type === 'insurance' && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted">Insurance Type</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {INSURANCE_TYPES.map(p => (
                                        <button key={p.id} onClick={() => { setSelectedProvider(p.id); setSelectedVariation(null); setAmount(''); setInsuranceFormData({}); }} className={`py-3 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 ${selectedProvider === p.id ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-input border-input text-muted hover:border-ring hover:text-foreground'}`}>
                                            <p.icon size={16} /> {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {selectedProvider && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted">Select Policy {loadingVariations && <Loader2 size={14} className="inline animate-spin ml-1" />}</label>
                                        {variations.length > 0 ? (
                                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                                {variations.map((v: any, i: number) => (
                                                    <button key={v.variation_code || i} onClick={() => { setSelectedVariation(v); setAmount(v.variation_amount?.toString() || '0'); }} className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${selectedVariation?.variation_code === v.variation_code ? 'bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/30' : 'bg-card border-border text-muted hover:border-primary/30 hover:text-foreground'}`}>
                                                        <span className="text-sm font-medium flex-1 pr-3">{v.name}</span>
                                                        <span className={`text-sm font-bold whitespace-nowrap ${selectedVariation?.variation_code === v.variation_code ? 'text-primary' : 'text-muted'}`}>₦{parseFloat(v.variation_amount || 0).toLocaleString()}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : !loadingVariations && (
                                            <div className="text-center py-4 text-muted text-sm">No specific plans found. Proceed with custom amount if applicable.</div>
                                        )}
                                    </div>

                                    {/* Dynamic Form Fields */}
                                    {selectedVariation && (
                                        <div className="space-y-3 pt-2">
                                            <h3 className="text-sm font-bold text-foreground">Required Details</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                {(INSURANCE_FORM_FIELDS[selectedProvider] || []).map((field) => (
                                                    <div key={field} className="space-y-1">
                                                        <label className="text-xs font-medium text-muted uppercase">{field.replace(/_/g, ' ')}</label>
                                                        <input
                                                            type="text"
                                                            value={insuranceFormData[field] || ''}
                                                            onChange={(e) => setInsuranceFormData({ ...insuranceFormData, [field]: e.target.value })}
                                                            className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                                                            placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ═══════ SERVICE INFO SUMMARY (Common) ═══════ */}
                    {numericAmount > 0 && (
                        <div className="bg-muted/50 border border-border/50 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm"><span className="text-muted">Service</span><span className="text-foreground font-medium">{service.name}</span></div>
                            {(type === 'data' || type === 'cable' || type === 'insurance') && selectedVariation && (
                                <div className="flex justify-between text-sm"><span className="text-muted">Plan/Package</span><span className="text-foreground font-medium text-right max-w-[60%]">{selectedVariation.name}</span></div>
                            )}
                            <div className="flex justify-between text-sm"><span className="text-muted">Amount</span><span className="text-foreground font-medium">₦{numericAmount.toLocaleString()}</span></div>
                            {isVTU && <div className="flex justify-between text-sm"><span className="text-muted">Service Charge</span><span className="text-foreground font-medium">₦{SERVICE_CHARGE}</span></div>}
                            <div className="flex justify-between text-sm border-t border-border pt-2 mt-2"><span className="text-muted font-bold">Total</span><span className="text-primary font-bold text-lg">₦{totalCost.toLocaleString()}</span></div>
                        </div>
                    )}

                    <Input label="Transaction PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} placeholder="****" />
                    <Button onClick={handlePayment} disabled={loading} className="w-full">{loading ? <Loader2 className="animate-spin" /> : `Confirm ${isIdentityService ? 'Request' : 'Payment'}`}</Button>
                </div>
            </Card>
        </div>
    );
};
