import React, { useRef, useState } from 'react';
import { Download, Loader2, TrendingUp, TrendingDown, Wallet, Users, AlertTriangle } from 'lucide-react';
import { Button } from '../ui';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

interface FinancialReportData {
    period: { start: string; end: string };
    summary: {
        totalUsers: number;
        totalLiability: number;
        paystackAvailable: number;
        coverageRatio: number | null;
        netCashFlow: number;
        platformRevenue: number;
    };
    cashFlow: {
        deposits: number;
        withdrawals: number;
        pendingWithdrawals: number;
    };
    quizEconomy: {
        revenue: number;
        payouts: number;
        profit: number;
    };
    investments: {
        newCount: number;
        totalCapital: number;
        payouts: number;
    };
    risk: {
        reconciliations: number;
        criticalEvents: number;
        protectionBlocks: number;
    };
    transactions: Array<{
        date: string;
        type: string;
        amount: number;
        status: string;
        user: string;
        description: string;
    }>;
}

interface FinancialStatementReportProps {
    data: FinancialReportData;
    onClose: () => void;
}

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

export const FinancialStatementReport: React.FC<FinancialStatementReportProps> = ({ data, onClose }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!reportRef.current) return;
        setIsDownloading(true);

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2, // High resolution
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff' // Ensure white background for PDF
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

            // If report is long, we might need multi-page logic (simplified for now to fit-to-width)
            // Ideally, for a long report, we'd render independent sections.
            // For now, let's fit width and split pages if needed or just scale down.
            // A simple approach for this task: Scale to width, and let it span pages if supported
            // or just single page for the dashboard summary.

            // To support multi-page robustly, we'd loop.
            // For this version (Executive Summary focus), let's stick to one nice summary page first.
            // Or simple full-height image.

            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeightCalculated = (imgProps.height * pdfWidth) / imgProps.width;

            // Calculate number of pages
            let heightLeft = pdfHeightCalculated;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeightCalculated);
            heightLeft -= pdfHeight;

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeightCalculated;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeightCalculated);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Financial_Statement_${data.period.start.split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF Export failed', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
    };

    const cashFlowChartData = [
        { name: 'Deposits', amount: data.cashFlow.deposits },
        { name: 'Withdrawals', amount: data.cashFlow.withdrawals },
        { name: 'Net Flow', amount: data.summary.netCashFlow },
    ];

    const quizChartData = [
        { name: 'Revenue', value: data.quizEconomy.revenue },
        { name: 'Payouts', value: data.quizEconomy.payouts },
        { name: 'Profit', value: data.quizEconomy.profit },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white text-slate-900 w-full max-w-5xl rounded-xl shadow-2xl relative">
                {/* Header Controls */}
                <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 rounded-t-xl">
                    <h2 className="text-xl font-bold">Financial Statement Preview</h2>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isDownloading}>
                            Close
                        </Button>
                        <Button onClick={handleDownload} disabled={isDownloading}>
                            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Export PDF
                        </Button>
                    </div>
                </div>

                {/* Printable Report Area */}
                <div ref={reportRef} className="p-8 bg-white min-h-[1000px] text-slate-900">
                    {/* Report Header */}
                    <div className="flex justify-between items-start mb-8 border-b-2 border-primary pb-4">
                        <div>
                            <h1 className="text-3xl font-extrabold text-primary mb-1">TREASURE BOX</h1>
                            <p className="text-sm text-gray-500">Financial Performance Report</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold">Period</p>
                            <p className="text-sm">{new Date(data.period.start).toLocaleDateString()} — {new Date(data.period.end).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-400 mt-1">Generated: {new Date().toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Executive Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                                <Users className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Total Users</span>
                            </div>
                            <p className="text-2xl font-bold">{data.summary.totalUsers.toLocaleString()}</p>
                        </div>
                        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                                <Wallet className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">User Liability</span>
                            </div>
                            <p className="text-2xl font-bold">{formatCurrency(data.summary.totalLiability)}</p>
                        </div>
                        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Net Revenue</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className={`text-2xl font-bold ${data.summary.platformRevenue >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {formatCurrency(data.summary.platformRevenue)}
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Liquidity Coverage</span>
                            </div>
                            <p className={`text-2xl font-bold ${data.summary.coverageRatio && data.summary.coverageRatio < 1 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {data.summary.coverageRatio ? `${(data.summary.coverageRatio).toFixed(2)}x` : 'N/A'}
                            </p>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                Cash Flow Analysis
                            </h3>
                            <div className="h-64 border border-gray-200 rounded-lg p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={cashFlowChartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                        <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₦${val / 1000}k`} />
                                        <Tooltip formatter={(val: number | string | Array<number | string> | undefined) => formatCurrency(Number(val) || 0)} />
                                        <Bar dataKey="amount" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <TrendingDown className="w-5 h-5 text-emerald-500" />
                                Quiz Economy
                            </h3>
                            <div className="h-64 border border-gray-200 rounded-lg p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={quizChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} />
                                        <Tooltip formatter={(val: number | string | Array<number | string> | undefined) => formatCurrency(Number(val) || 0)} />
                                        <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Metrics Table */}
                    <div className="mb-8">
                        <h3 className="text-lg font-bold mb-4 border-b pb-2">Operational Metrics</h3>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="p-3 font-semibold text-gray-600">Metric</th>
                                    <th className="p-3 font-semibold text-gray-600 text-right">Value</th>
                                    <th className="p-3 font-semibold text-gray-600">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr>
                                    <td className="p-3">Total Deposits</td>
                                    <td className="p-3 text-right font-medium">{formatCurrency(data.cashFlow.deposits)}</td>
                                    <td className="p-3 text-gray-500">Inflow from users</td>
                                </tr>
                                <tr>
                                    <td className="p-3">Total Withdrawals</td>
                                    <td className="p-3 text-right font-medium">{formatCurrency(data.cashFlow.withdrawals)}</td>
                                    <td className="p-3 text-gray-500">Paid out to users</td>
                                </tr>
                                <tr>
                                    <td className="p-3">Pending Withdrawals</td>
                                    <td className="p-3 text-right text-orange-500">{formatCurrency(data.cashFlow.pendingWithdrawals)}</td>
                                    <td className="p-3 text-gray-500">Awaiting processing</td>
                                </tr>
                                <tr>
                                    <td className="p-3">Investments Created</td>
                                    <td className="p-3 text-right">{data.investments.newCount}</td>
                                    <td className="p-3 text-gray-500">Volume: {formatCurrency(data.investments.totalCapital)}</td>
                                </tr>
                                <tr>
                                    <td className="p-3">Risk Events</td>
                                    <td className="p-3 text-right text-red-500">{data.risk.criticalEvents}</td>
                                    <td className="p-3 text-gray-500">Critical reconciliation mismatches</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Recent Transactions Ledger */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b pb-2">Recent 50 Transactions</h3>
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="p-2 font-semibold">Date</th>
                                    <th className="p-2 font-semibold">Type</th>
                                    <th className="p-2 font-semibold">User</th>
                                    <th className="p-2 font-semibold text-right">Amount</th>
                                    <th className="p-2 font-semibold text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.transactions.slice(0, 50).map((t, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                        <td className="p-2">{new Date(t.date).toLocaleString()}</td>
                                        <td className="p-2 badge badge-outline">{t.type}</td>
                                        <td className="p-2 truncate max-w-[150px]">{t.user}</td>
                                        <td className={`p-2 text-right font-medium ${t.type.includes('DEPOSIT') || t.type.includes('WIN') ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {formatCurrency(t.amount)}
                                        </td>
                                        <td className="p-2 text-right">{t.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-center text-xs text-gray-400 mt-4">Showing last 50 transactions for brevity in PDF. Full export available via CSV.</p>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
                        <p>Treasure Box Platform &copy; 2024. Confidential Financial Document.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
