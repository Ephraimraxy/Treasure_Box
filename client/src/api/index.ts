import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    register: (email: string, password: string, name?: string, referralCode?: string) =>
        api.post('/auth/register', { email, password, name, referralCode }),
    verifyEmail: (token: string) =>
        api.get(`/auth/verify-email?token=${token}`),
    resendVerification: (email: string) =>
        api.post('/auth/resend-verification', { email }),
    requestOTP: (email: string) =>
        api.post('/auth/request-otp', { email }),
    verifyOTP: (email: string, otp: string) =>
        api.post('/auth/verify-otp', { email, otp }),
    resendOTP: (email: string) =>
        api.post('/auth/resend-otp', { email }),
    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
        api.post('/auth/reset-password', { token, password }),
};

// User API
export const userApi = {
    getProfile: () => api.get('/users/me'),
    updateProfile: (data: any) => api.patch('/users/me', data),
    updateBankDetails: (data: any) => api.put('/users/me/bank', data),
    getNotifications: () => api.get('/users/me/notifications'),
    markNotificationsRead: () => api.patch('/users/me/notifications/read'),
    submitKYC: (data: { photoUrl: string }) => api.post('/users/kyc', data),
    setPin: (pin: string, password: string) => api.post('/users/set-pin', { pin, password }),
    resetPin: (password: string, newPin: string) => api.post('/users/reset-pin', { password, newPin }),
    changePin: (oldPin: string, newPin: string) => api.post('/users/change-pin', { oldPin, newPin }),
    getReferrals: () => api.get('/users/referrals'),
    getSettings: () => api.get('/users/settings'),
};

// Transaction API
export const transactionApi = {
    getAll: () => api.get('/transactions'),
    deposit: (amount: number) => api.post('/transactions/deposit', { amount }),
    withdraw: (amount: number, pin: string) => api.post('/transactions/withdraw', { amount, pin }),
    payUtility: (data: any) => api.post('/transactions/utility', data),
};

// Investment API
export const investmentApi = {
    getAll: () => api.get('/investments'),
    create: (amount: number, durationDays: number, bonusRate?: number) =>
        api.post('/investments', { amount, durationDays, bonusRate }),
};

// Payment API (Paystack)
export const paymentApi = {
    initialize: (amount: number, purpose: 'deposit' | 'investment') =>
        api.post('/payments/initialize', { amount, purpose }),
    verify: (reference: string) =>
        api.get(`/payments/verify/${reference}`),
    getBanks: () =>
        api.get('/payments/banks'),
    verifyAccount: (accountNumber: string, bankCode: string) =>
        api.post('/payments/verify-account', { accountNumber, bankCode }),
    createVirtualAccount: () => api.post('/payments/virtual-account', {}),
};

// Admin API
export const adminApi = {
    getStats: () => api.get('/admin/stats'),
    getUsers: () => api.get('/admin/users'),
    getPendingWithdrawals: () => api.get('/admin/withdrawals/pending'),
    approveWithdrawal: (id: string) => api.post(`/admin/withdrawals/${id}/approve`),
    rejectWithdrawal: (id: string, reason: string) =>
        api.post(`/admin/withdrawals/${id}/reject`, { reason }),
    creditUser: (userId: string, amount: number, description?: string) =>
        api.post(`/admin/users/${userId}/credit`, { amount, description }),
    getAuditLogs: () => api.get('/admin/audit-logs'),
    getSettings: () => api.get('/admin/settings'),
    updateSettings: (data: any) => api.put('/admin/settings', data),
};

export default api;
