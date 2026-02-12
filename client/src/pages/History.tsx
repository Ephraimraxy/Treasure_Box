import React, { useState, useEffect, useCallback, useRef } from 'react';
import { transactionApi } from '../api';
import { Card, FormatCurrency, Spinner } from '../components/ui';
import { ArrowUpRight, ArrowDownRight, Receipt, Search, X, Download, Share2, Clock, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Transaction {
    id: string;
    type: string;
    amount: number;
    status: string;
    description: string;
    createdAt: string;
}

export const HistoryPage = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'investment'>('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Receipt state
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [sharing, setSharing] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const response = await transactionApi.getAll(page, 20, filter !== 'all' ? filter : undefined, debouncedSearch || undefined);
            const data = response.data.data || response.data;
            if (page === 1) setTransactions(data);
            else setTransactions(prev => [...prev, ...data]);
            setHasMore(data.length >= 20);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, filter, debouncedSearch]);

    useEffect(() => { setPage(1); }, [filter, debouncedSearch]);
    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const handleFilterChange = (newFilter: typeof filter) => {
        if (newFilter !== filter) {
            setFilter(newFilter);
            setPage(1);
        }
    };

    const getTypeIcon = (type: string) => {
        if (type.includes('DEBIT') || type === 'WITHDRAWAL' || type === 'UTILITY_BILL') {
            return <ArrowUpRight size={18} className="text-red-400" />;
        }
        return <ArrowDownRight size={18} className="text-emerald-400" />;
    };

    const isDebit = (type: string) =>
        type.includes('DEBIT') || type === 'WITHDRAWAL' || type === 'UTILITY_BILL';

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'SUCCESS': return { icon: <CheckCircle size={14} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Successful' };
            case 'PENDING': return { icon: <Clock size={14} />, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pending' };
            default: return { icon: <AlertCircle size={14} />, color: 'text-red-400', bg: 'bg-red-500/10', label: status };
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
    const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    const formatFull = (d: string) => `${formatDate(d)} at ${formatTime(d)}`;

    // ─── Share as Image ───
    const handleShareImage = async () => {
        if (!receiptRef.current) return;
        setSharing(true);
        try {
            const canvas = await html2canvas(receiptRef.current, {
                backgroundColor: '#0f172a',
                scale: 2,
                useCORS: true,
            });
            const url = canvas.toDataURL('image/png');
            // Try native share first
            if (navigator.share && navigator.canShare) {
                const blob = await (await fetch(url)).blob();
                const file = new File([blob], `receipt-${selectedTx?.id?.slice(0, 8)}.png`, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Transaction Receipt' });
                    setSharing(false);
                    return;
                }
            }
            // Fallback: download
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-${selectedTx?.id?.slice(0, 8)}.png`;
            a.click();
        } catch (e) {
            console.error(e);
        } finally {
            setSharing(false);
        }
    };

    // ─── Share as PDF ───
    const handleSharePDF = async () => {
        if (!receiptRef.current) return;
        setSharing(true);
        try {
            const canvas = await html2canvas(receiptRef.current, {
                backgroundColor: '#0f172a',
                scale: 2,
                useCORS: true,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, imgHeight);
            pdf.save(`receipt-${selectedTx?.id?.slice(0, 8)}.pdf`);
        } catch (e) {
            console.error(e);
        } finally {
            setSharing(false);
        }
    };

    const copyId = (id: string) => {
        navigator.clipboard.writeText(id);
    };

    return (
        <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-amber-500/10 rounded-xl">
                    <Receipt size={22} className="text-amber-500" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">Transaction History</h1>
                    <p className="text-xs text-slate-500">Tap any transaction to view receipt</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search transactions..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 p-1 bg-slate-900/50 border border-slate-800 rounded-xl">
                {(['all', 'deposit', 'withdrawal', 'investment'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => handleFilterChange(f)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${filter === f ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Transactions List */}
            <div className="space-y-2">
                {loading && page === 1 ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-16">
                        <Receipt size={40} className="mx-auto text-slate-700 mb-3" />
                        <p className="text-slate-400 text-sm font-medium">No transactions found</p>
                    </div>
                ) : (
                    transactions.map(tx => {
                        const debit = isDebit(tx.type);
                        const statusCfg = getStatusConfig(tx.status);
                        return (
                            <button
                                key={tx.id}
                                onClick={() => setSelectedTx(tx)}
                                className="w-full p-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 transition-all text-left group"
                            >
                                <div className={`p-2.5 rounded-xl shrink-0 ${debit ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                                    {getTypeIcon(tx.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{tx.description}</div>
                                    <div className="text-[10px] text-slate-500">{formatDate(tx.createdAt)} • {formatTime(tx.createdAt)}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={`font-bold text-sm ${debit ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {debit ? '-' : '+'}<FormatCurrency amount={tx.amount} />
                                    </div>
                                    <div className={`text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                                        {statusCfg.icon} {tx.status}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Load More */}
            {hasMore && transactions.length > 0 && (
                <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={loading}
                    className="w-full py-3 text-sm text-amber-500 hover:text-amber-400 font-bold transition-colors"
                >
                    {loading ? 'Loading...' : 'Load More'}
                </button>
            )}

            {/* ════════════════════════════════════════════ */}
            {/* RECEIPT MODAL */}
            {/* ════════════════════════════════════════════ */}
            {selectedTx && (() => {
                const debit = isDebit(selectedTx.type);
                const statusCfg = getStatusConfig(selectedTx.status);
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
                        <div className="relative z-10 w-full max-w-sm animate-fade-in flex flex-col max-h-[90vh]">
                            {/* Receipt Card (capturable) */}
                            <div ref={receiptRef} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                                {/* Receipt Header */}
                                <div className={`p-5 text-center ${debit
                                    ? 'bg-gradient-to-br from-red-500/20 to-slate-900'
                                    : 'bg-gradient-to-br from-emerald-500/20 to-slate-900'
                                    }`}>
                                    <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3 ${debit ? 'bg-red-500/20' : 'bg-emerald-500/20'
                                        }`}>
                                        {debit
                                            ? <ArrowUpRight size={28} className="text-red-400" />
                                            : <ArrowDownRight size={28} className="text-emerald-400" />
                                        }
                                    </div>
                                    <div className={`text-3xl font-black font-mono ${debit ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {debit ? '-' : '+'}<FormatCurrency amount={selectedTx.amount} />
                                    </div>
                                    <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                                        {statusCfg.icon} {statusCfg.label}
                                    </div>
                                </div>

                                {/* Receipt Details */}
                                <div className="p-5 space-y-3">
                                    {[
                                        { label: 'Description', value: selectedTx.description },
                                        { label: 'Type', value: selectedTx.type.replace(/_/g, ' ') },
                                        { label: 'Date & Time', value: formatFull(selectedTx.createdAt) },
                                        { label: 'Transaction ID', value: selectedTx.id.slice(0, 16) + '...' },
                                    ].map((row, i) => (
                                        <div key={i} className="flex justify-between items-start gap-4 py-2 border-b border-slate-800/60 last:border-0">
                                            <span className="text-xs text-slate-500 shrink-0">{row.label}</span>
                                            <span className="text-xs text-white font-semibold text-right break-all">{row.value}</span>
                                        </div>
                                    ))}

                                    {/* Copy ID */}
                                    <button
                                        onClick={() => copyId(selectedTx.id)}
                                        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-400 hover:text-amber-400 transition-colors"
                                    >
                                        <Copy size={12} /> Copy Full ID
                                    </button>

                                    {/* Branding */}
                                    <div className="text-center pt-3 border-t border-slate-800/60">
                                        <p className="text-[10px] text-slate-600 font-bold">Treasure Box • Transaction Receipt</p>
                                    </div>
                                </div>
                            </div>

                            {/* Share Actions (outside capturable area) */}
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleShareImage}
                                    disabled={sharing}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {sharing ? <Spinner className="w-4 h-4" /> : <><Share2 size={16} /> Image</>}
                                </button>
                                <button
                                    onClick={handleSharePDF}
                                    disabled={sharing}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {sharing ? <Spinner className="w-4 h-4" /> : <><Download size={16} /> PDF</>}
                                </button>
                                <button
                                    onClick={() => setSelectedTx(null)}
                                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 text-sm font-bold transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
