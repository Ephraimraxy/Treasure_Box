import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertTriangle, X } from 'lucide-react';

export const NetworkStatus = () => {
    const [status, setStatus] = useState<'online' | 'offline' | 'poor'>('online');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setStatus('online');
            setIsVisible(true);
            setTimeout(() => setIsVisible(false), 3000);
        };

        const handleOffline = () => {
            setStatus('offline');
            setIsVisible(true);
        };

        const updateConnectionStatus = () => {
            if (navigator.onLine) {
                // @ts-ignore - navigator.connection is widely supported but not in standard TS lib yet
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                if (connection) {
                    if (connection.saveData || connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
                        setStatus('poor');
                        setIsVisible(true);
                    } else {
                        if (status === 'poor') {
                            setStatus('online');
                            setTimeout(() => setIsVisible(false), 3000);
                        }
                    }
                }
            } else {
                setStatus('offline');
                setIsVisible(true);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        updateConnectionStatus();

        // Poll connection status occasionally if supported
        // @ts-ignore
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            connection.addEventListener('change', updateConnectionStatus);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (connection) {
                connection.removeEventListener('change', updateConnectionStatus);
            }
        };
    }, []);

    if (!isVisible) return null;

    const getConfig = () => {
        switch (status) {
            case 'offline':
                return {
                    bg: 'bg-red-500',
                    icon: <WifiOff size={18} className="text-white" />,
                    text: 'No Internet Connection',
                    subtext: 'Check your network settings.'
                };
            case 'poor':
                return {
                    bg: 'bg-amber-500',
                    icon: <AlertTriangle size={18} className="text-slate-900" />,
                    text: 'Slow Connection',
                    subtext: 'Values might take longer to update.',
                    textColor: 'text-slate-900'
                };
            case 'online':
                return {
                    bg: 'bg-emerald-500',
                    icon: <Wifi size={18} className="text-white" />,
                    text: 'Back Online',
                    subtext: 'Connection restored.'
                };
        }
    };

    const config = getConfig();

    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 w-[90%] max-w-sm`}>
            <div className={`${config.bg} rounded-xl shadow-lg p-3 flex items-center gap-3 pr-10 relative overflow-hidden`}>
                <div className="p-2 bg-white/20 rounded-full shrink-0">
                    {config.icon}
                </div>
                <div>
                    <h4 className={`text-sm font-bold ${config.textColor || 'text-white'}`}>{config.text}</h4>
                    {config.subtext && <p className={`text-xs ${config.textColor ? 'text-slate-800' : 'text-white/80'}`}>{config.subtext}</p>}
                </div>

                {status !== 'offline' && (
                    <button
                        onClick={() => setIsVisible(false)}
                        className="absolute right-2 top-2 p-1.5 hover:bg-black/10 rounded-full transition-colors"
                    >
                        <X size={14} className={config.textColor || 'text-white'} />
                    </button>
                )}

                {/* Ping animation for offline */}
                {status === 'offline' && (
                    <div className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </div>
                )}
            </div>
        </div>
    );
};
