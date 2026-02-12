import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Send, Building2, Search, CheckCircle, Loader2, ArrowLeft,
    Info, Star, StarOff, ChevronRight, User, Lock, FileText, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { transactionApi, paymentApi, userApi } from '../api';
import { FormatCurrency, Spinner, Button, Input } from '../components/ui';

export const TransferPage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Step state: 1=Amount, 2=Bank, 3=Desc+PIN, 4=Confirm
    const [step, setStep] = useState(1);

    // Form state
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [description, setDescription] = useState('');
    const [saveBeneficiary, setSaveBeneficiary] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);

    // Bank state
    const [banks, setBanks] = useState<any[]>([]);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankData, setBankData] = useState({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
    const [verifyingAccount, setVerifyingAccount] = useState(false);
    const [accountVerified, setAccountVerified] = useState(false);

    // Settings
    const [settings, setSettings] = useState({ minWithdrawal: 0, maxWithdrawal: 1000000 });

    // PIN management
    const [pinModal, setPinModal] = useState(false);
    const [pinStep, setPinStep] = useState(1);
    const [pinInputs, setPinInputs] = useState({ pin: '', confirm: '', password: '' });
    const [pinLoading, setPinLoading] = useState(false);

    useEffect(() => {
        paymentApi.getBanks().then(res => setBanks(res.data || [])).catch(console.error);
        userApi.getSettings().then(res => setSettings(res.data)).catch(console.error);
    }, []);

    // Auto-verify account when bank + 10-digit number entered
    useEffect(() => {
        if (bankData.accountNumber.length === 10 && bankData.bankCode) {
            verifyAccountInline();
        } else {
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
            addToast('error', 'Could not verify account');
        } finally {
            setVerifyingAccount(false);
        }
    };

    const filteredBanks = banks.filter((b: any) =>
        b.name?.toLowerCase().includes(bankSearch.toLowerCase())
    );

    const selectBank = (bank: any) => {
        setBankData(prev => ({ ...prev, accountName: '', bankName: bank.name, bankCode: bank.code }));
        setBankSearch('');
        setShowBankDropdown(false);
        setAccountVerified(false);
    };

    // ─── Transfer Submit ───
    const handleTransferSubmit = async () => {
        if (!user?.transactionPin) {
            setPinModal(true);
            return;
        }
        if (!pin) {
            addToast('error', 'Please enter your transaction PIN');
            return;
        }

        setTransferLoading(true);
        try {
            // 1. Save bank details (always required by server)
            const bankRes = await userApi.updateBankDetails({
                bankName: bankData.bankName,
                bankCode: bankData.bankCode,
                accountNumber: bankData.accountNumber,
                accountName: bankData.accountName
            });
            await refreshUser();

            // Get the newly created bank ID
            const updatedUser = await userApi.getProfile();
            const bankDetails = updatedUser.data.bankDetails || [];
            const matchedBank = bankDetails.find((b: any) =>
                b.accountNumber === bankData.accountNumber && b.bankCode === bankData.bankCode
            );
            const bankDetailId = matchedBank?.id;

            // 2. Process transfer
            await transactionApi.withdraw(parseFloat(amount), pin, bankDetailId);
            addToast('success', 'Transfer submitted successfully!');

            // 3. If NOT saving beneficiary, delete the bank detail
            if (!saveBeneficiary && bankDetailId) {
                try {
                    await userApi.deleteBankDetail(bankDetailId);
                } catch {
                    // Non-critical — silently ignore
                }
            }

            await refreshUser();
            navigate('/');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Transfer failed');
        } finally {
            setTransferLoading(false);
        }
    };

    // ─── PIN Setup Handler ───
    const handlePinSubmit = async () => {
        setPinLoading(true);
        try {
            if (pinInputs.pin !== pinInputs.confirm) {
                addToast('error', 'PINs do not match');
                setPinLoading(false);
                return;
            }
            await userApi.setPin(pinInputs.pin, pinInputs.password);
            addToast('success', 'Transaction PIN set!');
            await refreshUser();
            setPinModal(false);
            setPinInputs({ pin: '', confirm: '', password: '' });
            setPinStep(1);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed');
        } finally {
            setPinLoading(false);
        }
    };

    const canProceedStep1 = () => {
        const amt = parseFloat(amount);
        return amt >= settings.minWithdrawal && amt <= settings.maxWithdrawal && amt <= (user?.balance || 0);
    };

    const canProceedStep2 = () => accountVerified;
    const canProceedStep3 = () => pin.length === 4;

    const stepLabels = ['Amount', 'Bank', 'Details', 'Confirm'];

    return (
        <div className="min-h-[80vh] flex flex-col max-w-md mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white">Transfer</h1>
                    <p className="text-xs text-slate-500">Send money to a bank account</p>
                </div>
                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                    <Send size={20} className="text-blue-500" />
                </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1 mb-6">
                {stepLabels.map((label, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full h-1 rounded-full transition-all ${i + 1 <= step ? 'bg-blue-500' : 'bg-slate-800'}`} />
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${i + 1 === step ? 'text-blue-400' : i + 1 < step ? 'text-blue-500/50' : 'text-slate-600'}`}>{label}</span>
                    </div>
                ))}
            </div>

            {/* ════════════════════════════════════ */}
            {/* STEP 1: Amount */}
            {/* ════════════════════════════════════ */}
            {step === 1 && (
                <div className="flex-1 flex flex-col">
                    <div className="text-center mb-6">
                        <p className="text-sm text-slate-400">How much do you want to send?</p>
                        <p className="text-xs text-slate-600 mt-1">
                            Balance: <FormatCurrency amount={user?.balance || 0} />
                        </p>
                    </div>

                    <div className="relative mb-4">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-600">₦</div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-5 text-3xl font-black text-white text-center focus:outline-none focus:border-blue-500 placeholder:text-slate-800 font-mono"
                        />
                    </div>

                    {parseFloat(amount) > (user?.balance || 0) && (
                        <p className="text-xs text-red-400 text-center mb-2">Insufficient balance</p>
                    )}

                    <div className="flex gap-2 mb-6">
                        {[1000, 5000, 10000, 50000].map(preset => (
                            <button
                                key={preset}
                                onClick={() => setAmount(String(preset))}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${amount === String(preset)
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                                    }`}
                            >
                                ₦{preset >= 1000 ? `${preset / 1000}k` : preset}
                            </button>
                        ))}
                    </div>

                    <p className="text-[10px] text-slate-600 text-center mb-4">
                        Min: <FormatCurrency amount={settings.minWithdrawal} /> • Max: <FormatCurrency amount={settings.maxWithdrawal} />
                    </p>

                    <div className="mt-auto">
                        <Button onClick={() => setStep(2)} disabled={!canProceedStep1()} className="w-full py-3.5">
                            Continue
                        </Button>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════ */}
            {/* STEP 2: Bank Details */}
            {/* ════════════════════════════════════ */}
            {step === 2 && (
                <div className="flex-1 flex flex-col">
                    <p className="text-sm text-slate-400 mb-4">
                        Where should we send <span className="text-white font-bold"><FormatCurrency amount={parseFloat(amount)} /></span>?
                    </p>

                    {/* Bank Selector */}
                    <div className="relative mb-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Select Bank</label>
                        <button
                            type="button"
                            onClick={() => setShowBankDropdown(!showBankDropdown)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-left hover:border-slate-600 transition-colors text-sm"
                        >
                            <div className="flex items-center gap-2.5">
                                <Building2 size={16} className="text-slate-500" />
                                <span className={bankData.bankName ? 'text-white font-medium' : 'text-slate-500'}>{bankData.bankName || 'Choose your bank'}</span>
                            </div>
                            <ChevronRight size={14} className={`text-slate-500 transition-transform ${showBankDropdown ? 'rotate-90' : ''}`} />
                        </button>

                        {showBankDropdown && (
                            <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                                <div className="p-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500"
                                            placeholder="Search banks..."
                                            value={bankSearch}
                                            onChange={(e) => setBankSearch(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                    {filteredBanks.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-slate-500">No banks found</div>
                                    ) : filteredBanks.slice(0, 30).map((bank: any) => (
                                        <button
                                            key={bank.code}
                                            onClick={() => selectBank(bank)}
                                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between ${bankData.bankCode === bank.code ? 'bg-blue-500/10 text-blue-400' : 'text-white'}`}
                                        >
                                            {bank.name}
                                            {bankData.bankCode === bank.code && <CheckCircle size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Account Number */}
                    <div className="mb-3">
                        <Input
                            label="Account Number"
                            value={bankData.accountNumber}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setBankData({ ...bankData, accountNumber: val });
                            }}
                            placeholder="Enter 10-digit account number"
                            maxLength={10}
                        />
                    </div>

                    {/* Account Verification Status */}
                    <div className={`px-4 py-3 rounded-xl border flex items-center gap-2.5 mb-4 ${accountVerified
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-slate-900 border-slate-700'
                        }`}>
                        {verifyingAccount ? (
                            <><Loader2 size={16} className="text-blue-400 animate-spin" /><span className="text-slate-400 text-xs">Verifying account...</span></>
                        ) : accountVerified ? (
                            <>
                                <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                                    <User size={14} className="text-emerald-400" />
                                </div>
                                <div>
                                    <div className="text-white font-semibold text-sm">{bankData.accountName}</div>
                                    <div className="text-[10px] text-emerald-400">✓ Account verified</div>
                                </div>
                            </>
                        ) : (
                            <span className="text-xs text-slate-500">
                                {bankData.bankCode && bankData.accountNumber.length === 10
                                    ? 'Could not verify account'
                                    : 'Select a bank & enter account number to verify'}
                            </span>
                        )}
                    </div>

                    <div className="mt-auto">
                        <Button onClick={() => setStep(3)} disabled={!canProceedStep2()} className="w-full py-3.5">
                            Continue
                        </Button>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════ */}
            {/* STEP 3: Description + PIN + Save */}
            {/* ════════════════════════════════════ */}
            {step === 3 && (
                <div className="flex-1 flex flex-col">
                    {/* Transfer Summary Card */}
                    <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl mb-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Sending</div>
                                <div className="text-xl font-black text-white"><FormatCurrency amount={parseFloat(amount)} /></div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-semibold text-white">{bankData.accountName}</div>
                                <div className="text-[10px] text-blue-400">{bankData.accountNumber} • {bankData.bankName}</div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Description <span className="text-slate-700">(optional)</span></label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. School fees, Family support..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                            maxLength={60}
                        />
                    </div>

                    {/* PIN */}
                    <div className="mb-4">
                        <Input
                            label="Transaction PIN"
                            type="password"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 4-digit PIN"
                            className="tracking-[0.3em] text-center text-lg"
                        />
                        <div className="flex justify-end mt-1">
                            <button onClick={() => navigate('/profile')} className="text-[10px] text-slate-500 hover:text-amber-500 transition-colors">
                                Forgot PIN?
                            </button>
                        </div>
                    </div>

                    {/* Save Beneficiary Toggle */}
                    <button
                        onClick={() => setSaveBeneficiary(!saveBeneficiary)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all mb-4 ${saveBeneficiary
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${saveBeneficiary ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
                            {saveBeneficiary ? <Star size={16} className="text-amber-500 fill-amber-500" /> : <StarOff size={16} className="text-slate-500" />}
                        </div>
                        <div className="text-left flex-1">
                            <div className={`text-sm font-semibold ${saveBeneficiary ? 'text-amber-400' : 'text-white'}`}>Save Beneficiary</div>
                            <div className="text-[10px] text-slate-500">Save this bank account for future transfers</div>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${saveBeneficiary ? 'bg-amber-500' : 'bg-slate-700'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${saveBeneficiary ? 'left-5' : 'left-0.5'}`} />
                        </div>
                    </button>

                    <div className="mt-auto">
                        <Button onClick={() => setStep(4)} disabled={!canProceedStep3()} className="w-full py-3.5">
                            Review Transfer
                        </Button>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════ */}
            {/* STEP 4: Confirmation */}
            {/* ════════════════════════════════════ */}
            {step === 4 && (
                <div className="flex-1 flex flex-col">
                    <div className="text-center mb-5">
                        <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Send size={24} className="text-blue-400" />
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Review & Confirm</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-4">
                        {[
                            { label: 'Amount', value: <span className="font-bold font-mono"><FormatCurrency amount={parseFloat(amount)} /></span> },
                            { label: 'Recipient', value: <span className="text-xs">{bankData.accountName}</span> },
                            { label: 'Account', value: <span className="font-mono text-xs">{bankData.accountNumber}</span> },
                            { label: 'Bank', value: <span className="text-xs">{bankData.bankName}</span> },
                            ...(description ? [{ label: 'Description', value: <span className="text-xs">{description}</span> }] : []),
                            { label: 'Save Beneficiary', value: <span className={`text-xs font-bold ${saveBeneficiary ? 'text-amber-400' : 'text-slate-500'}`}>{saveBeneficiary ? 'Yes' : 'No'}</span> },
                            { label: 'PIN', value: <span className="font-mono tracking-widest">••••</span> },
                        ].map((row, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-slate-800/60 last:border-0">
                                <span className="text-xs text-slate-500">{row.label}</span>
                                <span className="text-white">{row.value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="text-xs text-blue-400 bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 flex items-start gap-2 mb-4">
                        <Info size={14} className="shrink-0 mt-0.5" />
                        <span>Funds will be sent to the recipient's bank account. Processing may take 1–24 hours.</span>
                    </div>

                    <div className="mt-auto">
                        <Button
                            onClick={handleTransferSubmit}
                            disabled={transferLoading}
                            className="w-full py-3.5"
                        >
                            {transferLoading ? (
                                <span className="flex items-center gap-2">
                                    <Spinner className="w-4 h-4" /> Processing...
                                </span>
                            ) : (
                                'Confirm & Send'
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════ */}
            {/* PIN Setup Modal */}
            {/* ════════════════════════════════════ */}
            {pinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setPinModal(false)} />
                    <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-white">Set Transaction PIN</h3>
                            <button onClick={() => setPinModal(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        {pinStep === 1 && (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-400">Create a 4-digit PIN for transactions.</p>
                                <Input type="password" placeholder="Enter PIN" maxLength={4} value={pinInputs.pin} onChange={e => setPinInputs({ ...pinInputs, pin: e.target.value.replace(/\D/g, '') })} className="text-center tracking-widest" />
                                <Button onClick={() => pinInputs.pin.length === 4 ? setPinStep(2) : addToast('error', 'Enter 4 digits')} className="w-full">Next</Button>
                            </div>
                        )}
                        {pinStep === 2 && (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-400">Confirm your PIN.</p>
                                <Input type="password" placeholder="Confirm PIN" maxLength={4} value={pinInputs.confirm} onChange={e => setPinInputs({ ...pinInputs, confirm: e.target.value.replace(/\D/g, '') })} className="text-center tracking-widest" />
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setPinStep(1)} className="flex-1">Back</Button>
                                    <Button onClick={() => pinInputs.pin === pinInputs.confirm ? setPinStep(3) : addToast('error', 'PINs do not match')} className="flex-1">Next</Button>
                                </div>
                            </div>
                        )}
                        {pinStep === 3 && (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-400">Enter login password to authorize.</p>
                                <Input type="password" placeholder="Password" value={pinInputs.password} onChange={e => setPinInputs({ ...pinInputs, password: e.target.value })} />
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setPinStep(2)} className="flex-1">Back</Button>
                                    <Button onClick={handlePinSubmit} disabled={pinLoading || !pinInputs.password} className="flex-1">{pinLoading ? 'Saving...' : 'Submit'}</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
