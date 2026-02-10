import React, { useState, useEffect } from 'react';
import { User, Phone, MapPin, Building2, Shield, Camera, Lock, Search, CheckCircle, Loader2, Plus, Trash2, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { userApi, paymentApi } from '../api';
import { Button, Input, Card, Modal } from '../components/ui';

export const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Loading states
    const [profileLoading, setProfileLoading] = useState(false);
    const [bankLoading, setBankLoading] = useState(false);
    const [virtualAccountLoading, setVirtualAccountLoading] = useState(false);
    const [pinLoading, setPinLoading] = useState(false);
    const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

    // Profile form — initialize from user data
    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        address: user?.address || '',
        username: user?.username || '',
        photoUrl: ''
    });

    // Sync form when user data loads/changes
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || prev.name,
                phone: user.phone || prev.phone,
                address: user.address || prev.address,
                username: user.username || prev.username,
            }));
        }
    }, [user]);

    // Bank add modal
    const [showAddBank, setShowAddBank] = useState(false);
    const [banks, setBanks] = useState<any[]>([]);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankData, setBankData] = useState({
        bankName: '',
        bankCode: '',
        accountNumber: '',
        accountName: '',
    });
    const [verifyingAccount, setVerifyingAccount] = useState(false);
    const [accountVerified, setAccountVerified] = useState(false);

    // PIN modal
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinMode, setPinMode] = useState<'set' | 'change'>('set');
    const [pinData, setPinData] = useState({ oldPin: '', newPin: '', confirmPin: '', password: '' });

    // Fetch banks on mount
    useEffect(() => {
        paymentApi.getBanks().then(res => {
            setBanks(res.data || []);
        }).catch(console.error);
    }, []);

    // Auto-verify account when number + bank are set
    useEffect(() => {
        if (bankData.accountNumber.length === 10 && bankData.bankCode) {
            verifyAccount();
        } else {
            setAccountVerified(false);
            setBankData(prev => ({ ...prev, accountName: '' }));
        }
    }, [bankData.accountNumber, bankData.bankCode]);

    const verifyAccount = async () => {
        setVerifyingAccount(true);
        setAccountVerified(false);
        try {
            const res = await paymentApi.verifyAccount(bankData.accountNumber, bankData.bankCode);
            setBankData(prev => ({ ...prev, accountName: res.data.accountName }));
            setAccountVerified(true);
        } catch {
            setBankData(prev => ({ ...prev, accountName: '' }));
            addToast('error', 'Could not verify account. Please check the details.');
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

    // --- Handlers ---

    const handleProfileUpdate = async () => {
        setProfileLoading(true);
        try {
            await userApi.updateProfile(formData);
            await refreshUser();
            addToast('success', 'Profile updated successfully');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Update failed');
        } finally {
            setProfileLoading(false);
        }
    };

    const handleAddBank = async () => {
        if (!bankData.bankName || !bankData.accountNumber || !bankData.accountName) {
            addToast('error', 'Please fill all bank details');
            return;
        }
        if (!accountVerified) {
            addToast('error', 'Please verify your account first');
            return;
        }
        setBankLoading(true);
        try {
            await userApi.updateBankDetails({
                bankName: bankData.bankName,
                accountNumber: bankData.accountNumber,
                accountName: bankData.accountName,
            });
            await refreshUser();
            addToast('success', 'Bank account added successfully');
            setShowAddBank(false);
            setBankData({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
            setAccountVerified(false);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to add bank');
        } finally {
            setBankLoading(false);
        }
    };

    const handleDeleteBank = async (id: string) => {
        setDeletingBankId(id);
        try {
            await userApi.deleteBankDetail(id);
            await refreshUser();
            addToast('success', 'Bank account removed');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to remove bank');
        } finally {
            setDeletingBankId(null);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            addToast('error', 'Image size must be less than 500KB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const openPinModal = (mode: 'set' | 'change') => {
        setPinMode(mode);
        setPinData({ oldPin: '', newPin: '', confirmPin: '', password: '' });
        setIsPinModalOpen(true);
    };

    const handlePinSubmit = async () => {
        if (pinData.newPin.length !== 4) {
            addToast('error', 'PIN must be 4 digits');
            return;
        }
        if (pinData.newPin !== pinData.confirmPin) {
            addToast('error', 'PINs do not match');
            return;
        }
        setPinLoading(true);
        try {
            if (pinMode === 'set') {
                if (!pinData.password) { addToast('error', 'Please enter your password'); setPinLoading(false); return; }
                await userApi.setPin(pinData.newPin, pinData.password);
                addToast('success', 'PIN set successfully');
            } else {
                if (!pinData.oldPin) { addToast('error', 'Please enter your current PIN'); setPinLoading(false); return; }
                await userApi.changePin(pinData.oldPin, pinData.newPin);
                addToast('success', 'PIN changed successfully');
            }
            setIsPinModalOpen(false);
            await refreshUser();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Operation failed');
        } finally {
            setPinLoading(false);
        }
    };

    const linkedBanks = user?.bankDetails || [];

    return (
        <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
            {/* ─── Profile Header ─── */}
            <Card className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500" />
                <div className="relative pt-14 text-center pb-2">
                    <div className="w-24 h-24 mx-auto rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center mb-4 overflow-hidden relative group shadow-xl">
                        {user?.kycPhotoUrl || formData.photoUrl ? (
                            <img
                                src={formData.photoUrl || user?.kycPhotoUrl}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <User size={40} className="text-slate-400" />
                        )}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <Camera size={20} className="text-white" />
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                    </div>
                    <h2 className="text-xl font-bold text-white">{user?.name || user?.email}</h2>
                    {user?.username && <p className="text-sm text-amber-400 font-medium">@{user.username}</p>}
                    <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>
                    <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold ${user?.kycVerified
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                        <Shield size={12} />
                        {user?.kycVerified ? 'Verified Account' : 'Verification Pending'}
                    </div>
                </div>
            </Card>

            {/* ─── Personal Information ─── */}
            <Card>
                <div className="flex items-center gap-2 mb-5">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <User size={18} className="text-amber-500" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Personal Information</h3>
                </div>
                <div className="space-y-4">
                    <Input
                        label="Username"
                        icon={<span className="text-slate-500 text-sm font-bold">@</span>}
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="Choose a unique username"
                        disabled={!!user?.username}
                    />
                    {!!user?.username && (
                        <p className="text-xs text-slate-500 -mt-2 ml-1">Username cannot be changed after it's set.</p>
                    )}
                    <Input
                        label="Full Name"
                        icon={<User size={18} />}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter your full name"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Phone Number"
                            icon={<Phone size={18} />}
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+234 800 000 0000"
                        />
                        <Input
                            label="Address"
                            icon={<MapPin size={18} />}
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Your address"
                        />
                    </div>
                    <Button onClick={handleProfileUpdate} disabled={profileLoading} className="w-full">
                        {profileLoading ? 'Updating...' : 'Save Changes'}
                    </Button>
                </div>
            </Card>

            {/* ─── Linked Bank Accounts ─── */}
            <Card>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <CreditCard size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Bank Accounts</h3>
                            <p className="text-xs text-slate-500">{linkedBanks.length} account{linkedBanks.length !== 1 ? 's' : ''} linked</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddBank(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 text-sm font-medium transition-colors"
                    >
                        <Plus size={14} /> Add New
                    </button>
                </div>

                {linkedBanks.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl">
                        <Building2 size={32} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-slate-400 text-sm">No bank accounts linked yet</p>
                        <p className="text-xs text-slate-500 mt-1">Add a bank account to enable withdrawals</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {linkedBanks.map((bank) => (
                            <div key={bank.id} className="flex items-center justify-between p-4 bg-slate-900/70 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0">
                                        <Building2 size={18} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white text-sm">{bank.accountName}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-400 font-mono">{bank.accountNumber}</span>
                                            <span className="text-xs text-slate-600">•</span>
                                            <span className="text-xs text-slate-500">{bank.bankName}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteBank(bank.id)}
                                    disabled={deletingBankId === bank.id}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Remove bank account"
                                >
                                    {deletingBankId === bank.id ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={16} />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* ─── Virtual Account ─── */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Building2 size={18} className="text-emerald-400" />
                        </div>
                        <h3 className="font-bold text-white text-lg">Virtual Account</h3>
                    </div>
                    {user?.virtualAccount && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-medium border border-emerald-500/30">Active</span>}
                </div>

                {user?.virtualAccount ? (
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-sm">Bank Name</span>
                            <span className="font-bold text-white">{user.virtualAccount.bankName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-sm">Account Number</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xl text-amber-500 font-bold">{user.virtualAccount.accountNumber}</span>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(user?.virtualAccount?.accountNumber || ''); addToast('success', 'Copied!'); }}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                >
                                    <Shield size={14} className="rotate-180" />
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-sm">Account Name</span>
                            <span className="font-medium text-white">{user.virtualAccount.accountName}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-800 mt-2">
                            <p className="text-xs text-slate-500 text-center">Transfers to this account will automatically fund your wallet.</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <div className="w-12 h-12 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-3">
                            <Building2 className="text-slate-400" size={24} />
                        </div>
                        <p className="text-slate-300 mb-4">Get a dedicated bank account to fund your wallet easily.</p>
                        {user?.kycVerified ? (
                            <Button
                                onClick={async () => {
                                    setVirtualAccountLoading(true);
                                    try {
                                        await paymentApi.createVirtualAccount();
                                        await refreshUser();
                                        addToast('success', 'Virtual Account created!');
                                    } catch (error: any) {
                                        addToast('error', error.response?.data?.error || 'Failed');
                                    } finally {
                                        setVirtualAccountLoading(false);
                                    }
                                }}
                                disabled={virtualAccountLoading}
                                className="w-full"
                            >
                                {virtualAccountLoading ? 'Creating Account...' : 'Generate Virtual Account'}
                            </Button>
                        ) : (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                <p className="text-sm text-amber-500">Complete KYC verification to generate a virtual account.</p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ─── Security ─── */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <Lock size={18} className="text-red-400" />
                        </div>
                        <h3 className="font-bold text-white text-lg">Security</h3>
                    </div>
                    <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${user?.transactionPin
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                        {user?.transactionPin ? 'PIN Active' : 'No PIN'}
                    </div>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                    {user?.transactionPin
                        ? 'Your transaction PIN is set. You can change it below.'
                        : 'Set a 4-digit PIN to secure your withdrawals.'}
                </p>
                {user?.transactionPin ? (
                    <Button variant="secondary" className="w-full" onClick={() => openPinModal('change')}>Change PIN</Button>
                ) : (
                    <Button className="w-full" onClick={() => openPinModal('set')}>Set Transaction PIN</Button>
                )}
            </Card>

            {/* ─── KYC CTA ─── */}
            {!user?.kycVerified && (
                <Card className="bg-gradient-to-r from-amber-900/20 to-slate-800 border-amber-500/20">
                    <div className="flex items-start gap-3">
                        <div className="p-3 bg-amber-500/20 rounded-xl shrink-0">
                            <Shield className="text-amber-500" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white mb-1">Complete Your Verification</h3>
                            <p className="text-sm text-slate-400 mb-4">Verify your identity to unlock higher limits and access all features.</p>
                            <Button variant="primary" onClick={() => navigate('/kyc')}>Start Verification</Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* ─── Add Bank Modal ─── */}
            <Modal isOpen={showAddBank} onClose={() => setShowAddBank(false)} title="Add Bank Account">
                <div className="space-y-4">
                    {/* Bank Selection */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Bank</label>
                        <button
                            type="button"
                            onClick={() => setShowBankDropdown(!showBankDropdown)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-left hover:border-slate-600 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Building2 size={18} className="text-slate-500" />
                                <span className={bankData.bankName ? 'text-white' : 'text-slate-500'}>
                                    {bankData.bankName || 'Choose your bank'}
                                </span>
                            </div>
                            <Search size={16} className="text-slate-500" />
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
                                <div className="max-h-48 overflow-y-auto">
                                    {filteredBanks.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-slate-500">No banks found</div>
                                    ) : (
                                        filteredBanks.map((bank: any) => (
                                            <button
                                                key={bank.code}
                                                onClick={() => selectBank(bank)}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors ${bankData.bankCode === bank.code ? 'bg-amber-500/10 text-amber-400' : 'text-white'}`}
                                            >
                                                {bank.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Account Number */}
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

                    {/* Account Name (Auto-resolved) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Account Name</label>
                        <div className={`px-4 py-3 rounded-xl border flex items-center gap-2 ${accountVerified
                            ? 'bg-emerald-500/5 border-emerald-500/30'
                            : 'bg-slate-900 border-slate-700'
                            }`}>
                            {verifyingAccount ? (
                                <>
                                    <Loader2 size={16} className="text-amber-400 animate-spin" />
                                    <span className="text-sm text-slate-400">Verifying account...</span>
                                </>
                            ) : accountVerified ? (
                                <>
                                    <CheckCircle size={16} className="text-emerald-400" />
                                    <span className="text-white font-medium">{bankData.accountName}</span>
                                </>
                            ) : (
                                <span className="text-sm text-slate-500">
                                    {bankData.bankCode && bankData.accountNumber.length === 10
                                        ? 'Could not verify account'
                                        : 'Select bank & enter account number'}
                                </span>
                            )}
                        </div>
                    </div>

                    <Button
                        onClick={handleAddBank}
                        disabled={bankLoading || !accountVerified}
                        className="w-full"
                    >
                        {bankLoading ? 'Saving...' : 'Add Bank Account'}
                    </Button>
                </div>
            </Modal>

            {/* ─── PIN Modal ─── */}
            <Modal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} title={pinMode === 'set' ? 'Set Transaction PIN' : 'Change Transaction PIN'}>
                <div className="space-y-4">
                    {pinMode === 'change' && (
                        <Input label="Current PIN" type="password" maxLength={4} value={pinData.oldPin} onChange={(e) => setPinData({ ...pinData, oldPin: e.target.value })} placeholder="Enter current PIN" />
                    )}
                    {pinMode === 'set' && (
                        <Input label="Login Password" type="password" value={pinData.password} onChange={(e) => setPinData({ ...pinData, password: e.target.value })} placeholder="Enter login password" />
                    )}
                    <Input label="New PIN" type="password" maxLength={4} value={pinData.newPin} onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })} placeholder="Enter 4-digit PIN" />
                    <Input label="Confirm PIN" type="password" maxLength={4} value={pinData.confirmPin} onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })} placeholder="Confirm 4-digit PIN" />
                    <Button onClick={handlePinSubmit} disabled={pinLoading} className="w-full">
                        {pinLoading ? 'Processing...' : 'Save PIN'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
