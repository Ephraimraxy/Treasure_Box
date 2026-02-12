import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { authApi, userApi } from '../api';

interface User {
    id: string;
    email: string;
    name?: string;
    username?: string;
    phone?: string;
    address?: string;
    bvn?: string;
    nin?: string;
    role: 'USER' | 'ADMIN';
    balance: number;
    referralCode: string;
    referralEarnings: number;
    kycVerified: boolean;
    kycStatus?: 'PENDING' | 'VERIFIED' | 'FAILED';
    kycPhotoUrl?: string;
    photoUrl?: string;
    transactionPin?: boolean;
    isSuspended?: boolean;
    suspensionReason?: string;
    virtualAccount?: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };
    bankDetails?: {
        id: string;
        bankName: string;
        accountNumber: string;
        accountName: string;
    }[];
    notificationSettings?: {
        fund?: boolean;
        game?: boolean;
        investment?: boolean;
        login?: boolean;
        push?: boolean;
    };
    preferences?: {
        theme?: string;
        notifications?: any;
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
            // Explicitly set header if token provided, to ensure immediate availability
            if (currentToken) {
                api.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
            }

            const response = await userApi.getProfile();
            setUser(response.data);
            return response.data;
        } catch (error: any) {
            console.error('Fetch user failed:', error);
            // Only clear auth on 401/403, otherwise keep token (could be network error)
            if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
                delete api.defaults.headers.common['Authorization'];
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchUser(token);
        } else {
            setIsLoading(false);
        }
    }, [token]);

    const login = async (email: string, password: string) => {
        const response = await authApi.login(email, password);
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
        delete api.defaults.headers.common['Authorization'];
    };

    const refreshUser = async () => {
        await fetchUser();
    };

    const handleLoginSuccess = async (newToken: string) => {
        setIsLoading(true);
        localStorage.setItem('token', newToken);
        setToken(newToken);

        // Force update axios header immediately
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

        await fetchUser(newToken);
        setIsLoading(false);
    };

    // Theme logic moved to ThemeContext

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
