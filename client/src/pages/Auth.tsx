import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Mail, Lock, Users, User, ArrowLeft, ArrowRight, KeyRound, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api';

// Animated Input Component
export const AnimatedInput = ({
    type = 'text',
    placeholder,
    value,
    onChange,
    icon: Icon,
    autoFocus = false,
    maxLength,
    onKeyDown
}: {
    type?: string;
    placeholder: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon: React.ElementType;
    autoFocus?: boolean;
    maxLength?: number;
    onKeyDown?: (e: React.KeyboardEvent) => void;
}) => (
    <div className="animate-slide-up">
        <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon size={20} />
            </div>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                autoFocus={autoFocus}
                maxLength={maxLength}
                onKeyDown={onKeyDown}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-lg"
            />
        </div>
    </div>
);

// Step Indicator
const StepIndicator = ({ current, total }: { current: number; total: number }) => (
    <div className="flex gap-2 justify-center mb-8">
        {Array.from({ length: total }).map((_, i) => (
            <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i < current ? 'w-8 bg-amber-500' : i === current ? 'w-8 bg-amber-500/50' : 'w-2 bg-slate-700'
                    }`}
            />
        ))}
    </div>
);

// Button
export const ActionButton = ({
    onClick,
    disabled,
    loading,
    children,
    variant = 'primary'
}: {
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
}) => (
    <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${variant === 'primary'
            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50'
            : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
    >
        {loading ? <Loader2 className="animate-spin" size={20} /> : children}
    </button>
);

// Password Strength Meter Component
const PasswordStrengthMeter = ({ password }: { password: string }) => {
    const calculateStrength = (pass: string) => {
        let strength = 0;
        if (pass.length > 5) strength += 1;
        if (pass.length > 10) strength += 1;
        if (/[A-Z]/.test(pass)) strength += 1;
        if (/[0-9]/.test(pass)) strength += 1;
        if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
        return strength;
    };

    const strength = calculateStrength(password);

    const getColor = (s: number) => {
        if (s <= 2) return 'bg-red-500';
        if (s <= 4) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    const getLabel = (s: number) => {
        if (s <= 2) return 'Weak';
        if (s <= 4) return 'Medium';
        return 'Strong';
    };

    return (
        <div className="mt-2 text-sm text-slate-400">
            <div className="flex justify-between mb-1">
                <span>Password Strength:</span>
                <span className={`font-bold ${strength <= 2 ? 'text-red-500' : strength <= 4 ? 'text-yellow-500' : 'text-emerald-500'
                    }`}>{getLabel(strength)}</span>
            </div>
            <div className="flex gap-1 h-1.5">
                {[1, 2, 3, 4, 5].map((level) => (
                    <div
                        key={level}
                        className={`flex-1 rounded-full transition-all duration-300 ${level <= strength ? getColor(strength) : 'bg-slate-800'
                            }`}
                    />
                ))}
            </div>
            <ul className="mt-2 text-xs text-slate-500 space-y-1">
                <li className={password.length > 5 ? 'text-emerald-500' : ''}>✓ Min 6 chars</li>
                <li className={/[A-Z]/.test(password) ? 'text-emerald-500' : ''}>✓ Uppercase</li>
                <li className={/[0-9]/.test(password) ? 'text-emerald-500' : ''}>✓ Number</li>
                <li className={/[^A-Za-z0-9]/.test(password) ? 'text-emerald-500' : ''}>✓ Special Char</li>
            </ul>
        </div>
    );
};

// Login Page (No OTP)
export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, handleLoginSuccess } = useAuth(); // Destructure handleLoginSuccess
    const [view, setView] = useState<'login' | 'resume'>('login');
    const [resumeEmail, setResumeEmail] = useState('');
    const [resumeStep, setResumeStep] = useState<'email' | 'otp'>('email');
    const [otp, setOtp] = useState('');
    const { addToast } = useToast();
    const navigate = useNavigate();



    const handleResumeSubmit = async () => {
        if (!resumeEmail) {
            addToast('error', 'Please enter your email');
            return;
        }
        setLoading(true);
        try {
            await authApi.resendOTP(resumeEmail);
            addToast('success', 'If account exists, OTP sent!');
            setResumeStep('otp');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyResume = async () => {
        if (otp.length !== 6) {
            addToast('error', 'Enter valid OTP');
            return;
        }
        setLoading(true);
        try {
            const response = await authApi.verifyOTP(resumeEmail, otp);
            if (response.data.token) {
                await handleLoginSuccess(response.data.token);
                addToast('success', 'Verification successful!');
                navigate('/');
            }
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            addToast('error', 'Please enter both email and password');
            return;
        }
        setLoading(true);
        try {
            const response = await authApi.login(email, password);

            // Check if email needs verification (legacy flow or new safeguard)
            if (response.data.requiresOTP) {
                // If the user isn't verified, we might redirect them to a verify page 
                // or handle the OTP flow if you decide to keep it for unverified users.
                // For now, let's assume standard login succeeds with a token.
                addToast('warning', 'Please verify your email first.');
                return;
            }

            if (response.data.token) {
                await handleLoginSuccess(response.data.token);
                addToast('success', 'Welcome back!');
                // Navigation will be handled by the router/protected route logic if needed, 
                // but we default to / and let the App component handle redirects based on role.
                navigate('/');
            }
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950" />
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-amber-500/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-orange-500/10 blur-[120px] rounded-full" />

            <div className="w-full max-w-md relative z-10">
                {view === 'login' ? (
                    <>
                        <div className="text-center mb-10">
                            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-6 transform rotate-3 hover:rotate-0 transition-transform">
                                <Box size={48} className="text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                            <p className="text-slate-400">Sign in to your account</p>
                        </div>

                        <div className="space-y-4">
                            <AnimatedInput
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={Mail}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            />
                            <AnimatedInput
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={Lock}
                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            />

                            <div className="flex justify-between items-center text-sm">
                                <button
                                    onClick={() => setView('resume')}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    Continue Verification?
                                </button>
                                <Link to="/forgot-password" className="text-amber-500 hover:text-amber-400">
                                    Forgot Password?
                                </Link>
                            </div>

                            <ActionButton onClick={handleLogin} loading={loading} disabled={!email || !password}>
                                {loading ? 'Signing In...' : 'Sign In'}
                            </ActionButton>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 mx-auto bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
                                <Mail size={40} className="text-amber-500" />
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">Resume Verification</h1>
                            <p className="text-slate-400">
                                {resumeStep === 'email'
                                    ? 'Enter email to receive a new code'
                                    : `Enter code sent to ${resumeEmail}`}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {resumeStep === 'email' ? (
                                <AnimatedInput
                                    type="email"
                                    placeholder="Enter your email"
                                    value={resumeEmail}
                                    onChange={(e) => setResumeEmail(e.target.value)}
                                    icon={Mail}
                                    autoFocus
                                />
                            ) : (
                                <AnimatedInput
                                    type="text"
                                    placeholder="Enter 6-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    icon={KeyRound}
                                    maxLength={6}
                                    autoFocus
                                />
                            )}

                            <ActionButton
                                onClick={resumeStep === 'email' ? handleResumeSubmit : handleVerifyResume}
                                loading={loading}
                            >
                                {resumeStep === 'email' ? 'Send Code' : 'Verify & Login'}
                            </ActionButton>

                            <button
                                onClick={() => {
                                    setView('login');
                                    setResumeStep('email');
                                    setOtp('');
                                }}
                                className="w-full text-slate-400 text-sm hover:text-white mt-4"
                            >
                                Back to Login
                            </button>
                        </div>
                    </>
                )}

                <div className="mt-10 pt-6 border-t border-slate-800 text-center">
                    <p className="text-slate-400">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-amber-500 font-bold hover:underline">
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

// Register Page with Steps & Strength Meter
export const RegisterPage = () => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [referral, setReferral] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { handleLoginSuccess } = useAuth(); // Destructure handleLoginSuccess
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) setReferral(ref);
    }, [searchParams]);

    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleNameSubmit = () => {
        if (name.trim().length < 2) {
            addToast('error', 'Please enter your name');
            return;
        }
        setStep(2);
    };

    const handleEmailSubmit = () => {
        if (!validateEmail(email)) {
            addToast('error', 'Please enter a valid email');
            return;
        }
        setStep(3);
    };

    const handlePasswordSubmit = () => {
        if (password.length < 6) {
            addToast('error', 'Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPass) {
            addToast('error', 'Passwords do not match');
            return;
        }
        setStep(4);
    };

    const handleRegister = async () => {
        setLoading(true);
        try {
            const response = await authApi.register(email, password, name, referral || undefined);
            if (response.data.requiresOTP) {
                addToast('success', 'OTP sent to your email');
                setStep(5);
            }
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleOTPSubmit = async () => {
        if (otp.length !== 6) {
            addToast('error', 'Please enter a 6-digit OTP');
            return;
        }
        setLoading(true);
        try {
            const response = await authApi.verifyOTP(email, otp);
            await handleLoginSuccess(response.data.token);
            addToast('success', 'Account verified successfully!');
            navigate('/');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const stepTitles = [
        { title: 'Your Name', subtitle: 'Let\'s get to know you' },
        { title: 'Email Address', subtitle: 'We\'ll send a verification code' },
        { title: 'Create Password', subtitle: 'Keep your account secure' },
        { title: 'Referral Code', subtitle: 'Optional - Enter if you have one' },
        { title: 'Verify Email', subtitle: 'Enter the code we sent' }
    ];

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950" />
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-amber-500/10 blur-[120px] rounded-full" />

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-6 transform rotate-3 hover:rotate-0 transition-transform">
                        <Box size={48} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">{stepTitles[step - 1].title}</h1>
                    <p className="text-slate-400">{stepTitles[step - 1].subtitle}</p>
                </div>

                <StepIndicator current={step - 1} total={5} />

                <div className="space-y-4">
                    {step === 1 && (
                        <>
                            <AnimatedInput
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                icon={User}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                            />
                            <ActionButton onClick={handleNameSubmit} disabled={!name.trim()}>
                                Continue <ArrowRight size={20} />
                            </ActionButton>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <AnimatedInput
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={Mail}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                            />
                            <ActionButton onClick={handleEmailSubmit} disabled={!email}>
                                Continue <ArrowRight size={20} />
                            </ActionButton>
                            <button onClick={() => setStep(1)} className="w-full text-center text-slate-500 hover:text-white text-sm py-2">
                                <ArrowLeft size={16} className="inline mr-1" /> Back
                            </button>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <AnimatedInput
                                type="password"
                                placeholder="Password (min 6 characters)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={Lock}
                                autoFocus
                            />
                            <PasswordStrengthMeter password={password} />
                            <AnimatedInput
                                type="password"
                                placeholder="Confirm Password"
                                value={confirmPass}
                                onChange={(e) => setConfirmPass(e.target.value)}
                                icon={Lock}
                                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                            />
                            <ActionButton onClick={handlePasswordSubmit} disabled={!password || !confirmPass}>
                                Continue <ArrowRight size={20} />
                            </ActionButton>
                            <button onClick={() => setStep(2)} className="w-full text-center text-slate-500 hover:text-white text-sm py-2">
                                <ArrowLeft size={16} className="inline mr-1" /> Back
                            </button>
                        </>
                    )}

                    {step === 4 && (
                        <>
                            <AnimatedInput
                                placeholder="Referral Code (Optional)"
                                value={referral}
                                onChange={(e) => setReferral(e.target.value.toUpperCase())}
                                icon={Users}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                            />
                            <ActionButton onClick={handleRegister} loading={loading}>
                                {loading ? 'Creating Account...' : 'Create Account'}
                            </ActionButton>
                            <button onClick={() => setStep(3)} className="w-full text-center text-slate-500 hover:text-white text-sm py-2">
                                <ArrowLeft size={16} className="inline mr-1" /> Back
                            </button>
                        </>
                    )}

                    {step === 5 && (
                        <>
                            <div className="text-center mb-4">
                                <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="text-emerald-500" size={32} />
                                </div>
                                <p className="text-slate-400">Enter the 6-digit code sent to</p>
                                <p className="text-white font-medium">{email}</p>
                            </div>
                            <AnimatedInput
                                type="text"
                                placeholder="000000"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                icon={KeyRound}
                                autoFocus
                                maxLength={6}
                                onKeyDown={(e) => e.key === 'Enter' && handleOTPSubmit()}
                            />
                            <ActionButton onClick={handleOTPSubmit} loading={loading} disabled={otp.length !== 6}>
                                {loading ? 'Verifying...' : 'Verify & Continue'}
                            </ActionButton>
                        </>
                    )}
                </div>

                <div className="mt-10 pt-6 border-t border-slate-800 text-center">
                    <p className="text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-amber-500 font-bold hover:underline">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

// Forgot Password Page
export const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { addToast } = useToast();

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await authApi.forgotPassword(email);
            setSent(true);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8">
                    <ArrowLeft size={20} /> Back to login
                </Link>

                {sent ? (
                    <div className="text-center animate-fade-in">
                        <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                            <Mail className="text-emerald-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
                        <p className="text-slate-400">We've sent a password reset link to <span className="text-white">{email}</span></p>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-white mb-2">Forgot Password?</h1>
                        <p className="text-slate-400 mb-6">Enter your email and we'll send you a reset link.</p>
                        <div className="space-y-4">
                            <AnimatedInput
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={Mail}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            />
                            <ActionButton onClick={handleSubmit} loading={loading} disabled={!email}>
                                Send Reset Link
                            </ActionButton>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Reset Password Page
export const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const handleSubmit = async () => {
        if (password !== confirmPass) {
            addToast('error', 'Passwords do not match');
            return;
        }
        if (!token) {
            addToast('error', 'Invalid reset link');
            return;
        }
        setLoading(true);
        try {
            await authApi.resetPassword(token, password);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 2000);
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Reset failed');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
                <div className="text-center animate-fade-in">
                    <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle className="text-emerald-500" size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Password Reset!</h1>
                    <p className="text-slate-400">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                <h1 className="text-2xl font-bold text-white mb-2">Create New Password</h1>
                <p className="text-slate-400 mb-6">Enter your new password below.</p>
                <div className="space-y-4">
                    <AnimatedInput
                        type="password"
                        placeholder="New Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={Lock}
                        autoFocus
                    />
                    <AnimatedInput
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        icon={Lock}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                    <ActionButton onClick={handleSubmit} loading={loading} disabled={!password || !confirmPass}>
                        Reset Password
                    </ActionButton>
                </div>
            </div>
        </div>
    );
};

// Verify Email Page (from link)
export const VerifyEmailPage = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus('error');
                return;
            }
            try {
                await authApi.verifyEmail(token);
                setStatus('success');
                setTimeout(() => navigate('/login'), 3000);
            } catch {
                setStatus('error');
            }
        };
        verify();
    }, [token, navigate]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
            <div className="text-center animate-fade-in">
                {status === 'loading' && (
                    <>
                        <Loader2 className="w-12 h-12 mx-auto text-amber-500 animate-spin mb-4" />
                        <h1 className="text-xl font-bold text-white">Verifying your email...</h1>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle className="text-emerald-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
                        <p className="text-slate-400">Redirecting to login...</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                            <Mail className="text-red-500" size={40} />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
                        <p className="text-slate-400 mb-4">The link may be expired or invalid.</p>
                        <Link to="/login" className="text-amber-500 hover:underline">Go to Login</Link>
                    </>
                )}
            </div>
        </div>
    );
};
