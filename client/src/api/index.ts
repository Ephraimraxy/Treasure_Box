import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    register: (email: string, password: string, referralCode?: string) =>
        api.post('/auth/register', { email, password, referralCode }),
};

// User API
export const userApi = {
    getProfile: () => api.get('/users/me'),
    updateProfile: (data: any) => api.patch('/users/me', data),
    updateBankDetails: (data: any) => api.put('/users/me/bank', data),
    getNotifications: () => api.get('/users/me/notifications'),
    markNotificationsRead: () => api.patch('/users/me/notifications/read'),
};

// Transaction API
export const transactionApi = {
    getAll: () => api.get('/transactions'),
    deposit: (amount: number) => api.post('/transactions/deposit', { amount }),
    withdraw: (amount: number) => api.post('/transactions/withdraw', { amount }),
    payUtility: (data: any) => api.post('/transactions/utility', data),
};

// Investment API
export const investmentApi = {
    getAll: () => api.get('/investments'),
    create: (amount: number, durationDays: number, bonusRate?: number) =>
        api.post('/investments', { amount, durationDays, bonusRate }),
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
};

export default api;
