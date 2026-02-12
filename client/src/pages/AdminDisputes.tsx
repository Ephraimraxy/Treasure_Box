import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { disputeApi } from '../api';
import { Button, Card, Spinner, Modal } from '../components/ui';
import { AlertCircle, CheckCircle, Clock, Search, ExternalLink, MessageSquare, X } from 'lucide-react';

export const AdminDisputesPage = () => {
    const { user } = useAuth();
    const { addToast } = useToast();

    // State
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    // Reply Modal
    const [selectedDispute, setSelectedDispute] = useState<any>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [replyStatus, setReplyStatus] = useState<'RESOLVED' | 'CLOSED'>('RESOLVED');
    const [submitting, setSubmitting] = useState(false);

    const fetchDisputes = async () => {
        setLoading(true);
        try {
            const res = await disputeApi.getAll();
            setDisputes(res.data);
        } catch (error) {
            addToast('error', 'Failed to load disputes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDisputes();
    }, []);

    const handleResolve = async () => {
        if (!replyMessage) return addToast('error', 'Please enter a reply');

        setSubmitting(true);
        try {
            await disputeApi.resolve(selectedDispute.id, replyMessage, replyStatus);
            addToast('success', 'Dispute updated successfully');
            setSelectedDispute(null);
            setReplyMessage('');
            fetchDisputes();
        } catch (error) {
            addToast('error', 'Failed to update dispute');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredDisputes = disputes.filter(d => {
        if (filter !== 'ALL' && d.status !== filter) return false;
        if (search && !d.subject.toLowerCase().includes(search.toLowerCase()) && !d.user.email.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dispute Management</h1>
                    <p className="text-slate-400">Handle user reports and issues</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={fetchDisputes}><Clock size={16} /> Refresh</Button>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                    <input
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-amber-500 outline-none"
                        placeholder="Search by subject or user email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    <option value="ALL">All Status</option>
                    <option value="OPEN">Open</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Spinner /></div>
            ) : filteredDisputes.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                    No disputes found matching criteria.
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredDisputes.map(dispute => (
                        <Card key={dispute.id} className="hover:border-slate-600 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${dispute.status === 'OPEN' ? 'bg-rose-500/10 text-rose-500' :
                                            dispute.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500' :
                                                'bg-slate-700 text-slate-400'
                                        }`}>
                                        {dispute.status === 'OPEN' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-white">{dispute.subject}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${dispute.status === 'OPEN' ? 'bg-rose-500/20 text-rose-500' :
                                                    dispute.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-500' :
                                                        'bg-slate-700 text-slate-400'
                                                }`}>
                                                {dispute.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-300 mb-2">{dispute.message}</p>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <span>User: {dispute.user.email}</span>
                                            <span>•</span>
                                            <span>{new Date(dispute.createdAt).toLocaleString()}</span>
                                            {dispute.snapshotUrl && (
                                                <>
                                                    <span>•</span>
                                                    <a href={`http://localhost:5000${dispute.snapshotUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                                        <ExternalLink size={12} /> View Snapshot
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {dispute.status === 'OPEN' && (
                                    <Button size="sm" onClick={() => setSelectedDispute(dispute)}>
                                        Resolve
                                    </Button>
                                )}
                            </div>

                            {dispute.adminReply && (
                                <div className="mt-4 pt-4 border-t border-slate-800 ml-14">
                                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                                        <MessageSquare size={12} /> Admin Reply
                                    </div>
                                    <p className="text-sm text-slate-400">{dispute.adminReply}</p>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {/* Resolve Modal */}
            <Modal isOpen={!!selectedDispute} onClose={() => setSelectedDispute(null)} title="Resolve Dispute">
                <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-sm">
                        <span className="text-slate-500 block text-xs mb-1">User Message:</span>
                        <p className="text-slate-300">{selectedDispute?.message}</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-300 mb-1 block">Action</label>
                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                            <button
                                onClick={() => setReplyStatus('RESOLVED')}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${replyStatus === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-400 hover:text-white'}`}
                            >
                                Mark Resolved
                            </button>
                            <button
                                onClick={() => setReplyStatus('CLOSED')}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${replyStatus === 'CLOSED' ? 'bg-slate-700 text-slate-300' : 'text-slate-400 hover:text-white'}`}
                            >
                                Close Ticket
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-300 mb-1 block">Reply Message</label>
                        <textarea
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500 min-h-[100px]"
                            placeholder="Enter your response to the user..."
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                        />
                    </div>

                    <Button onClick={handleResolve} disabled={submitting} className="w-full">
                        {submitting ? 'Submitting...' : 'Submit Resolution'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
