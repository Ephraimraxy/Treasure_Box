import React, { useState, useEffect } from 'react';
import { User, Phone, MapPin, Building2, Shield, Camera, Lock, Search, CheckCircle, Loader2, Plus, Trash2, CreditCard, ChevronRight, ArrowLeft, HelpCircle, Bell, Fingerprint, FileText, LogOut, Mail, MessageCircle, Star, ExternalLink, Globe, Info, Moon, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { userApi, paymentApi } from '../api';
import { Button, Input, Card, Modal } from '../components/ui';

// ─── Sub-page IDs ───
type SubPage = null | 'edit-profile' | 'bank-accounts' | 'virtual-account' | 'security' | 'help-support' | 'privacy-policy' | 'notifications';

export const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Active sub-page state
    const [activePage, setActivePage] = useState<SubPage>(null);

    // Loading
    const [profileLoading, setProfileLoading] = useState(false);
    const [bankLoading, setBankLoading] = useState(false);
    const [virtualAccountLoading, setVirtualAccountLoading] = useState(false);
    const [pinLoading, setPinLoading] = useState(false);
    const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

    // Profile form
    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        address: user?.address || '',
        username: user?.username || '',
        photoUrl: ''
    });

    const [notificationSettings, setNotificationSettings] = useState({
        fund: true, game: true, investment: true, login: true, push: true
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || prev.name,
                phone: user.phone || prev.phone,
                address: user.address || prev.address,
                username: user.username || prev.username,
            }));
            if (user.notificationSettings) {
                setNotificationSettings(prev => ({ ...prev, ...user.notificationSettings }));
            }
        }
    }, [user]);

    // Bank
    const [showAddBank, setShowAddBank] = useState(false);
    const [banks, setBanks] = useState<any[]>([]);
    const [bankSearch, setBankSearch] = useState('');
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankData, setBankData] = useState({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
    const [verifyingAccount, setVerifyingAccount] = useState(false);
    const [accountVerified, setAccountVerified] = useState(false);

    // PIN
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinMode, setPinMode] = useState<'set' | 'change'>('set');
    const [pinData, setPinData] = useState({ oldPin: '', newPin: '', confirmPin: '', password: '' });

    useEffect(() => { paymentApi.getBanks().then(res => setBanks(res.data || [])).catch(console.error); }, []);

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
            addToast('error', 'Could not verify account.');
        } finally { setVerifyingAccount(false); }
    };

    const filteredBanks = banks.filter((b: any) => b.name?.toLowerCase().includes(bankSearch.toLowerCase()));
    const selectBank = (bank: any) => { setBankData(prev => ({ ...prev, accountName: '', bankName: bank.name, bankCode: bank.code })); setBankSearch(''); setShowBankDropdown(false); setAccountVerified(false); };

    // Handlers
    const handleProfileUpdate = async () => {
        setProfileLoading(true);
        try { await userApi.updateProfile(formData); await refreshUser(); addToast('success', 'Profile updated successfully'); }
        catch (error: any) { addToast('error', error.response?.data?.error || 'Update failed'); }
        finally { setProfileLoading(false); }
    };

    const handleAddBank = async () => {
        if (!bankData.bankName || !bankData.accountNumber || !bankData.accountName) { addToast('error', 'Please fill all bank details'); return; }
        if (!accountVerified) { addToast('error', 'Please verify your account first'); return; }
        setBankLoading(true);
        try {
            await userApi.updateBankDetails({ bankName: bankData.bankName, accountNumber: bankData.accountNumber, accountName: bankData.accountName });
            await refreshUser();
            addToast('success', 'Bank account added successfully');
            setShowAddBank(false);
            setBankData({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
            setAccountVerified(false);
        } catch (error: any) { addToast('error', error.response?.data?.error || 'Failed to add bank'); }
        finally { setBankLoading(false); }
    };

    const handleDeleteBank = async (id: string) => {
        setDeletingBankId(id);
        try { await userApi.deleteBankDetail(id); await refreshUser(); addToast('success', 'Bank account removed'); }
        catch (error: any) { addToast('error', error.response?.data?.error || 'Failed to remove bank'); }
        finally { setDeletingBankId(null); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 500 * 1024) { addToast('error', 'Image size must be less than 500KB'); return; }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const photoUrl = reader.result as string;
            // Optimistic update
            setFormData(prev => ({ ...prev, photoUrl }));

            // Auto-save to backend
            try {
                addToast('info', 'Uploading profile photo...');
                await userApi.updateProfile({ photoUrl });
                await refreshUser();
                addToast('success', 'Profile photo updated');
            } catch (error: any) {
                addToast('error', 'Failed to upload photo');
                // Revert on failure if needed, but keeping local state is fine for retry
            }
        };
        reader.readAsDataURL(file);
    };

    const openPinModal = (mode: 'set' | 'change') => { setPinMode(mode); setPinData({ oldPin: '', newPin: '', confirmPin: '', password: '' }); setIsPinModalOpen(true); };

    const handlePinSubmit = async () => {
        if (pinData.newPin.length !== 4) { addToast('error', 'PIN must be 4 digits'); return; }
        if (pinData.newPin !== pinData.confirmPin) { addToast('error', 'PINs do not match'); return; }
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
        } catch (error: any) { addToast('error', error.response?.data?.error || 'Operation failed'); }
        finally { setPinLoading(false); }
    };

    const linkedBanks = user?.bankDetails || [];

    // ─── Sub-Page: Back Button ───
    const BackButton = ({ label }: { label: string }) => (
        <button
            onClick={() => setActivePage(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group"
        >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">{label}</span>
        </button>
    );

    // ─── Settings Menu Item ───
    const MenuItem = ({ icon: Icon, label, value, onClick, danger }: { icon: any; label: string; value?: string; onClick: () => void; danger?: boolean }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-4 p-4 hover:bg-slate-800/60 transition-colors group ${danger ? '' : ''}`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-500/10' : 'bg-slate-800'}`}>
                <Icon size={18} className={danger ? 'text-red-400' : 'text-slate-400 group-hover:text-amber-400 transition-colors'} />
            </div>
            <div className="flex-1 text-left">
                <span className={`font-medium text-sm ${danger ? 'text-red-400' : 'text-white'}`}>{label}</span>
            </div>
            {value && <span className="text-sm text-amber-400 font-medium">{value}</span>}
            <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        </button>
    );

    // ═══════════════════════════════════════════
    // SUB-PAGE: Edit Profile
    // ═══════════════════════════════════════════
    if (activePage === 'edit-profile') {
        return (
            <div className="max-w-lg mx-auto animate-fade-in">
                <BackButton label="Back to Profile" />
                <Card>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-amber-500/10 rounded-lg"><User size={18} className="text-amber-500" /></div>
                        <h3 className="font-bold text-white text-lg">Edit Profile</h3>
                    </div>
                    <div className="space-y-4">
                        <Input label="Username" icon={<span className="text-slate-500 text-sm font-bold">@</span>} value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="Choose a unique username" disabled={!!user?.username} />
                        {!!user?.username && <p className="text-xs text-slate-500 -mt-2 ml-1">Username cannot be changed after it's set.</p>}
                        <Input label="Full Name" icon={<User size={18} />} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter your full name" />
                        <Input label="Phone Number" icon={<Phone size={18} />} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+234 800 000 0000" />
                        <Input label="Address" icon={<MapPin size={18} />} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Your address" />
                        <Button onClick={handleProfileUpdate} disabled={profileLoading} className="w-full">
                            {profileLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // SUB-PAGE: Bank Accounts
    // ═══════════════════════════════════════════
    if (activePage === 'bank-accounts') {
        return (
            <div className="max-w-lg mx-auto animate-fade-in">
                <BackButton label="Back to Profile" />
                <Card>
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg"><CreditCard size={18} className="text-blue-400" /></div>
                            <div>
                                <h3 className="font-bold text-white text-lg">Bank Accounts</h3>
                                <p className="text-xs text-slate-500">{linkedBanks.length} account{linkedBanks.length !== 1 ? 's' : ''} linked</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAddBank(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 text-sm font-medium transition-colors">
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
                                        <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center shrink-0"><Building2 size={18} className="text-blue-400" /></div>
                                        <div>
                                            <div className="font-semibold text-white text-sm">{bank.accountName}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-slate-400 font-mono">{bank.accountNumber}</span>
                                                <span className="text-xs text-slate-600">•</span>
                                                <span className="text-xs text-slate-500">{bank.bankName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteBank(bank.id)} disabled={deletingBankId === bank.id} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove bank account">
                                        {deletingBankId === bank.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Add Bank Modal */}
                <Modal isOpen={showAddBank} onClose={() => setShowAddBank(false)} title="Add Bank Account">
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Bank</label>
                            <button type="button" onClick={() => setShowBankDropdown(!showBankDropdown)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-left hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Building2 size={18} className="text-slate-500" />
                                    <span className={bankData.bankName ? 'text-white' : 'text-slate-500'}>{bankData.bankName || 'Choose your bank'}</span>
                                </div>
                                <Search size={16} className="text-slate-500" />
                            </button>
                            {showBankDropdown && (
                                <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                                    <div className="p-2">
                                        <input type="text" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500" placeholder="Search banks..." value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} autoFocus />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {filteredBanks.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-500">No banks found</div>
                                        ) : filteredBanks.map((bank: any) => (
                                            <button key={bank.code} onClick={() => selectBank(bank)} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors ${bankData.bankCode === bank.code ? 'bg-amber-500/10 text-amber-400' : 'text-white'}`}>
                                                {bank.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Input label="Account Number" value={bankData.accountNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setBankData({ ...bankData, accountNumber: val }); }} placeholder="Enter 10-digit account number" maxLength={10} />
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Account Name</label>
                            <div className={`px-4 py-3 rounded-xl border flex items-center gap-2 ${accountVerified ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900 border-slate-700'}`}>
                                {verifyingAccount ? (<><Loader2 size={16} className="text-amber-400 animate-spin" /><span className="text-sm text-slate-400">Verifying account...</span></>) : accountVerified ? (<><CheckCircle size={16} className="text-emerald-400" /><span className="text-white font-medium">{bankData.accountName}</span></>) : (<span className="text-sm text-slate-500">{bankData.bankCode && bankData.accountNumber.length === 10 ? 'Could not verify account' : 'Select bank & enter account number'}</span>)}
                            </div>
                        </div>
                        <Button onClick={handleAddBank} disabled={bankLoading || !accountVerified} className="w-full">
                            {bankLoading ? 'Saving...' : 'Add Bank Account'}
                        </Button>
                    </div>
                </Modal>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // SUB-PAGE: Virtual Account
    // ═══════════════════════════════════════════
    if (activePage === 'virtual-account') {
        return (
            <div className="max-w-lg mx-auto animate-fade-in">
                <BackButton label="Back to Profile" />
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-500/10 rounded-lg"><Building2 size={18} className="text-emerald-400" /></div>
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
                                    <button onClick={() => { navigator.clipboard.writeText(user?.virtualAccount?.accountNumber || ''); addToast('success', 'Copied!'); }} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
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
                            <div className="w-12 h-12 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-3"><Building2 className="text-slate-400" size={24} /></div>
                            <p className="text-slate-300 mb-4">Get a dedicated bank account to fund your wallet easily.</p>
                            {user?.kycVerified ? (
                                <Button onClick={async () => { setVirtualAccountLoading(true); try { await paymentApi.createVirtualAccount(); await refreshUser(); addToast('success', 'Virtual Account created!'); } catch (error: any) { addToast('error', error.response?.data?.error || 'Failed'); } finally { setVirtualAccountLoading(false); } }} disabled={virtualAccountLoading} className="w-full">
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
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // SUB-PAGE: Security
    // ═══════════════════════════════════════════
    if (activePage === 'security') {
        return (
            <div className="max-w-lg mx-auto animate-fade-in">
                <BackButton label="Back to Profile" />
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-500/10 rounded-lg"><Lock size={18} className="text-red-400" /></div>
                            <h3 className="font-bold text-white text-lg">Security</h3>
                        </div>
                        <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${user?.transactionPin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {user?.transactionPin ? 'PIN Active' : 'No PIN'}
                        </div>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">
                        {user?.transactionPin ? 'Your transaction PIN is set. You can change it below.' : 'Set a 4-digit PIN to secure your withdrawals.'}
                    </p>
                    {user?.transactionPin ? (
                        <Button variant="secondary" className="w-full" onClick={() => openPinModal('change')}>Change PIN</Button>
                    ) : (
                        <Button className="w-full" onClick={() => openPinModal('set')}>Set Transaction PIN</Button>
                    )}
                </Card>

                {/* PIN Modal */}
                <Modal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} title={pinMode === 'set' ? 'Set Transaction PIN' : 'Change Transaction PIN'}>
                    <div className="space-y-4">
                        {pinMode === 'change' && <Input label="Current PIN" type="password" maxLength={4} value={pinData.oldPin} onChange={(e) => setPinData({ ...pinData, oldPin: e.target.value })} placeholder="Enter current PIN" />}
                        {pinMode === 'set' && <Input label="Login Password" type="password" value={pinData.password} onChange={(e) => setPinData({ ...pinData, password: e.target.value })} placeholder="Enter login password" />}
                        <Input label="New PIN" type="password" maxLength={4} value={pinData.newPin} onChange={(e) => setPinData({ ...pinData, newPin: e.target.value })} placeholder="Enter 4-digit PIN" />
                        <Input label="Confirm PIN" type="password" maxLength={4} value={pinData.confirmPin} onChange={(e) => setPinData({ ...pinData, confirmPin: e.target.value })} placeholder="Confirm 4-digit PIN" />
                        <Button onClick={handlePinSubmit} disabled={pinLoading} className="w-full">{pinLoading ? 'Processing...' : 'Save PIN'}</Button>
                    </div>
                </Modal>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // SUB-PAGE: Help & Support
    // ═══════════════════════════════════════════
    // SUB-PAGE: Notifications
    // ═══════════════════════════════════════════
    if (activePage === 'notifications') {
        const toggleNotification = async (key: string) => {
            const newSettings = { ...notificationSettings, [key]: !notificationSettings[key as keyof typeof notificationSettings] };
            setNotificationSettings(newSettings);
            try {
                await userApi.updateProfile({ notificationSettings: newSettings });
                refreshUser();
            } catch (error) {
                addToast('error', 'Failed to update settings');
            }
        };

        const settings = [
            { id: 'fund', label: 'Fund Alerts', desc: 'Get notified when funds are added or removed.' },
            { id: 'game', label: 'Game Play Alerts', desc: 'Updates on your game status and winnings.' },
            { id: 'investment', label: 'Investment Alerts', desc: 'Notifications about your investment maturity.' },
            { id: 'login', label: 'Login Alerts', desc: 'Get notified of new login attempts.' },
            { id: 'push', label: 'Push Notifications', desc: 'Receive push notifications on this device.' },
        ];

        return (
            <div className="max-w-lg mx-auto animate-fade-in">
                <BackButton label="Back to Profile" />
                <Card>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-amber-500/10 rounded-lg"><Bell size={18} className="text-amber-500" /></div>
                        <h3 className="font-bold text-white text-lg">Notification Settings</h3>
                    </div>
                    <div className="divide-y divide-slate-800/50">
                        {settings.map(setting => (
                            <div key={setting.id} className="py-4 flex items-center justify-between">
                                <div className="pr-4">
                                    <div className="text-sm font-medium text-white">{setting.label}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{setting.desc}</div>
                                </div>
                                <button
                                    onClick={() => toggleNotification(setting.id)}
                                    className={`w-11 h-6 rounded-full transition-colors relative ${notificationSettings[setting.id as keyof typeof notificationSettings] ? 'bg-amber-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notificationSettings[setting.id as keyof typeof notificationSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    if (activePage === 'help-support') {
        const faqs = [
            { q: 'How do I fund my wallet?', a: 'You can fund your wallet by transferring to your virtual bank account, or via bank transfer from the Deposit page.' },
            { q: 'How long do withdrawals take?', a: 'Withdrawals are typically processed within 1–5 minutes. Bank processing may add extra time during off-hours.' },
            { q: 'What is KYC verification?', a: 'KYC (Know Your Customer) verification confirms your identity. It unlocks higher transaction limits and access to all features.' },
            { q: 'How do I reset my transaction PIN?', a: 'Go to Profile → Security & PIN → Change PIN. You will need your current PIN to set a new one.' },
            { q: 'Is my money safe on Treasure Box?', a: 'Yes. We use bank-grade encryption, secure transaction PINs, and full KYC verification to protect your funds.' },
            { q: 'How do referral rewards work?', a: 'Share your unique referral link. When someone signs up and completes their first transaction, you both earn ₦500.' },
        ];
        return (
            <div className="max-w-lg mx-auto animate-fade-in space-y-6">
                <BackButton label="Back to Profile" />
                <Card>
                    <div className="flex items-center gap-2 mb-5">
                        <div className="p-2 bg-blue-500/10 rounded-lg"><HelpCircle size={18} className="text-blue-400" /></div>
                        <h3 className="font-bold text-white text-lg">Help & Support</h3>
                    </div>

                    {/* FAQ Section */}
                    <div className="space-y-3 mb-6">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Frequently Asked Questions</h4>
                        {faqs.map((faq, i) => (
                            <details key={i} className="group bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                                <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-slate-800 transition-colors">
                                    <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                                    <ChevronDown size={16} className="text-slate-500 shrink-0 group-open:rotate-180 transition-transform" />
                                </summary>
                                <div className="px-4 pb-4 pt-0">
                                    <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                                </div>
                            </details>
                        ))}
                    </div>
                </Card>

                {/* Contact Options */}
                <Card>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Contact Us</h4>
                    <div className="space-y-3">
                        <a href="mailto:support@treasurebox.ng" className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-amber-500/30 transition-colors group">
                            <div className="p-2.5 bg-amber-500/10 rounded-xl"><Mail size={18} className="text-amber-400" /></div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white">Email Support</div>
                                <div className="text-xs text-slate-500">support@treasurebox.ng</div>
                            </div>
                            <ExternalLink size={14} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
                        </a>
                        <a href="https://wa.me/2349000000000" target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-emerald-500/30 transition-colors group">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl"><MessageCircle size={18} className="text-emerald-400" /></div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white">WhatsApp</div>
                                <div className="text-xs text-slate-500">Chat with us on WhatsApp</div>
                            </div>
                            <ExternalLink size={14} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                        </a>
                        <a href="https://twitter.com/treasurebox" target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-blue-500/30 transition-colors group">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl"><Globe size={18} className="text-blue-400" /></div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-white">Social Media</div>
                                <div className="text-xs text-slate-500">Follow us @treasurebox</div>
                            </div>
                            <ExternalLink size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                        </a>
                    </div>
                </Card>

                {/* Rate Us */}
                <div className="bg-gradient-to-r from-amber-900/20 to-slate-900 border border-amber-500/20 rounded-2xl p-5 text-center">
                    <Star size={28} className="text-amber-400 mx-auto mb-2" />
                    <h4 className="font-bold text-white mb-1">Enjoying Treasure Box?</h4>
                    <p className="text-sm text-slate-400 mb-4">Rate us and help others discover the app!</p>
                    <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                            <button key={s} className="p-1.5 hover:scale-125 transition-transform"><Star size={24} className="text-amber-400 fill-amber-400" /></button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // SUB-PAGE: Privacy Policy
    // ═══════════════════════════════════════════
    if (activePage === 'privacy-policy') {
        const sections = [
            { title: 'Information We Collect', content: 'We collect personal information you provide during registration (name, email, phone number), identity verification data (NIN, BVN, photos), transaction history, and device information to improve our services.' },
            { title: 'How We Use Your Information', content: 'Your information is used to process transactions, verify your identity, prevent fraud, improve our services, send important account notifications, and comply with regulatory requirements.' },
            { title: 'Data Security', content: 'We implement bank-grade encryption (AES-256), secure transaction PINs, two-factor authentication, and regular security audits to protect your personal and financial data.' },
            { title: 'Information Sharing', content: 'We do not sell your personal data. Information may be shared with payment processors, identity verification partners, and regulatory authorities as required by law.' },
            { title: 'Your Rights', content: 'You have the right to access, update, or delete your personal information at any time. You may request a copy of your data or ask us to restrict its processing by contacting support.' },
            { title: 'Cookies & Analytics', content: 'We use essential cookies and analytics to understand app usage patterns and improve performance. You can manage cookie preferences in your browser settings.' },
            { title: 'Data Retention', content: 'We retain your data for as long as your account is active, plus any period required by Nigerian financial regulations (typically 5 years after account closure).' },
            { title: 'Policy Updates', content: 'We may update this policy periodically. Significant changes will be communicated via email and in-app notifications. Continued use constitutes acceptance.' },
        ];
        return (
            <div className="max-w-lg mx-auto animate-fade-in space-y-6">
                <BackButton label="Back to Profile" />
                <Card>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-indigo-500/10 rounded-lg"><FileText size={18} className="text-indigo-400" /></div>
                        <h3 className="font-bold text-white text-lg">Privacy Policy</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-6">Last updated: February 2026</p>

                    <div className="space-y-5">
                        {sections.map((sec, i) => (
                            <div key={i}>
                                <h4 className="text-sm font-bold text-white mb-1.5 flex items-center gap-2">
                                    <span className="w-5 h-5 bg-indigo-500/20 text-indigo-400 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                                    {sec.title}
                                </h4>
                                <p className="text-sm text-slate-400 leading-relaxed pl-7">{sec.content}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="text-center py-2">
                    <p className="text-xs text-slate-600">For questions about this policy, contact <a href="mailto:privacy@treasurebox.ng" className="text-amber-500 hover:underline">privacy@treasurebox.ng</a></p>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // MAIN PROFILE VIEW
    // ═══════════════════════════════════════════
    return (
        <div className="animate-fade-in max-w-lg mx-auto space-y-5">
            {/* ─── Curved Header + Avatar ─── */}
            <div className="relative">
                {/* Curved background */}
                <div className="relative overflow-hidden rounded-3xl">
                    <div className="h-36 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 relative">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] opacity-40" />
                        {/* Curved bottom */}
                        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 500 40" preserveAspectRatio="none">
                            <path d="M0,40 L0,20 Q250,-10 500,20 L500,40 Z" className="fill-slate-950" />
                        </svg>
                    </div>
                </div>

                {/* Avatar — overlapping the header */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 z-10">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-950 flex items-center justify-center overflow-hidden relative group shadow-2xl">
                        {formData.photoUrl || user?.photoUrl || user?.kycPhotoUrl ? (
                            <img src={formData.photoUrl || user?.photoUrl || user?.kycPhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={40} className="text-slate-400" />
                        )}
                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                            <Camera size={20} className="text-white" />
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                    </div>
                </div>
            </div>

            {/* ─── Name & Email ─── */}
            <div className="text-center pt-14">
                <h2 className="text-xl font-bold text-white">{user?.name || user?.email}</h2>
                {user?.username && <p className="text-sm text-amber-400 font-medium">@{user.username}</p>}
                <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>
                {user?.phone && <p className="text-sm text-slate-500">{user.phone}</p>}
                <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold ${user?.kycVerified ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    <Shield size={12} />
                    {user?.kycVerified ? 'Verified Account' : 'Verification Pending'}
                </div>
            </div>

            {/* ─── Group 1: Account ─── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/50">
                <MenuItem icon={User} label="Edit Profile" onClick={() => setActivePage('edit-profile')} />
                <MenuItem icon={CreditCard} label="Bank Accounts" value={`${linkedBanks.length}`} onClick={() => setActivePage('bank-accounts')} />
                <MenuItem icon={Building2} label="Virtual Account" value={user?.virtualAccount ? 'Active' : 'Setup'} onClick={() => setActivePage('virtual-account')} />
                <MenuItem icon={Fingerprint} label="KYC Verification" value={user?.kycVerified ? 'Verified' : 'Pending'} onClick={() => navigate('/kyc')} />
            </div>

            {/* ─── Group 2: Security ─── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/50">
                <MenuItem icon={Lock} label="Security & PIN" value={user?.transactionPin ? 'Active' : 'Set PIN'} onClick={() => setActivePage('security')} />
                <MenuItem icon={Bell} label="Notifications" value="On" onClick={() => setActivePage('notifications')} />
            </div>

            {/* ─── Group 3: Support & Legal ─── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/50">
                <MenuItem icon={HelpCircle} label="Help & Support" onClick={() => setActivePage('help-support')} />

                <MenuItem icon={FileText} label="Privacy Policy" onClick={() => setActivePage('privacy-policy')} />
            </div>

            {/* ─── Logout ─── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <MenuItem icon={LogOut} label="Log Out" onClick={() => { localStorage.clear(); window.location.href = '/login'; }} danger />
            </div>

            {/* ─── App Version Footer ─── */}
            <div className="text-center py-4 space-y-1">
                <p className="text-xs text-slate-600 font-medium">Treasure Box</p>
                <p className="text-[10px] text-slate-700">Version 1.0.0 • by <a href="https://www.burstbrainconcepts.site/" target="_blank" rel="noreferrer" className="hover:text-amber-500 transition-colors">Burst Brain Concept</a></p>
            </div>
        </div>
    );
};
