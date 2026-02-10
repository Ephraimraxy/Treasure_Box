import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Building2, Shield, Camera, Lock, Search, CheckCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { userApi, paymentApi } from '../api';
import { Button, Input, Card, Modal } from '../components/ui';

export const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate(); // Add hook

    // Separate loading states
    const [profileLoading, setProfileLoading] = useState(false);
    const [bankLoading, setBankLoading] = useState(false);
    const [virtualAccountLoading, setVirtualAccountLoading] = useState(false);
    const [pinLoading, setPinLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: '',
        address: '',
        username: user?.username || '',
        photoUrl: ''
    });

    // Bank details state
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
        setBankData(prev => ({ ...prev, bankName: bank.name, bankCode: bank.code }));
        setBankSearch('');
        setShowBankDropdown(false);
        setAccountVerified(false);
        setBankData(prev => ({ ...prev, accountName: '', bankName: bank.name, bankCode: bank.code }));
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
                if (!pinData.password) {
                    addToast('error', 'Please enter your password');
                    return;
                }
                await userApi.setPin(pinData.newPin, pinData.password);
                addToast('success', 'PIN set successfully');
            } else {
                if (!pinData.oldPin) {
                    addToast('error', 'Please enter your current PIN');
                    setPinLoading(false);
                    return;
                }
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

    const handleProfileUpdate = async () => {
        setProfileLoading(true);
        try {
            await userApi.updateProfile(formData);
            await refreshUser();
            addToast('success', 'Profile updated successfully');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Update failed');
            console.error(error);
        } finally {
            setProfileLoading(false);
        }
    };

    const handleBankUpdate = async () => {
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
            await refreshUser(); // Refresh user to update local state if needed
            addToast('success', 'Bank details updated successfully');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Update failed');
            console.error(error);
        } finally {
            setBankLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // 500KB limit
            addToast('error', 'Image size must be less than 500KB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setFormData(prev => ({ ...prev, photoUrl: base64String }));
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Profile Header */}
            <Card className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-amber-500 to-orange-600" />
                <div className="relative pt-12 text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center mb-4 overflow-hidden relative group">
                        {user?.kycPhotoUrl || formData.photoUrl ? (
                            <img
                                src={formData.photoUrl || user?.kycPhotoUrl}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <User size={40} className="text-slate-400" />
                        )}

                        <label className="absolute bottom-0 right-0 p-2 bg-amber-500 rounded-full text-slate-900 cursor-pointer hover:bg-amber-400 transition-colors z-10">
                            <Camera size={14} />
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    </div>
                    <h2 className="text-xl font-bold text-white">{user?.name || user?.email}</h2>
                    <p className="text-sm text-slate-400">{user?.email}</p>
                    <div className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold ${user?.kycVerified
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                        }`}>
                        <Shield size={12} />
                        {user?.kycVerified ? 'Verified Account' : 'Verification Pending'}
                    </div>
                </div>
            </Card>

            {/* Profile Form */}
            <Card>
                <h3 className="font-bold text-white mb-4">Personal Information</h3>
                <div className="space-y-4">
                    <Input
                        label="Username"
                        icon={<User size={18} />}
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="Choose a unique username"
                        disabled={!!user?.username}
                    />
                    <Input
                        label="Full Name"
                        icon={<User size={18} />}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter your full name"
                    />
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
                    <Button onClick={handleProfileUpdate} disabled={profileLoading} className="w-full">
                        {profileLoading ? 'Updating...' : 'Update Profile'}
                    </Button>
                </div>
            </Card>

            {/* Bank Details - Professional Auto-Resolve */}
            <Card>
                <h3 className="font-bold text-white mb-4">Bank Details</h3>
                <p className="text-sm text-slate-400 mb-4">
                    Link your bank account for withdrawals
                </p>
                <div className="space-y-4">
                    {/* Bank Selection Dropdown */}
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
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors ${bankData.bankCode === bank.code ? 'bg-amber-500/10 text-amber-400' : 'text-white'
                                                    }`}
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
                        onClick={handleBankUpdate}
                        variant="secondary"
                        disabled={bankLoading || !accountVerified}
                        className="w-full"
                    >
                        {bankLoading ? 'Saving...' : 'Save Bank Details'}
                    </Button>
                </div>
            </Card>

            {/* Virtual Account */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white">Virtual Account</h3>

                    {user?.virtualAccount && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">Active</span>}
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
                                    onClick={() => {
                                        navigator.clipboard.writeText(user?.virtualAccount?.accountNumber || '');
                                        addToast('success', 'Copied to clipboard');
                                    }}
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
                            <p className="text-xs text-slate-500 text-center">
                                Transfers to this account will automatically fund your wallet.
                            </p>
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
                                        addToast('success', 'Virtual Account created successfully!');
                                    } catch (error: any) {
                                        addToast('error', error.response?.data?.error || 'Failed to create account');
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
                                <p className="text-sm text-amber-500">
                                    Please complete KYC verification to generate a virtual account.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Security - Transaction PIN */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white">Security</h3>
                    <Lock className="text-amber-500" size={20} />
                </div>
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                        {user?.transactionPin
                            ? 'Your transaction PIN is set. You can change it below.'
                            : 'Set a 4-digit PIN to secure your withdrawals.'}
                    </p>

                    {user?.transactionPin ? (
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => openPinModal('change')}
                        >
                            Change PIN
                        </Button>
                    ) : (
                        <Button
                            className="w-full"
                            onClick={() => openPinModal('set')}
                        >
                            Set PIN
                        </Button>
                    )}
                </div>
            </Card>

            <Modal
                isOpen={isPinModalOpen}
                onClose={() => setIsPinModalOpen(false)}
                title={pinMode === 'set' ? 'Set Transaction PIN' : 'Change Transaction PIN'}
            >
                <div className="space-y-4">
                    {pinMode === 'change' && (
                        <Input
                            label="Current PIN"
                            type="password"
                            maxLength={4}
                            value={pinData.oldPin}
                            onChange={(e) => setPinData({ ...pinData, oldPin: e.target.value })}
                            placeholder="Enter current PIN"
                        />
                    )}
                    {pinMode === 'set' && (
                        <Input
                            label="Login Password"
                            type="password"
                            value={pinData.password}
                            onChange={(e) => setPinData({ ...pinData, password: e.target.value })}
                            placeholder="Enter login password"
                        />
                    )}
                    <Input
                        label="New PIN"
                        type="password"
                        maxLength={4}
                        value={pinData.newPin}
                        onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })}
                        placeholder="Enter 4-digit PIN"
                    />
                    <Input
                        label="Confirm PIN"
                        type="password"
                        maxLength={4}
                        value={pinData.confirmPin}
                        onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })}
                        placeholder="Confirm 4-digit PIN"
                    />
                    <Button onClick={handlePinSubmit} disabled={pinLoading} className="w-full">
                        {pinLoading ? 'Processing...' : 'Save PIN'}
                    </Button>
                </div>
            </Modal>

            {/* KYC Verification */}
            {!user?.kycVerified && (
                <Card className="bg-gradient-to-r from-amber-900/20 to-slate-800 border-amber-500/20">
                    <div className="flex items-start gap-2">
                        <div className="p-3 bg-amber-500/20 rounded-xl">
                            <Shield className="text-amber-500" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white mb-1">Complete Your Verification</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Verify your identity to unlock higher limits and access all features.
                            </p>
                            <Button variant="primary" onClick={() => navigate('/kyc')}>
                                Start Verification
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
