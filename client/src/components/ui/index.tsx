import React from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle, Eye, EyeOff } from 'lucide-react';

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) => {
    const variants: Record<string, string> = {
        primary: "bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20",
        secondary: "bg-surface-highlight hover:bg-border text-foreground border border-border",
        outline: "border border-border text-foreground hover:bg-surface-highlight hover:text-foreground",
        ghost: "text-muted hover:text-foreground hover:bg-surface-highlight",
        danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20",
        success: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
    };


    const sizes: Record<string, string> = {
        sm: "px-2 py-1 text-[10px]",
        md: "px-3 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    return (
        <button
            className={`${sizes[size]} rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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

export const Input = ({ label, icon, className = '', error, success, hint, type, ...props }: InputProps) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === 'password' || props.name?.toLowerCase().includes('pin');
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="space-y-1.5 w-full">
            {label && <label className="text-xs font-bold text-muted uppercase tracking-wider">{label}</label>}
            <div className="relative">
                <input
                    type={inputType}
                    className={`w-full bg-surface border ${error ? 'border-red-500/50 focus:border-red-500' : success ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-border focus:border-primary'} rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted transition-colors disabled:opacity-50 ${icon ? 'pl-10' : ''} ${isPassword ? 'pr-10' : ''} ${className}`}
                    {...props}
                />
                {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icon}</div>}
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors focus:outline-none p-1"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
                {error && !isPassword && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none"><AlertCircle size={16} /></div>}
                {success && !isPassword && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none"><CheckCircle size={16} /></div>}
            </div>
            {error && <p className="text-[10px] text-red-400 font-medium">{error}</p>}
            {hint && !error && <p className="text-[10px] text-muted font-medium">{hint}</p>}
        </div>
    );
};

// Card Component
interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card = ({ children, className = '', onClick }: CardProps) => (
    <div
        onClick={onClick}
        className={`bg-surface border border-border rounded-xl p-3 ${onClick ? 'cursor-pointer hover:border-border/80 transition-colors' : ''} ${className}`}
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
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-3 border-b border-border">
                    <h3 className="font-bold text-foreground text-base">{title}</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-surface-highlight rounded-full text-muted hover:text-foreground transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto text-foreground">
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
            <div key={t.id} className="pointer-events-auto bg-surface border border-border text-foreground px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-fade-in">
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
    <div className={`animate-spin rounded-full border-2 border-border border-t-primary h-6 w-6 ${className}`} />
);
