import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Box, BarChart3, Wallet, LayoutGrid, Users, History, User, Settings, FileClock, ArrowUpDown, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui';

const userNavItems = [
    { to: '/', icon: Box, label: 'Home' },
    { to: '/wallet', icon: Wallet, label: 'Wallet' },
    { to: '/services', icon: LayoutGrid, label: 'Services' },
    { to: '/referrals', icon: Users, label: 'Referrals' },
    { to: '/history', icon: History, label: 'Activity' },
    { to: '/profile', icon: User, label: 'Profile' },
];

const adminNavItems = [
    { to: '/admin', icon: BarChart3, label: 'Overview' },
    { to: '/admin/withdrawals', icon: ArrowUpDown, label: 'Approvals' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/settings', icon: Settings, label: 'System' },
    { to: '/admin/audit', icon: FileClock, label: 'Audit Logs' },
];

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const navItems = user?.role === 'ADMIN' ? adminNavItems : userNavItems;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
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
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                            <User size={20} className="text-slate-400" />
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-bold text-white truncate">{user?.email}</div>
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
                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/80 backdrop-blur-md z-20 shrink-0">
                    <div className="flex items-center gap-2 md:hidden">
                        <Box className="text-amber-500" size={24} />
                        <span className="font-bold text-white">Treasure Box</span>
                    </div>

                    <div className="hidden md:block text-slate-400 text-sm font-medium">
                        Dashboard
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        <button className="relative p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                            <Bell size={20} />
                        </button>
                        <Button variant="ghost" onClick={handleLogout} className="md:hidden p-2">
                            <LogOut size={20} />
                        </Button>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 relative scroll-smooth">
                    <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none z-0" />
                    <div className="relative z-10 max-w-5xl mx-auto">
                        {children}
                    </div>
                </main>

                {/* Mobile Bottom Nav */}
                <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 pb-safe z-30">
                    <div className="flex justify-around items-center p-2">
                        {navItems.slice(0, 5).map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/' || item.to === '/admin'}
                                className={({ isActive }) =>
                                    `flex flex-col items-center p-2 rounded-lg ${isActive ? 'text-amber-500' : 'text-slate-500'}`
                                }
                            >
                                <item.icon size={20} />
                                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
