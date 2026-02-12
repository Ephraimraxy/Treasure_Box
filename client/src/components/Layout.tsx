import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Brain, LayoutGrid, Users, History, User, Settings, FileClock, ArrowUpDown, LogOut, Bell, Box, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui';

const userNavItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/quiz', icon: Brain, label: 'Quiz' },
    { to: '/services', icon: LayoutGrid, label: 'Services' },
    { to: '/investments', icon: Box, label: 'Box' },
    { to: '/profile', icon: User, label: 'Profile' },
];

const adminNavItems = [
    { to: '/admin', icon: BarChart3, label: 'Overview' },
    { to: '/admin/quiz', icon: Brain, label: 'Quiz Games' },
    { to: '/admin/withdrawals', icon: ArrowUpDown, label: 'Approvals' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/settings', icon: Settings, label: 'System' },
    { to: '/admin/research', icon: Search, label: 'Research' },
    { to: '/admin/disputes', icon: AlertCircle, label: 'Disputes' },
    { to: '/admin/audit', icon: FileClock, label: 'Audit Logs' },
];

interface LayoutProps {
    children: React.ReactNode;
}

import { NetworkStatus } from './NetworkStatus';

// ... (imports remain the same)

export const Layout = ({ children }: LayoutProps) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const navItems = user?.role === 'ADMIN' ? adminNavItems : userNavItems;

    // Theme is handled globally by ThemeProvider

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            <NetworkStatus />
            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex w-64 flex-col border-r border-border bg-surface/50 backdrop-blur-xl">
// ... rest of file
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Box className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="font-bold text-foreground leading-none">Treasure<br />Box</h1>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/' || item.to === '/admin'}
                                className={({ isActive }) =>
                                    `w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${isActive
                                        ? 'bg-primary/10 text-primary border border-primary/20'
                                        : 'text-muted hover:text-foreground hover:bg-surface-highlight'
                                    }`
                                }
                            >
                                <item.icon size={20} /> {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-border">
                    <div className="flex items-center gap-3 mb-4">
                        {user?.kycPhotoUrl ? (
                            <img src={user.kycPhotoUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-border" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-surface-highlight flex items-center justify-center border border-border">
                                <User size={20} className="text-muted" />
                            </div>
                        )}
                        <div className="overflow-hidden">
                            <div className="text-sm font-bold text-foreground truncate">{user?.username || user?.name || user?.email}</div>
                            <div className="text-xs text-muted capitalize">{user?.role?.toLowerCase()} Account</div>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-500 hover:bg-red-500/10">
                        <LogOut size={18} /> Sign Out
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <div className="h-12 border-b border-border flex items-center justify-between px-3 bg-surface/80 backdrop-blur-md z-20 shrink-0">
                    <div className="flex items-center gap-2 md:hidden">
                        {user?.kycPhotoUrl ? (
                            <img src={user.kycPhotoUrl} alt="Profile" className="w-7 h-7 rounded-full object-cover border border-primary" />
                        ) : (
                            <Box className="text-primary" size={24} />
                        )}
                        <span className="font-bold text-foreground">Treasure Box</span>
                    </div>

                    <div className="hidden md:block text-muted text-sm font-medium">
                        Dashboard
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {user?.role === 'ADMIN' ? (
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:bg-red-500/10 gap-2">
                                <LogOut size={16} /> <span className="hidden md:inline">Sign Out</span>
                            </Button>
                        ) : (
                            <>
                                <div
                                    className="w-9 h-9 rounded-full bg-surface-highlight flex items-center justify-center border border-border hover:border-primary transition-colors cursor-pointer mr-2"
                                    onClick={() => navigate('/dispute')}
                                    title="Report Issue"
                                >
                                    <AlertCircle size={20} className="text-rose-500" />
                                </div>
                                {user?.photoUrl || user?.kycPhotoUrl ? (
                                    <img
                                        src={user.photoUrl || user.kycPhotoUrl}
                                        alt="Profile"
                                        className="w-9 h-9 rounded-full object-cover border border-border hover:border-primary transition-colors cursor-pointer"
                                        onClick={() => navigate('/profile')}
                                    />
                                ) : (
                                    <div
                                        className="w-9 h-9 rounded-full bg-surface-highlight flex items-center justify-center border border-border hover:border-primary transition-colors cursor-pointer"
                                        onClick={() => navigate('/profile')}
                                    >
                                        <User size={20} className="text-muted" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-20 md:pb-6 relative scroll-smooth">
                    <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-500/5 to-transparent dark:from-blue-900/10 pointer-events-none z-0" />
                    <div className="relative z-10 max-w-5xl mx-auto">
                        {children}
                    </div>
                </main>

                {/* Mobile Bottom Nav */}
                <div className="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-border pb-safe z-30">
                    <div className={`flex items-center py-2 px-2 no-scrollbar ${user?.role === 'ADMIN' ? 'overflow-x-auto gap-3' : 'justify-around'}`}>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/' || item.to === '/admin'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center min-w-[48px] p-2 rounded-lg shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted'}`
                                }
                            >
                                <item.icon size={20} />
                                <span className="text-[10px] mt-1 font-medium whitespace-nowrap">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
