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

    // Apply Theme
    React.useEffect(() => {
        if (user?.preferences?.theme) {
            const themes: Record<string, string> = {
                amber: '245 158 11',
                blue: '59 130 246',
                emerald: '16 185 129',
                rose: '244 63 94',
                purple: '168 85 247',
                cyan: '6 182 212',
            };
            const color = themes[user.preferences.theme] || themes.amber;
            document.documentElement.style.setProperty('--color-primary', color);
        }
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
            <NetworkStatus />
            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
// ... rest of file
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Box className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="font-bold text-white leading-none">Treasure<br />Box</h1>
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
                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`
                                }
                            >
                                <item.icon size={20} /> {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        {user?.kycPhotoUrl ? (
                            <img src={user.kycPhotoUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-slate-700" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                <User size={20} className="text-slate-400" />
                            </div>
                        )}
                        <div className="overflow-hidden">
                            <div className="text-sm font-bold text-white truncate">{user?.username || user?.name || user?.email}</div>
                            <div className="text-xs text-slate-500 capitalize">{user?.role?.toLowerCase()} Account</div>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-400 hover:bg-red-500/10">
                        <LogOut size={18} /> Sign Out
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Header */}
                <div className="h-12 border-b border-slate-800 flex items-center justify-between px-3 bg-slate-900/80 backdrop-blur-md z-20 shrink-0">
                    <div className="flex items-center gap-2 md:hidden">
                        {user?.kycPhotoUrl ? (
                            <img src={user.kycPhotoUrl} alt="Profile" className="w-7 h-7 rounded-full object-cover border border-amber-500" />
                        ) : (
                            <Box className="text-amber-500" size={24} />
                        )}
                        <span className="font-bold text-white">Treasure Box</span>
                    </div>

                    <div className="hidden md:block text-slate-400 text-sm font-medium">
                        Dashboard
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {user?.role === 'ADMIN' ? (
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-400 hover:bg-red-500/10 gap-2">
                                <LogOut size={16} /> <span className="hidden md:inline">Sign Out</span>
                            </Button>
                        ) : (
                            <>
                                <div
                                    className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 hover:border-amber-500 transition-colors cursor-pointer mr-2"
                                    onClick={() => navigate('/dispute')}
                                    title="Report Issue"
                                >
                                    <AlertCircle size={20} className="text-rose-500" />
                                </div>
                                {user?.photoUrl || user?.kycPhotoUrl ? (
                                    <img
                                        src={user.photoUrl || user.kycPhotoUrl}
                                        alt="Profile"
                                        className="w-9 h-9 rounded-full object-cover border border-slate-700 hover:border-amber-500 transition-colors cursor-pointer"
                                        onClick={() => navigate('/profile')}
                                    />
                                ) : (
                                    <div
                                        className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 hover:border-amber-500 transition-colors cursor-pointer"
                                        onClick={() => navigate('/profile')}
                                    >
                                        <User size={20} className="text-slate-400" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-20 md:pb-6 relative scroll-smooth">
                    <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none z-0" />
                    <div className="relative z-10 max-w-5xl mx-auto">
                        {children}
                    </div>
                </main>

                {/* Mobile Bottom Nav */}
                <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 pb-safe z-30">
                    <div className={`flex items-center py-2 px-2 no-scrollbar ${user?.role === 'ADMIN' ? 'overflow-x-auto gap-3' : 'justify-around'}`}>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/' || item.to === '/admin'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center min-w-[48px] p-2 rounded-lg shrink-0 transition-colors ${isActive ? 'text-amber-500' : 'text-slate-500'}`
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
