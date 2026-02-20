import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Wifi, Zap, Tv, ArrowRightLeft, UserCheck, ShieldCheck, UserCog, Search, Edit, GraduationCap, BookOpen, ExternalLink, ChevronRight, Shield } from 'lucide-react';
import { userApi } from '../api';

const services = [
    { id: 'airtime', name: 'Buy Airtime', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Instant top-up' },
    { id: 'data', name: 'Buy Data', icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10', desc: 'All networks + Smile' },
    { id: 'airtime_cash', name: 'Airtime to Cash', icon: ArrowRightLeft, color: 'text-pink-400', bg: 'bg-pink-500/10', desc: 'Convert airtime' },
    { id: 'power', name: 'Electricity', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', desc: 'Prepaid & postpaid' },
    { id: 'cable', name: 'Cable TV', icon: Tv, color: 'text-purple-400', bg: 'bg-purple-500/10', desc: 'DStv, GOtv, Star' },
    { id: 'insurance', name: 'Insurance', icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10', desc: 'Motor, Health, Home' },
    { id: 'nin_validation', name: 'NIN Validation', icon: UserCheck, color: 'text-orange-400', bg: 'bg-orange-500/10', desc: 'Verify NIN' },
    { id: 'nin_modification', name: 'NIN Modification', icon: Edit, color: 'text-orange-400', bg: 'bg-orange-500/10', desc: 'Update NIN' },
    { id: 'nin_personalization', name: 'NIN Personalization', icon: UserCog, color: 'text-orange-400', bg: 'bg-orange-500/10', desc: 'Biometric update' },
    { id: 'bvn_validation', name: 'BVN Validation', icon: ShieldCheck, color: 'text-teal-400', bg: 'bg-teal-500/10', desc: 'Verify BVN' },
    { id: 'bvn_modification', name: 'BVN Modification', icon: Edit, color: 'text-teal-400', bg: 'bg-teal-500/10', desc: 'Modify BVN' },
    { id: 'bvn_retrieval', name: 'BVN Retrieval', icon: Search, color: 'text-teal-400', bg: 'bg-teal-500/10', desc: 'Find your BVN' },
];

type CategoryDef = { title: string; icon: any; iconColor: string; ids: string[] };

const categories: CategoryDef[] = [
    { title: 'Telecommunication', icon: Smartphone, iconColor: 'text-blue-400', ids: ['airtime', 'data', 'airtime_cash'] },
    { title: 'Utilities', icon: Zap, iconColor: 'text-yellow-400', ids: ['power', 'cable'] },
    { title: 'Insurance & Protection', icon: Shield, iconColor: 'text-red-400', ids: ['insurance'] },
    { title: 'Identity Management', icon: ShieldCheck, iconColor: 'text-emerald-400', ids: ['nin_validation', 'nin_modification', 'nin_personalization', 'bvn_validation', 'bvn_modification', 'bvn_retrieval'] },
];

export const ServicesPage = () => {
    const navigate = useNavigate();
    const [enableAirtimeToCash, setEnableAirtimeToCash] = useState(true);

    useEffect(() => {
        userApi.getSettings().then(res => {
            setEnableAirtimeToCash(res.data.enableAirtimeToCash ?? true);
        }).catch(() => { });
    }, []);

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {/* ─── Hero / Header ─── */}
            <div className="relative overflow-hidden rounded-3xl bg-card border border-border p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <h1 className="text-3xl font-bold text-foreground mb-2 relative z-10">Services Hub</h1>
                <p className="text-muted max-w-lg relative z-10">
                    Access all your essential services in one place. Fast, secure, and reliable transactions.
                </p>
            </div>

            {/* ─── Research Services Promo ─── */}
            <div
                onClick={() => navigate('/research-services')}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/50 to-surface border border-indigo-500/30 cursor-pointer transition-all hover:scale-[1.01] hover:border-indigo-500/50"
            >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <GraduationCap size={120} />
                </div>
                <div className="p-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-4 border border-indigo-500/30">
                        <BookOpen size={12} /> ACADEMIC SUPPORT
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Research & Academic Services</h2>
                    <p className="text-muted max-w-xl mb-6">
                        Professional support for students, researchers, and institutions.
                    </p>
                    <div className="flex items-center gap-2 text-indigo-400 font-bold group-hover:text-indigo-300 transition-colors">
                        Explore Research Services <ExternalLink size={16} />
                    </div>
                </div>
            </div>

            {/* ─── Service Categories ─── */}
            {categories.map(cat => {
                const CatIcon = cat.icon;
                const catServices = services.filter(s => cat.ids.includes(s.id)).filter(s => s.id !== 'airtime_cash' || enableAirtimeToCash);
                return (
                    <div key={cat.title} className="space-y-4">
                        <h3 className="text-lg font-bold text-muted flex items-center gap-2">
                            <CatIcon size={20} className={cat.iconColor} />
                            {cat.title}
                        </h3>
                        <div className="space-y-2">
                            {catServices.map(service => {
                                const Icon = service.icon;
                                return (
                                    <button
                                        key={service.id}
                                        onClick={() => navigate(`/services/payment/${service.id}`)}
                                        className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/40 hover:bg-surface-highlight transition-all group active:scale-[0.98]"
                                    >
                                        <div className={`p-3 rounded-xl ${service.bg} ${service.color} group-hover:scale-110 transition-transform shrink-0`}>
                                            <Icon size={22} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="font-bold text-foreground text-sm">{service.name}</div>
                                            <div className="text-xs text-muted">{service.desc}</div>
                                        </div>
                                        <ChevronRight size={18} className="text-muted group-hover:text-primary transition-colors" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
