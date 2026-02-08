import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Building2, Shield, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { userApi, paymentApi } from '../api';
import { Button, Input, Card } from '../components/ui';

export const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: '',
        address: '',
    });
    const [bankData, setBankData] = useState({
        bankName: '',
        accountNumber: '',
        accountName: '',
    });

    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            await userApi.updateProfile(formData);
            await refreshUser();
            addToast('success', 'Profile updated successfully');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleBankUpdate = async () => {
        if (!bankData.bankName || !bankData.accountNumber || !bankData.accountName) {
            addToast('error', 'Please fill all bank details');
            return;
        }
        setLoading(true);
        try {
            await userApi.updateBankDetails(bankData);
            addToast('success', 'Bank details updated successfully');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Profile Header */}
            <Card className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-amber-500 to-orange-600" />
                <div className="relative pt-12 text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-slate-800 border-4 border-slate-900 flex items-center justify-center mb-4">
                        <User size={40} className="text-slate-400" />
                        <button className="absolute bottom-0 right-0 p-2 bg-amber-500 rounded-full text-slate-900">
                            <Camera size={14} />
                        </button>
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
                    <Button onClick={handleProfileUpdate} disabled={loading} className="w-full">
                        {loading ? 'Updating...' : 'Update Profile'}
                    </Button>
                </div>
            </Card>

            {/* Bank Details */}
            <Card>
                <h3 className="font-bold text-white mb-4">Bank Details</h3>
                <p className="text-sm text-slate-400 mb-4">
                    Add your bank details for withdrawals
                </p>
                <div className="space-y-4">
                    <Input
                        label="Bank Name"
                        icon={<Building2 size={18} />}
                        value={bankData.bankName}
                        onChange={(e) => setBankData({ ...bankData, bankName: e.target.value })}
                        placeholder="e.g. GTBank, Access Bank"
                    />
                    <Input
                        label="Account Number"
                        value={bankData.accountNumber}
                        onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value })}
                        placeholder="10-digit account number"
                        maxLength={10}
                    />
                    <Input
                        label="Account Name"
                        value={bankData.accountName}
                        onChange={(e) => setBankData({ ...bankData, accountName: e.target.value })}
                        placeholder="Account holder name"
                    />
                    <Button onClick={handleBankUpdate} variant="secondary" disabled={loading} className="w-full">
                        {loading ? 'Saving...' : 'Save Bank Details'}
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
                                    <Shield size={14} className="rotate-180" /> {/* Using Shield as Copy icon fallback if needed, or just text */}
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
                                    setLoading(true);
                                    try {
                                        await paymentApi.createVirtualAccount();
                                        await refreshUser();
                                        addToast('success', 'Virtual Account created successfully!');
                                    } catch (error: any) {
                                        addToast('error', error.response?.data?.error || 'Failed to create account');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? 'Creating Account...' : 'Generate Virtual Account'}
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

            {/* KYC Verification */}
            {!user?.kycVerified && (
                <Card className="bg-gradient-to-r from-amber-900/20 to-slate-800 border-amber-500/20">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-500/20 rounded-xl">
                            <Shield className="text-amber-500" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white mb-1">Complete Your Verification</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Verify your identity to unlock higher limits and access all features.
                            </p>
                            <Button variant="primary" onClick={() => addToast('info', 'KYC verification coming soon')}>
                                Start Verification
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
