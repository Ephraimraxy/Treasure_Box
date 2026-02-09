import React from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
    children: React.ReactNode;
}

export const Button = ({ children, variant = 'primary', className = '', ...props }: ButtonProps) => {
    const variants: Record<string, string> = {
        primary: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 shadow-lg shadow-orange-500/20",
        secondary: "bg-slate-700 hover:bg-slate-600 text-white",
        outline: "border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white",
        ghost: "text-slate-400 hover:text-white hover:bg-slate-800/50",
        danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
        success: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
    };

    return (
        <button
            className={`px-3 py-2 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    icon?: React.ReactNode;
    error?: string;
    success?: boolean;
    hint?: string;
}

export const Input = ({ label, icon, className = '', error, success, hint, ...props }: InputProps) => (
    <div className="space-y-1.5 w-full">
        {label && <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>}
        <div className="relative">
            <input
                className={`w-full bg-slate-900 border ${error ? 'border-red-500/50 focus:border-red-500' : success ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-slate-700 focus:border-amber-500'} rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600 transition-colors disabled:opacity-50 ${icon ? 'pl-10' : ''} ${className}`}
                {...props}
            />
            {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>}
            {error && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none"><AlertCircle size={16} /></div>}
            {success && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none"><CheckCircle size={16} /></div>}
        </div>
        {error && <p className="text-[10px] text-red-400 font-medium">{error}</p>}
        {hint && !error && <p className="text-[10px] text-slate-500 font-medium">{hint}</p>}
    </div>
);

// Card Component
interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card = ({ children, className = '', onClick }: CardProps) => (
    <div
        onClick={onClick}
        className={`bg-slate-800 border border-slate-700 rounded-xl p-3 ${onClick ? 'cursor-pointer hover:border-slate-600 transition-colors' : ''} ${className}`}
    >
        {children}
    </div>
);

// Modal Component
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-3 border-b border-slate-800">
                    <h3 className="font-bold text-white text-base">{title}</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Toast Container Component
interface Toast {
    id: number;
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
}

interface ToastContainerProps {
    toasts: Toast[];
}

export const ToastContainer = ({ toasts }: ToastContainerProps) => (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4 md:px-0">
        {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-fade-in">
                {t.type === 'error' ? <AlertCircle size={18} className="text-red-400" /> :
                    t.type === 'warning' ? <AlertTriangle size={18} className="text-amber-400" /> :
                        t.type === 'info' ? <Info size={18} className="text-blue-400" /> :
                            <CheckCircle size={18} className="text-emerald-400" />}
                <span className="text-sm font-medium">{t.message}</span>
            </div>
        ))}
    </div>
);

// FormatCurrency Component
export const FormatCurrency = ({ amount }: { amount: number }) => (
    <span className="font-mono">
        {new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)}
    </span>
);

// Loading Spinner
export const Spinner = ({ className = '' }: { className?: string }) => (
    <div className={`animate-spin rounded-full border-2 border-slate-600 border-t-amber-500 h-6 w-6 ${className}`} />
);
