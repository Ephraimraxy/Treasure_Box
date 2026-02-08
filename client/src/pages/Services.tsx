import React from 'react';
import { Smartphone, Wifi, Zap, Tv, ArrowRightLeft } from 'lucide-react';
import { Card } from '../components/ui';
import { useToast } from '../contexts/ToastContext';

const services = [
    { id: 'airtime', name: 'Buy Airtime', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'data', name: 'Buy Data', icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'power', name: 'Electricity', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { id: 'cable', name: 'Cable TV', icon: Tv, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'airtime_cash', name: 'Airtime to Cash', icon: ArrowRightLeft, color: 'text-pink-400', bg: 'bg-pink-500/10' },
];

export const ServicesPage = () => {
    const { addToast } = useToast();

    const handleServiceClick = (serviceName: string) => {
        addToast('info', `${serviceName} service coming soon!`);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white">Other Services</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {services.map((service) => (
                    <button
                        key={service.id}
                        onClick={() => handleServiceClick(service.name)}
                        className="bg-slate-800 border border-slate-700 hover:border-slate-500 p-6 rounded-2xl flex flex-col items-center gap-3 transition-all active:scale-95"
                    >
                        <div className={`p-4 rounded-full ${service.bg} ${service.color}`}>
                            <service.icon size={32} />
                        </div>
                        <span className="font-bold text-white text-sm text-center">{service.name}</span>
                    </button>
                ))}
            </div>

            <Card className="bg-gradient-to-r from-amber-900/20 to-slate-800">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-amber-500/20 rounded-xl">
                        <Zap className="text-amber-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Quick & Easy Payments</h3>
                        <p className="text-sm text-slate-400">
                            Pay your utility bills directly from your wallet with instant confirmation.
                        </p>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-amber-500 mb-1">₦0</div>
                        <div className="text-xs text-slate-400">Transaction Fee</div>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-emerald-500 mb-1">Instant</div>
                        <div className="text-xs text-slate-400">Processing Time</div>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-blue-500 mb-1">24/7</div>
                        <div className="text-xs text-slate-400">Availability</div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
