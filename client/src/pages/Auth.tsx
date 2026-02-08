import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Mail, Lock, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button, Input } from '../components/ui';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
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

                <form onSubmit={handleSubmit} className="space-y-4">
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

export const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [referral, setReferral] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPass) {
            addToast('error', 'Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await register(email, password, referral || undefined);
            addToast('success', 'Account created successfully!');
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
