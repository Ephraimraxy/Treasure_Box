import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { disputeApi } from '../api';
import { Button, Input, Card } from '../components/ui';
import { AlertTriangle, Upload, X, CheckCircle, Loader2, MessageSquare, Clock } from 'lucide-react';

export const DisputePage = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [image, setImage] = useState<string | null>(null); // Base64
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Image Handler
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                addToast('error', 'Image size must be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!subject || !message) {
            addToast('error', 'Please fill in subject and message');
            return;
        }

        setLoading(true);
        try {
            await disputeApi.create({ subject, message, snapshot: image });
            addToast('success', 'Report submitted successfully');
            setSubject('');
            setMessage('');
            setImage(null);
            fetchHistory();
            setActiveTab('history');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to submit report');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await disputeApi.getMyDisputes();
            setHistory(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Initial Fetch
    React.useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab]);

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Report & Disputes</h1>
                    <p className="text-slate-400">Submit issues or report problems with transactions</p>
                </div>
            </div>

            <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'new' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    New Report
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    History
                </button>
            </div>

            {activeTab === 'new' ? (
                <Card>
                    <div className="space-y-4">
                        <Input
                            label="Subject"
                            placeholder="e.g. Transaction failed, Quiz error..."
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Description</label>
                            <textarea
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500/50 min-h-[120px] resize-none"
                                placeholder="Describe the issue in detail..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Snapshot (Optional)</label>
                            {image ? (
                                <div className="relative rounded-xl overflow-hidden border border-slate-700 group">
                                    <img src={image} alt="Preview" className="w-full h-48 object-cover" />
                                    <button
                                        onClick={() => setImage(null)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-rose-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center hover:bg-slate-900/50 transition-colors cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <Upload className="mx-auto text-slate-500 mb-2" size={24} />
                                    <p className="text-sm text-slate-400">Click to upload screenshot</p>
                                    <p className="text-xs text-slate-600 mt-1">Max 5MB</p>
                                </div>
                            )}
                        </div>

                        <Button onClick={handleSubmit} disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700 text-white mt-4">
                            {loading ? <Loader2 className="animate-spin" /> : 'Submit Report'}
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="space-y-4">
                    {historyLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-rose-500" /></div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">No reports found.</div>
                    ) : (
                        history.map((item) => (
                            <Card key={item.id} className="group hover:border-slate-700 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-white">{item.subject}</h3>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${item.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-500' :
                                            item.status === 'CLOSED' ? 'bg-slate-700 text-slate-400' :
                                                'bg-amber-500/20 text-amber-500'
                                        }`}>
                                        {item.status}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-400 line-clamp-2 mb-3">{item.message}</p>

                                {item.adminReply && (
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 mb-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                                            <MessageSquare size={12} /> Admin Reply
                                        </div>
                                        <p className="text-xs text-slate-300">{item.adminReply}</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 text-xs text-slate-600">
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </div>
                                    {item.snapshotUrl && (
                                        <a
                                            href={`http://localhost:5000${item.snapshotUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-400 hover:underline"
                                        >
                                            View Snapshot
                                        </a>
                                    )}
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
