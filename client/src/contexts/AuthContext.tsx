import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, userApi } from '../api';

interface User {
    id: string;
    email: string;
    name?: string;
    username?: string;
    bvn?: string;
    nin?: string;
    role: 'USER' | 'ADMIN';
    balance: number;
    referralCode: string;
    kycVerified: boolean;
    kycStatus?: 'PENDING' | 'VERIFIED' | 'FAILED';
    kycPhotoUrl?: string;
    transactionPin?: boolean;
    isSuspended?: boolean;
    suspensionReason?: string;
    virtualAccount?: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };
    _count?: {
        referrals: number;
    };
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<any>;
    register: (email: string, password: string, referralCode?: string) => Promise<any>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    handleLoginSuccess: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

    const fetchUser = async (currentToken?: string) => {
        const tokenToUse = currentToken || token;
        if (!tokenToUse) {
            setIsLoading(false);
            return null;
        }
        try {
            // No need to set isLoading(true) here if called from effect, 
            // but if called manually we might want to. 
            // For now, assume effect handles initial load, manual calls handle their own.

            // Note: userApi.getProfile() likely uses the token from localStorage or interceptor.
            // Ensure interceptor is using the latest token.
            const response = await userApi.getProfile();
            setUser(response.data);
            return response.data;
        } catch {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, [token]);

    const login = async (email: string, password: string) => {
        const response = await authApi.login(email, password);
        // Don't just set token, handle the full flow
        if (response.data.token) {
            await handleLoginSuccess(response.data.token);
        }
        return response;
    };

    const register = async (email: string, password: string, referralCode?: string) => {
        const response = await authApi.register(email, password, undefined, referralCode);
        if (response.data.token) {
            await handleLoginSuccess(response.data.token);
        }
        return response;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    const refreshUser = async () => {
        await fetchUser();
    };

    const handleLoginSuccess = async (newToken: string) => {
        setIsLoading(true);
        localStorage.setItem('token', newToken);
        setToken(newToken);
        // Explicitly fetch user with the new token to ensure state is ready
        // We know token is set in state, but fetchUser relies on 'token' state or param?
        // Let's pass the token explicitly to fetchUser or rely on local storage being updated for axios interceptors
        await fetchUser(newToken);
        setIsLoading(false);
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser, handleLoginSuccess }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
