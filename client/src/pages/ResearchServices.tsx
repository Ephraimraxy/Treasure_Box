import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    GraduationCap, BookOpen, Scroll, Building2, FileText, CheckCircle,
    ChevronDown, ChevronUp, Upload, Shield, AlertCircle, Loader2, History, Plus, ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { researchApi } from '../api';
import { Button, Input, Card } from '../components/ui';

// --- Constants & Data ---

const ROLES = [
    { id: 'STUDENT', label: 'Student', icon: GraduationCap, desc: 'Undergraduate, MSc, PhD' },
    { id: 'ACADEMIC', label: 'Academic', icon: BookOpen, desc: 'Lecturer, Professor' },
    { id: 'RESEARCHER', label: 'Researcher', icon: Scroll, desc: 'Independent Professional' },
    { id: 'INSTITUTION', label: 'Institution', icon: Building2, desc: 'University, NGO, Govt' }
];

const SERVICE_CATEGORIES = [
    {
        id: 'writing',
        title: 'Academic Writing & Research Support',
        services: [
            'Research topic development',
            'Project/Thesis structuring',
            'Proposal writing',
            'Literature review',
            'Methodology design',
            'Chapter editing'
        ]
    },
    {
        id: 'analysis',
        title: 'Data Analysis & Interpretation',
        services: [
            'Quantitative analysis',
            'Qualitative analysis',
            'Statistical analysis (SPSS, R, Python)',
            'Survey design',
            'Data visualization'
        ]
    },
    {
        id: 'innovation',
        title: 'Research & Innovation Services',
        services: [
            'Concept note development',
            'Grant proposal support',
            'Policy research',
            'Feasibility studies'
        ]
    },
    {
        id: 'publishing',
        title: 'Review, Editing & Publishing',
        services: [
            'Plagiarism assessment',
            'Journal formatting',
            'Citation management',
            'Manuscript review'
        ]
    },
    {
        id: 'institutional',
        title: 'Institutional & Organizational',
        services: [
            'Institutional research projects',
            'Monitoring & Evaluation (M&E)',
            'Impact assessment',
            'Technical reports'
        ]
    }
];

