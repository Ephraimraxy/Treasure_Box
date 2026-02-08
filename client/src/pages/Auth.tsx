import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Mail, Lock, Users, User, ArrowLeft, KeyRound, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { authApi } from '../api';
import { Button, Input, Spinner } from '../components/ui';

// Login Page
export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'password' | 'otp'>('password');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const { login } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOTP = async () => {
        if (!email) {
            addToast('error', 'Please enter your email');
            return;
        }
        setLoading(true);
        try {
            await authApi.requestOTP(email);
            setOtpSent(true);
            addToast('success', 'OTP sent to your email');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleOTPLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await authApi.verifyOTP(email, otp);
            localStorage.setItem('token', response.data.token);
            window.location.href = '/';
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full" />

            <div className="w-full max-w-sm relative z-10 animate-fade-in">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-6 rotate-3">
                        <Box size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                    <p className="text-slate-400">Secure Access Portal</p>
                </div>

                {/* Login Mode Tabs */}
                <div className="flex gap-2 mb-6 bg-slate-900 p-1 rounded-xl">
                    <button
                        onClick={() => { setMode('password'); setOtpSent(false); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'password' ? 'bg-amber-500 text-slate-900' : 'text-slate-400'}`}
                    >
                        Password
                    </button>
                    <button
                        onClick={() => setMode('otp')}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'otp' ? 'bg-amber-500 text-slate-900' : 'text-slate-400'}`}
                    >
                        OTP Login
                    </button>
                </div>

                {mode === 'password' ? (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                        <Input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<Mail size={18} />}
                        />
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            icon={<Lock size={18} />}
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleOTPLogin} className="space-y-4">
                        <Input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<Mail size={18} />}
                            disabled={otpSent}
                        />
                        {otpSent ? (
                            <>
                                <Input
                                    type="text"
                                    placeholder="Enter 6-digit OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    icon={<KeyRound size={18} />}
                                    maxLength={6}
                                />
                                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                                    {loading ? 'Verifying...' : 'Verify & Login'}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setOtpSent(false)}
                                    className="w-full text-sm text-slate-400 hover:text-white"
                                >
                                    Change email
                                </button>
                            </>
                        ) : (
                            <Button type="button" onClick={handleRequestOTP} className="w-full" disabled={loading}>
                                {loading ? 'Sending...' : 'Send OTP'}
                            </Button>
                        )}
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-3">
                    <Link to="/forgot-password" className="text-sm text-slate-500 hover:text-amber-500 transition-colors block">
                        Forgot Password?
                    </Link>
                    <div className="text-sm text-slate-400">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-white font-bold hover:underline">
                            Sign Up
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Register Page
export const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [referral, setReferral] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) setReferral(ref);
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPass) {
            addToast('error', 'Passwords do not match');
            return;
        }
        if (password.length < 6) {
            addToast('error', 'Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        try {
            await register(email, password, referral || undefined);
            addToast('success', 'Account created! Check your email to verify.');
            navigate('/');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full" />

            <div className="w-full max-w-sm relative z-10 animate-fade-in">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-6 rotate-3">
                        <Box size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Join Treasure Box</h1>
                    <p className="text-slate-400">Start your investment journey</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        icon={<User size={18} />}
                    />
                    <Input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        icon={<Mail size={18} />}
                    />
                    <Input
                        type="password"
                        placeholder="Password (min 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock size={18} />}
                    />
                    <Input
                        type="password"
                        placeholder="Confirm Password"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        icon={<Lock size={18} />}
                    />
                    <Input
                        placeholder="Referral Code (Optional)"
                        value={referral}
                        onChange={(e) => setReferral(e.target.value)}
                        icon={<Users size={18} />}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                    <div className="text-sm text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-white font-bold hover:underline">
                            Sign In
                        </Link>
                    </div>
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await authApi.forgotPassword(email);
            setSent(true);
            addToast('success', 'If account exists, reset email has been sent');
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm animate-fade-in">
                <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8">
                    <ArrowLeft size={20} /> Back to login
                </Link>

                {sent ? (
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                            <Mail className="text-emerald-500" size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
                        <p className="text-slate-400">We've sent a password reset link to <span className="text-white">{email}</span></p>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-white mb-2">Forgot Password?</h1>
                        <p className="text-slate-400 mb-6">Enter your email and we'll send you a reset link.</p>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={<Mail size={18} />}
                            />
                            <Button type="submit" className="w-full" disabled={loading || !email}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </Button>
                        </form>
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
            addToast('success', 'Password reset successful');
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
                    <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="text-emerald-500" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Password Reset!</h1>
                    <p className="text-slate-400">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm animate-fade-in">
                <h1 className="text-2xl font-bold text-white mb-2">Create New Password</h1>
                <p className="text-slate-400 mb-6">Enter your new password below.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        type="password"
                        placeholder="New Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock size={18} />}
                    />
                    <Input
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        icon={<Lock size={18} />}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

// Verify Email Page
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
                setTimeout(() => navigate('/'), 3000);
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
                        <Spinner className="mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-white">Verifying your email...</h1>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="text-emerald-500" size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
                        <p className="text-slate-400">Redirecting to dashboard...</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                            <Mail className="text-red-500" size={32} />
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
