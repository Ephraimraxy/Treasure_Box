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
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-900/40 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <Users className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Total Users</div>
                            <div className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</div>
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
                            <div className="text-2xl font-bold text-white">{stats?.activeInvestments || 0}</div>
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
                            <div className="text-2xl font-bold text-white">{stats?.pendingWithdrawals || 0}</div>
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
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white">Pending Withdrawals</h1>

            {withdrawals.length === 0 ? (
                <Card className="text-center py-12">
                    <Clock className="mx-auto text-slate-600 mb-4" size={48} />
                    <p className="text-slate-500">No pending withdrawals</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {withdrawals.map((w) => (
                        <Card key={w.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

    useEffect(() => {
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
        fetchUsers();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white">Users ({users.length})</h1>

            <div className="space-y-3">
                {users.map((user) => (
                    <Card key={user.id} className="flex items-center justify-between">
                        <div>
                            <div className="font-bold text-white">{user.name || user.email}</div>
                            <div className="text-sm text-slate-400">{user.email}</div>
                            <div className="text-xs text-slate-600 mt-1">
                                Joined: {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-white">
                                <FormatCurrency amount={user.balance} />
                            </div>
                            <div className={`text-xs uppercase font-bold ${user.kycVerified ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {user.kycVerified ? 'Verified' : 'Unverified'}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
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
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white">Audit Logs</h1>

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
    const [settings, setSettings] = useState({
        maintenanceMode: false,
        minWithdrawal: 1000,
        maxWithdrawal: 500000,
        referralBonus: 500,
        enableNotifications: true
    });

    const handleSave = () => {
        // In a real app, this would save to backend
        addToast('success', 'Settings saved successfully');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white">System Settings</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="font-bold text-white mb-4">General Configuration</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                            <div>
                                <div className="font-medium text-white">Maintenance Mode</div>
                                <div className="text-xs text-slate-400">Suspend all user activities</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.maintenanceMode}
                                    onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                            <div>
                                <div className="font-medium text-white">System Notifications</div>
                                <div className="text-xs text-slate-400">Enable global alerts</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={settings.enableNotifications}
                                    onChange={e => setSettings({ ...settings, enableNotifications: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold text-white mb-4">Financial Limits</h3>
                    <div className="space-y-4">
                        <Input
                            label="Minimum Withdrawal (₦)"
                            type="number"
                            value={settings.minWithdrawal}
                            onChange={e => setSettings({ ...settings, minWithdrawal: parseInt(e.target.value) })}
                        />
                        <Input
                            label="Maximum Withdrawal (₦)"
                            type="number"
                            value={settings.maxWithdrawal}
                            onChange={e => setSettings({ ...settings, maxWithdrawal: parseInt(e.target.value) })}
                        />
                        <Input
                            label="Referral Bonus (₦)"
                            type="number"
                            value={settings.referralBonus}
                            onChange={e => setSettings({ ...settings, referralBonus: parseInt(e.target.value) })}
                        />
                    </div>
                </Card>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} className="w-full md:w-auto">
                    Save Changes
                </Button>
            </div>
        </div>
    );
};
