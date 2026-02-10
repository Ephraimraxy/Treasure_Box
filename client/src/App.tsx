import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ToastContainer, Spinner } from './components/ui';
import { Layout } from './components/Layout';
import { SplashScreen } from './components/SplashScreen';

// Pages
import {
    LoginPage,
    RegisterPage,
    ForgotPasswordPage,
    ResetPasswordPage,
    VerifyEmailPage
} from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { QuizPage } from './pages/Quiz';
import { HistoryPage } from './pages/History';
import { ReferralsPage } from './pages/Referrals';
import { ServicesPage } from './pages/Services';
import { ResearchServicesPage } from './pages/ResearchServices';
import { ProfilePage } from './pages/Profile';
import {
    AdminDashboardPage,
    AdminWithdrawalsPage,
    AdminUsersPage,
    AdminAuditPage,
    AdminSettingsPage
} from './pages/Admin';
import { KYCPage } from './pages/KYC';


// Styles
import './index.css';

// Protected Route Component
import { useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    // Redirect Admin from User Dashboard to Admin Dashboard
    if (user.role === 'ADMIN' && location.pathname === '/') {
        return <Navigate to="/admin" replace />;
    }

    return <Layout>{children}</Layout>;
};

// App Content with Toast
const AppContent = () => {
    const { toasts } = useToast();

    return (
        <>
            <ToastContainer toasts={toasts} />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                {/* User Routes */}
                <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
                <Route path="/research-services" element={<ProtectedRoute><ResearchServicesPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/kyc" element={<ProtectedRoute><KYCPage /></ProtectedRoute>} />

                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/withdrawals" element={<ProtectedRoute adminOnly><AdminWithdrawalsPage /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsersPage /></ProtectedRoute>} />
                <Route path="/admin/audit" element={<ProtectedRoute adminOnly><AdminAuditPage /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettingsPage /></ProtectedRoute>} />

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    );
};

// Main App with Splash Screen
const App = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [isFirstVisit, setIsFirstVisit] = useState(true);

    // Always show splash on mount
    useEffect(() => {
        // Ensure splash runs on refresh 
        setShowSplash(true);
    }, []);

    const handleSplashComplete = () => {
        setShowSplash(false);
    };

    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    {showSplash ? (
                        <SplashScreen onComplete={handleSplashComplete} />
                    ) : (
                        <AppContent />
                    )}
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
};

// Mount
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