export const ResearchServicesPage = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // -- State --
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [step, setStep] = useState<'role' | 'form' | 'success'>('role');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>('writing');
    const [loading, setLoading] = useState(false);
    const [myRequests, setMyRequests] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        institution: '',
        serviceCategory: '',
        specificService: '',
        researchLevel: 'Undergraduate',
        discipline: '',
        description: '',
        preferredDate: '',
        urgency: 'Normal',
        attachmentUrl: '',
        consent: false
    });

    // -- Handlers --

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await researchApi.getRequests();
            setMyRequests(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleRoleSelect = (roleId: string) => {
        setSelectedRole(roleId);
        setStep('form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleCategory = (id: string) => {
        setExpandedCategory(expandedCategory === id ? null : id);
    };

    const handleServiceSelect = (categoryTitle: string, service: string) => {
        setFormData({ ...formData, serviceCategory: categoryTitle, specificService: service });
        // Scroll to form if needed, or just highlight
    };

    const handleSubmit = async () => {
        if (!formData.consent) {
            addToast('error', 'You must agree to the ethical standards.');
            return;
        }
        if (!formData.serviceCategory || !formData.specificService || !formData.discipline || !formData.description) {
            addToast('error', 'Please fill all required fields.');
            return;
        }

        setLoading(true);
        try {
            await researchApi.submitRequest({
                role: selectedRole,
                ...formData
            });
            setStep('success');
            fetchHistory(); // Refresh history
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error: any) {
            addToast('error', error.response?.data?.error || 'Submission failed');
        } finally {
            setLoading(false);
        }
    };

    // -- Renderers --

    const renderHero = () => (
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 mb-8 p-1">
            <div className="flex gap-1">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl transition-all ${activeTab === 'new' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                    <Plus size={20} />
                    <span className="font-bold">New Request</span>
                </button>
                <button
                    onClick={() => {
                        setActiveTab('history');
                        fetchHistory();
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                    <History size={20} />
                    <span className="font-bold">My Requests</span>
                </button>
            </div>
        </div>
    );

    const renderRoleSelection = () => (
        <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-6 text-center">Select Your Role to Get Started</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROLES.map((role) => (
                    <button
                        key={role.id}
                        onClick={() => handleRoleSelect(role.id)}
                        className="group p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-800 transition-all text-left relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-indigo-400">
                            <role.icon size={24} />
                        </div>
                        <h3 className="font-bold text-white text-lg mb-1">{role.label}</h3>
                        <p className="text-sm text-slate-400">{role.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderCatalogue = () => (
        <Card className="mb-8 border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 mb-6">
                <BookOpen className="text-indigo-400" size={24} />
                <h2 className="text-xl font-bold text-white">Service Catalogue</h2>
            </div>
            <div className="space-y-3">
                {SERVICE_CATEGORIES.map((cat) => (
                    <div key={cat.id} className="border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900">
                        <button
                            onClick={() => toggleCategory(cat.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors"
                        >
                            <span className="font-medium text-slate-200">{cat.title}</span>
                            {expandedCategory === cat.id ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                        </button>
                        {expandedCategory === cat.id && (
                            <div className="p-4 pt-0 border-t border-slate-800/50 bg-slate-900/50 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {cat.services.map((service) => (
                                    <button
                                        key={service}
                                        onClick={() => handleServiceSelect(cat.title, service)}
                                        className={`text-left text-sm p-2 rounded-lg transition-colors ${formData.specificService === service
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        • {service}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );

    const renderForm = () => (
        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {renderCatalogue()}

                <Card className="border-indigo-500/20">
                    <div className="flex items-center gap-2 mb-6">
                        <FileText className="text-indigo-400" size={24} />
                        <h2 className="text-xl font-bold text-white">Research Request Details</h2>
                    </div>

                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Full Name"
                                value={user?.name || ''}
                                readOnly
                                className="opacity-70 bg-slate-950"
                            />
                            <Input
                                label="Role"
                                value={ROLES.find(r => r.id === selectedRole)?.label || selectedRole}
                                readOnly
                                className="opacity-70 bg-slate-950"
                            />
                        </div>

                        <Input
                            label="Institution / Organization"
                            value={formData.institution}
                            onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                            placeholder="University or Organization Name"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300">Service Category</label>
                                <select
                                    value={formData.serviceCategory}
                                    onChange={(e) => setFormData({ ...formData, serviceCategory: e.target.value, specificService: '' })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                                >
                                    <option value="">Select Category</option>
                                    {SERVICE_CATEGORIES.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300">Specific Service</label>
                                <select
                                    value={formData.specificService}
                                    onChange={(e) => setFormData({ ...formData, specificService: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                                    disabled={!formData.serviceCategory}
                                >
                                    <option value="">Select Service</option>
                                    {SERVICE_CATEGORIES.find(c => c.title === formData.serviceCategory)?.services.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300">Research Level</label>
                                <select
                                    value={formData.researchLevel}
                                    onChange={(e) => setFormData({ ...formData, researchLevel: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                                >
                                    <option value="Undergraduate">Undergraduate</option>
                                    <option value="MSc">MSc / Masters</option>
                                    <option value="PhD">PhD / Doctorate</option>
                                    <option value="Institutional">Institutional</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <Input
                                label="Field / Discipline"
                                value={formData.discipline}
                                onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                                placeholder="e.g. Economics, Computer Science"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Brief Description of Request</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 min-h-[120px]"
                                placeholder="Describe your research needs in detail..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input // Using text type for date to maintain consistency with Input component styles if date type isn't supported well in all browsers or by the component
                                label="Preferred Delivery Date"
                                type="date"
                                value={formData.preferredDate}
                                onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                            />
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300">Urgency Level</label>
                                <select
                                    value={formData.urgency}
                                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"
                                >
                                    <option value="Normal">Normal</option>
                                    <option value="Urgent">Urgent</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-300">Supporting Documents (Optional)</label>
                            <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center hover:bg-slate-800/50 transition-colors cursor-pointer">
                                <Upload className="mx-auto text-slate-500 mb-2" size={24} />
                                <p className="text-sm text-slate-400">Click to upload files (PDF, DOCX, XLSX)</p>
                                <input type="file" className="hidden" />
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                            <input
                                type="checkbox"
                                id="consent"
                                checked={formData.consent}
                                onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-offset-0 focus:ring-0"
                            />
                            <label htmlFor="consent" className="text-sm text-slate-300 cursor-pointer user-select-none">
                                I confirm this request is for legitimate academic or institutional research purposes and complies with ethical standards.
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setStep('role')} className="w-1/3">
                                Back
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading} className="w-2/3 bg-indigo-600 hover:bg-indigo-700">
                                {loading ? <Loader2 className="animate-spin" /> : 'Submit Research Request'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="bg-slate-900/80 sticky top-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Shield size={18} className="text-indigo-400" />
                        Ethical Standards
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                        All research support services adhere strictly to ethical and academic integrity standards. We do not facilitate academic misconduct, plagiarism, or contract cheating.
                    </p>
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <h4 className="text-xs font-bold text-slate-300 mb-1">Confidentiality</h4>
                        <p className="text-xs text-slate-500">Your research data and personal information are handled with strict confidentiality.</p>
                    </div>
                </Card>
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div className="max-w-md mx-auto text-center py-12 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Request Received</h2>
            <p className="text-slate-400 mb-8">
                Your research request has been successfully submitted. Our team will review it and contact you within 24–48 hours.
            </p>
            <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/')} variant="primary">
                    Go to Dashboard
                </Button>
                <Button onClick={() => {
                    setStep('role');
                    setFormData({ ...formData, description: '', specificService: '' });
                }} variant="ghost">
                    Submit Another Request
                </Button>
            </div>
        </div>
    );

    const renderHistory = () => (
        <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-6">Service Request History</h2>
            {historyLoading ? (
                <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
            ) : myRequests.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800">
                    <History className="mx-auto text-slate-700 mb-4" size={48} />
                    <p className="text-slate-500 font-medium">No research requests found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {myRequests.map((req) => (
                        <Card key={req.id} className="border-slate-800 bg-slate-900 hover:border-slate-700 transition-colors">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${req.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' :
                                            req.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-500' :
                                                req.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-500' :
                                                    'bg-blue-500/20 text-blue-500'
                                            }`}>
                                            {req.status}
                                        </div>
                                        <span className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-white font-bold">{req.specificService}</h3>
                                    <p className="text-sm text-slate-400 line-clamp-2">{req.description}</p>
                                </div>
                                <div className="md:text-right space-y-2">
                                    <div className="text-sm font-medium text-slate-300">₦{(req.quoteAmount || 0).toLocaleString()}</div>
                                    {req.deliveryUrl && (
                                        <a href={req.deliveryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm font-bold">
                                            Download Deliverable <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>
                            </div>
                            {req.adminNotes && (
                                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-xs text-slate-400">
                                    <span className="font-bold text-slate-200 block mb-1">Admin Response:</span>
                                    {req.adminNotes}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {renderHero()}
            {activeTab === 'new' ? (
                <>
                    {step === 'role' && renderRoleSelection()}
                    {step === 'form' && renderForm()}
                    {step === 'success' && renderSuccess()}
                </>
            ) : (
                renderHistory()
            )}

            <div className="text-center text-xs text-slate-500 mt-12 pb-4">
                © {new Date().getFullYear()} Research Office. All rights reserved.
            </div>
        </div>
    );
};
