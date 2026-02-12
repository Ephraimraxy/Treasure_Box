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
    metadata?: any;
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
    const [sharing, setSharing] = useState<'image' | 'pdf' | null>(null);
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

    interface ReceiptData {
        amount: number;
        status: string;
        type: string;
        date: string;
        ref: string;
        sender?: string;
        recipient?: string;
        bankName?: string;
        accountNumber?: string;
        description?: string;
        provider?: string;
        meterNumber?: string;
        token?: string;
        item?: string; // For store purchases/quiz
    }

    // ─── Generate Receipt Data ───
    const getReceiptData = useCallback((tx: Transaction): ReceiptData => {
        const data: ReceiptData = {
            amount: tx.amount,
            status: tx.status,
            type: tx.type,
            date: tx.createdAt,
            ref: tx.id,
            description: tx.description,
        };

        const meta = tx.metadata || {};

        if (tx.type === 'WITHDRAWAL' || tx.type.includes('DEBIT')) {
            data.recipient = meta.recipientName || meta.accountName || "External Bank Account";
            data.bankName = meta.bankName || meta.bank || "";
            data.accountNumber = meta.accountNumber || meta.account || "";
        } else if (tx.type === 'DEPOSIT') {
            data.sender = "Bank Transfer / Card";
            data.bankName = "Paystack Checkout";
        } else if (tx.type === 'UTILITY_BILL') {
            data.provider = meta.provider || "Utility Provider";
            data.meterNumber = meta.meterNumber || meta.customer || "N/A";
            data.token = meta.token;
        }

        return data;
    }, []);

    // ─── Capture Receipt (Shared Logic) ───
    const captureReceipt = async () => {
        if (!receiptRef.current) return null;
        try {
            const canvas = await html2canvas(receiptRef.current, {
                backgroundColor: '#0f172a', // Match slate-950/900 theme
                scale: 3, // Higher quality
                useCORS: true,
                logging: false,
                onclone: (doc) => {
                    // Ensure hidden elements are visible for capture if needed
                    const el = doc.getElementById('receipt-content');
                    if (el) el.style.padding = '20px'; // Add padding for export
                }
            });
            return canvas;
        } catch (e) {
            console.error("Capture failed", e);
            return null;
        }
    };

    // ─── Share as Image ───
    const handleShareImage = async () => {
        setSharing('image');
        const canvas = await captureReceipt();
        if (!canvas) { setSharing(null); return; }

        try {
            const url = canvas.toDataURL('image/png');
            if (navigator.share && navigator.canShare) {
                const blob = await (await fetch(url)).blob();
                const file = new File([blob], `TB-Receipt-${selectedTx?.id.slice(0, 8)}.png`, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Treasure Box Receipt' });
                    setSharing(null);
                    return;
                }
            }
            const a = document.createElement('a');
            a.href = url;
            a.download = `TB-Receipt-${selectedTx?.id.slice(0, 8)}.png`;
            a.click();
        } finally {
            setSharing(null);
        }
    };

    // ─── Share as PDF ───
    const handleSharePDF = async () => {
        setSharing('pdf');
        const canvas = await captureReceipt();
        if (!canvas) { setSharing(null); return; }

        try {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            // Center vertically if short, or top if long
            const yPos = imgHeight < pdfHeight ? (pdfHeight - imgHeight) / 5 : 10;

            pdf.addImage(imgData, 'PNG', 0, yPos, pdfWidth, imgHeight);
            pdf.save(`TB-Receipt-${selectedTx?.id.slice(0, 8)}.pdf`);
        } finally {
            setSharing(null);
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
                const rData = getReceiptData(selectedTx);

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />

                        <div className="relative z-10 w-full max-w-sm flex flex-col h-[85vh]">
                            {/* Scrollable Container for Receipt */}
                            <div className="flex-1 overflow-y-auto no-scrollbar rounded-t-2xl bg-slate-900 border border-slate-700 border-b-0 shadow-2xl">
                                <div id="receipt-content" ref={receiptRef} className="bg-slate-900 p-6 min-h-full flex flex-col relative overflow-hidden">
                                    {/* Top Decoration */}
                                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

                                    {/* Header: Logo & Title */}
                                    <div className="flex justify-between items-start mb-8 mt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                                                <div className="text-white font-bold text-xs">TB</div>
                                            </div>
                                            <span className="font-bold text-white leading-tight text-sm">Treasure<br />Box</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Transaction Receipt</div>
                                        </div>
                                    </div>

                                    {/* Amount & Status */}
                                    <div className="text-center mb-8">
                                        <div className={`text-4xl font-black mb-2 ${debit ? 'text-white' : 'text-emerald-400'}`}>
                                            <FormatCurrency amount={rData.amount} />
                                        </div>
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                                            {statusCfg.icon} {statusCfg.label}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-2 font-mono">{formatFull(rData.date)}</div>
                                    </div>

                                    {/* Divider */}
                                    <div className="relative h-px bg-slate-800 w-full mb-6">
                                        <div className="absolute -left-8 -top-3 w-6 h-6 rounded-full bg-slate-950" />
                                        <div className="absolute -right-8 -top-3 w-6 h-6 rounded-full bg-slate-950" />
                                    </div>

                                    {/* Detailed Rows */}
                                    <div className="space-y-4 text-sm flex-1">
                                        {/* Dynamic Fields based on Type */}
                                        {rData.recipient && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-slate-500">Recipient Details</span>
                                                <div className="text-right">
                                                    <div className="font-bold text-white uppercase">{rData.recipient}</div>
                                                    {rData.bankName && <div className="text-xs text-slate-400">{rData.bankName}</div>}
                                                    {rData.accountNumber && <div className="text-xs text-slate-400">{rData.accountNumber}</div>}
                                                </div>
                                            </div>
                                        )}

                                        {rData.sender && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-slate-500">Sender Details</span>
                                                <div className="text-right">
                                                    <div className="font-bold text-white uppercase">{rData.sender}</div>
                                                </div>
                                            </div>
                                        )}

                                        {rData.provider && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-slate-500">Provider</span>
                                                <div className="text-right">
                                                    <div className="font-bold text-white uppercase">{rData.provider}</div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-start">
                                            <span className="text-slate-500">Transaction Type</span>
                                            <span className="font-medium text-white capitalize">{rData.type.replace(/_/g, ' ').toLowerCase()}</span>
                                        </div>

                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-slate-500 shrink-0">Description</span>
                                            <span className="font-medium text-white text-right">{rData.description}</span>
                                        </div>

                                        <div className="pt-4 border-t border-dashed border-slate-800 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Transaction No.</span>
                                                <span className="font-mono text-xs text-slate-300">{rData.ref.slice(0, 20)}...</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Session ID</span>
                                                <span className="font-mono text-xs text-slate-300">{rData.ref}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                                        <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                                            Enjoy a better life with Treasure Box. Get free transfers, withdrawals, bill payments, and good annual interest on your savings.
                                        </p>
                                        <p className="text-[10px] text-slate-600 mt-2 font-bold opacity-50">Licensed by Central Bank of Nigeria</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Wave/Tear Effect (Visual only) */}
                            <div className="h-4 bg-slate-900 w-full relative overflow-hidden rounded-b-2xl mb-4">
                                <div className="absolute top-0 left-0 w-full h-full flex" style={{ transform: 'translateY(-50%)' }}>
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        <div key={i} className="flex-1 h-8 rounded-full bg-slate-950 mx-[-4px]" />
                                    ))}
                                </div>
                            </div>

                            {/* Share Buttons */}
                            <div className="grid grid-cols-2 gap-3 pb-safe">
                                <button
                                    onClick={handleShareImage}
                                    disabled={!!sharing}
                                    className="flex items-center justify-center gap-2 py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {sharing === 'image' ? <Spinner className="w-4 h-4" /> : <><Share2 size={18} /> Share Image</>}
                                </button>
                                <button
                                    onClick={handleSharePDF}
                                    disabled={!!sharing}
                                    className="flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {sharing === 'pdf' ? <Spinner className="w-4 h-4" /> : <><Download size={18} /> Share PDF</>}
                                </button>
                            </div>

                            <button
                                onClick={() => setSelectedTx(null)}
                                className="mt-4 mx-auto p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all absolute -top-14 right-0"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
