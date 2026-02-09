import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, Clock, Check, X, Shield, Activity, Settings, AlertTriangle } from 'lucide-react';
import { adminApi } from '../api';
import { useToast } from '../contexts/ToastContext';
import { Button, Card, FormatCurrency, Spinner, Modal, Input } from '../components/ui';

interface Stats {
    totalUsers: number;
    totalBalance: number;
    activeInvestments: number;
    pendingWithdrawals: number;
}

interface Withdrawal {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    user: {
        email: string;
        name: string;
        bankDetails?: {
            bankName: string;
            accountNumber: string;
            accountName: string;
        };
    };
}

export const AdminDashboardPage = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await adminApi.getStats();
                setStats(response.data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card className="bg-gradient-to-br from-blue-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Users className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Total Users</div>
                            <div className="text-lg font-bold text-white">{stats?.totalUsers || 0}</div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/20 rounded-xl">
                            <DollarSign className="text-emerald-500" size={24} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Total Balance</div>
                            <div className="text-xl font-bold text-white">
                                <FormatCurrency amount={stats?.totalBalance || 0} />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-purple-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <TrendingUp className="text-purple-500" size={24} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Active Plans</div>
                            <div className="text-lg font-bold text-white">{stats?.activeInvestments || 0}</div>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-amber-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/20 rounded-xl">
                            <Clock className="text-amber-500" size={24} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Pending</div>
                            <div className="text-lg font-bold text-white">{stats?.pendingWithdrawals || 0}</div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export const AdminWithdrawalsPage = () => {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const { addToast } = useToast();

    const fetchWithdrawals = async () => {
        try {
            const response = await adminApi.getPendingWithdrawals();
            setWithdrawals(response.data);
        } catch (error) {
            console.error('Failed to fetch withdrawals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWithdrawals();
    }, []);

    const handleApprove = async (id: string) => {
        setProcessing(id);
        try {
            await adminApi.approveWithdrawal(id);
            addToast('success', 'Withdrawal approved');
            fetchWithdrawals();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to approve');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModal || !rejectReason) return;
        setProcessing(rejectModal);
        try {
            await adminApi.rejectWithdrawal(rejectModal, rejectReason);
            addToast('success', 'Withdrawal rejected and refunded');
            setRejectModal(null);
            setRejectReason('');
            fetchWithdrawals();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to reject');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <h1 className="text-lg font-bold text-white">Pending Withdrawals</h1>

            {withdrawals.length === 0 ? (
                <Card className="text-center py-12">
                    <Clock className="mx-auto text-slate-600 mb-4" size={48} />
                    <p className="text-slate-500">No pending withdrawals</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {withdrawals.map((w) => (
                        <Card key={w.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                                <div className="font-bold text-white">{w.user.name || w.user.email}</div>
                                <div className="text-sm text-slate-400">{w.user.email}</div>
                                {w.user.bankDetails && (
                                    <div className="text-xs text-slate-500 mt-1">
                                        {w.user.bankDetails.bankName} • {w.user.bankDetails.accountNumber}
                                    </div>
                                )}
                                <div className="text-xs text-slate-600 mt-1">
                                    {new Date(w.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-bold text-amber-500 mb-2">
                                    <FormatCurrency amount={w.amount} />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="success"
                                        onClick={() => handleApprove(w.id)}
                                        disabled={processing === w.id}
                                        className="px-3 py-2 text-sm"
                                    >
                                        <Check size={16} /> Approve
                                    </Button>
                                    <Button
                                        variant="danger"
                                        onClick={() => setRejectModal(w.id)}
                                        disabled={processing === w.id}
                                        className="px-3 py-2 text-sm"
                                    >
                                        <X size={16} /> Reject
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Withdrawal">
                <div className="space-y-4">
                    <p className="text-slate-400 text-sm">
                        Please provide a reason for rejection. The user will be notified and funds will be refunded.
                    </p>
                    <Input
                        label="Reason"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Invalid bank details"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setRejectModal(null)} className="flex-1">
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={handleReject} disabled={!rejectReason} className="flex-1">
                            Reject & Refund
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export const AdminUsersPage = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const { addToast } = useToast();

    // Modal states
    const [editUser, setEditUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
    const [deleteUser, setDeleteUser] = useState<any>(null);
    const [suspendUser, setSuspendUser] = useState<any>(null);
    const [suspendReason, setSuspendReason] = useState('');

    const fetchUsers = async () => {
        try {
            const response = await adminApi.getUsers();
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleEdit = async () => {
        if (!editUser) return;
        setProcessing(true);
        try {
            await adminApi.updateUser(editUser.id, editForm);
            addToast('success', 'User updated');
            setEditUser(null);
            fetchUsers();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Update failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUser) return;
        setProcessing(true);
        try {
            await adminApi.deleteUser(deleteUser.id);
            addToast('success', 'User deleted');
            setDeleteUser(null);
            fetchUsers();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Delete failed');
        } finally {
            setProcessing(false);
        }
    };

    const handleSuspendToggle = async () => {
        if (!suspendUser) return;
        setProcessing(true);
        const willSuspend = !suspendUser.isSuspended;
        try {
            await adminApi.toggleSuspension(suspendUser.id, willSuspend, suspendReason);
            addToast('success', willSuspend ? 'User suspended' : 'User unsuspended');
            setSuspendUser(null);
            setSuspendReason('');
            fetchUsers();
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <h1 className="text-lg font-bold text-white">Users ({users.length})</h1>

            <div className="space-y-3">
                {users.map((user) => (
                    <Card key={user.id} className={`relative ${user.isSuspended ? 'border border-red-500/30' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white truncate">{user.name || user.email}</span>
                                    {user.isSuspended && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold whitespace-nowrap">
                                            <AlertTriangle size={10} /> SUSPENDED
                                        </span>
                                    )}
                                    {user.role === 'ADMIN' && (
                                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold">ADMIN</span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-400 truncate">{user.email}</div>
                                {user.username && <div className="text-xs text-slate-500">@{user.username}</div>}
                                <div className="text-xs text-slate-600 mt-1">
                                    Joined: {new Date(user.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-bold text-white">
                                    <FormatCurrency amount={user.balance} />
                                </div>
                                <div className={`text-xs uppercase font-bold ${user.kycVerified ? 'text-emerald-400' :
                                    user.emailVerified ? 'text-blue-400' : 'text-slate-500'
                                    }`}>
                                    {user.kycVerified ? 'KYC Verified' : user.emailVerified ? 'Verified' : 'Unverified'}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {user.role !== 'ADMIN' && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                                <button
                                    onClick={() => {
                                        setEditUser(user);
                                        setEditForm({ name: user.name || '', email: user.email, phone: user.phone || '' });
                                    }}
                                    className="flex-1 text-xs py-2 px-3 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        setSuspendUser(user);
                                        setSuspendReason('');
                                    }}
                                    className={`flex-1 text-xs py-2 px-3 rounded-lg font-medium transition-colors ${user.isSuspended
                                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                        }`}
                                >
                                    {user.isSuspended ? 'Unsuspend' : 'Suspend'}
                                </button>
                                <button
                                    onClick={() => setDeleteUser(user)}
                                    className="flex-1 text-xs py-2 px-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {/* Edit Modal */}
            <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
                <div className="space-y-4">
                    <Input
                        label="Name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Full name"
                    />
                    <Input
                        label="Email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="Email address"
                    />
                    <Input
                        label="Phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Phone number"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setEditUser(null)} className="flex-1">Cancel</Button>
                        <Button onClick={handleEdit} disabled={processing} className="flex-1">
                            {processing ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User">
                <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                            <AlertTriangle size={18} />
                            <span className="font-bold">Irreversible Action</span>
                        </div>
                        <p className="text-sm text-slate-300">
                            This will permanently delete <strong className="text-white">{deleteUser?.name || deleteUser?.email}</strong> and all their data (transactions, investments, virtual account).
                        </p>
                        {deleteUser?.balance > 0 && (
                            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <p className="text-sm text-amber-400">
                                    ⚠ This user has a balance of <strong><FormatCurrency amount={deleteUser.balance} /></strong>
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setDeleteUser(null)} className="flex-1">Cancel</Button>
                        <Button variant="danger" onClick={handleDelete} disabled={processing} className="flex-1">
                            {processing ? 'Deleting...' : 'Delete Permanently'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Suspend Modal */}
            <Modal
                isOpen={!!suspendUser}
                onClose={() => setSuspendUser(null)}
                title={suspendUser?.isSuspended ? 'Unsuspend User' : 'Suspend User'}
            >
                <div className="space-y-4">
                    {suspendUser?.isSuspended ? (
                        <p className="text-sm text-slate-300">
                            Remove suspension from <strong className="text-white">{suspendUser?.name || suspendUser?.email}</strong>?
                            They will regain full access to withdrawals, investments, and services.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-slate-300">
                                Suspend <strong className="text-white">{suspendUser?.name || suspendUser?.email}</strong>?
                                They will be unable to withdraw, invest, or purchase services. Deposits will still work.
                            </p>
                            <Input
                                label="Reason"
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="e.g. Suspicious activity"
                            />
                        </>
                    )}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setSuspendUser(null)} className="flex-1">Cancel</Button>
                        <Button
                            variant={suspendUser?.isSuspended ? 'success' : 'danger'}
                            onClick={handleSuspendToggle}
                            disabled={processing || (!suspendUser?.isSuspended && !suspendReason)}
                            className="flex-1"
                        >
                            {processing ? 'Processing...' : suspendUser?.isSuspended ? 'Unsuspend' : 'Suspend User'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export const AdminAuditPage = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await adminApi.getAuditLogs();
                setLogs(response.data);
            } catch (error) {
                console.error('Failed to fetch logs:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <h1 className="text-lg font-bold text-white">Audit Logs</h1>

            {logs.length === 0 ? (
                <Card className="text-center py-12">
                    <p className="text-slate-500">No audit logs yet</p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {logs.map((log) => (
                        <Card key={log.id} className="p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="font-medium text-white">{log.action}</div>
                                    <div className="text-sm text-slate-400">{log.details}</div>
                                    <div className="text-xs text-slate-600 mt-1">By: {log.adminEmail}</div>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export const AdminSettingsPage = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        minDeposit: 1000,
        minWithdrawal: 1000,
        minInvestment: 5000,
        isSystemPaused: false,
        paystackPublicKey: '',
        kycRequiredForAccount: true,
        enableEmailLoginAlerts: true
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await adminApi.getSettings();
                // Ensure we merge with defaults in case of new fields
                setSettings(prev => ({ ...prev, ...response.data }));
            } catch (error: any) {
                console.error('Failed to fetch settings:', error);
                addToast('error', 'Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        try {
            await adminApi.updateSettings(settings);
            addToast('success', 'Settings saved successfully');
        } catch (error: any) {
            console.error('Failed to save settings:', error);
            addToast('error', 'Failed to save settings');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <h1 className="text-lg font-bold text-white">System Settings</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <h3 className="font-bold text-white mb-4">General Configuration</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                            <div>
                                <div className="font-medium text-white">System Pause</div>
                                <div className="text-xs text-slate-400">Suspend all withdrawals & deposits</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.isSystemPaused}
                                    onChange={e => setSettings({ ...settings, isSystemPaused: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                            <div>
                                <div className="font-medium text-white">Require KYC for Virtual Account</div>
                                <div className="text-xs text-slate-400">Enforce KYC verification before account generation</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.kycRequiredForAccount}
                                    onChange={e => setSettings({ ...settings, kycRequiredForAccount: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                            <div>
                                <div className="font-medium text-white">Email Login Alerts</div>
                                <div className="text-xs text-slate-400">Send email when user logs in</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enableEmailLoginAlerts ?? true}
                                    onChange={e => setSettings({ ...settings, enableEmailLoginAlerts: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold text-white mb-4">Financial Limits (Minimums)</h3>
                    <div className="space-y-4">
                        <Input
                            label="Minimum Funding Amount (₦)"
                            type="number"
                            value={settings.minDeposit}
                            onChange={e => setSettings({ ...settings, minDeposit: parseInt(e.target.value) || 0 })}
                            hint="Minimum amount a user can deposit"
                        />
                        <Input
                            label="Minimum Withdrawal Amount (₦)"
                            type="number"
                            value={settings.minWithdrawal}
                            onChange={e => setSettings({ ...settings, minWithdrawal: parseInt(e.target.value) || 0 })}
                            hint="Minimum amount a user can withdraw"
                        />
                        <Input
                            label="Minimum Investment Amount (₦)"
                            type="number"
                            value={settings.minInvestment}
                            onChange={e => setSettings({ ...settings, minInvestment: parseInt(e.target.value) || 0 })}
                            hint="Minimum amount required to create an investment"
                        />
                    </div>
                </Card>
            </div >

            <div className="flex justify-end">
                <Button onClick={handleSave} className="w-full md:w-auto">
                    Save Changes
                </Button>
            </div>
        </div >
    );
};
