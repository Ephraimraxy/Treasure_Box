import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, AlertCircle, RefreshCw, ChevronRight, Shield } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { ActionButton } from '../pages/Auth'; // Reusing components
import { Input } from '../components/ui';
import { useNavigate } from 'react-router-dom';

const KYC_STEPS = [
    {
        id: 'intro',
        title: 'Identity Verification',
        description: 'To comply with regulations and ensure security, we need to verify your identity. This process takes less than 2 minutes.'
    },
    {
        id: 'camera_check',
        title: 'Camera Check',
        description: 'Please ensure you are in a well-lit room and your face is clearly visible.'
    },
    {
        id: 'liveness',
        title: 'Liveness Check',
        description: 'Follow the instructions on the screen to prove you are a real person.'
    },
    {
        id: 'details',
        title: 'Identity Numbers',
        description: 'Provide your BVN and NIN for final verification.'
    }
];

const CHALLENGES = [
    { id: 'blink', text: 'Blink your eyes twice', icon: '👀' },
    { id: 'smile', text: 'Give a big smile', icon: '😁' },
    { id: 'left', text: 'Turn your head slightly left', icon: '⬅️' },
    { id: 'right', text: 'Turn your head slightly right', icon: '➡️' }
];

export const KYCPage = () => {
    const [step, setStep] = useState(0);
    const [subStep, setSubStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [challengeIndex, setChallengeIndex] = useState(0);
    const [challengeStatus, setChallengeStatus] = useState<'waiting' | 'detecting' | 'success'>('waiting');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [formData, setFormData] = useState({ bvn: '', nin: '' });
    const webcamRef = useRef<Webcam>(null);
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Simulate liveness detection
    // Simulate liveness detection
    useEffect(() => {
        if (step === 2) {
            // Auto-start detection
            if (challengeStatus === 'waiting') {
                const startTimer = setTimeout(() => setChallengeStatus('detecting'), 1000); // 1s delay before starting
                return () => clearTimeout(startTimer);
            }

            if (challengeStatus === 'detecting') {
                const timer = setTimeout(() => {
                    setChallengeStatus('success');
                    addToast('success', 'Movement detected!');

                    setTimeout(() => {
                        if (challengeIndex < CHALLENGES.length - 1) {
                            setChallengeIndex(prev => prev + 1);
                            setChallengeStatus('waiting'); // Will auto-trigger detecting again due to effect
                        } else {
                            // All challenges done
                            setStep(3);
                        }
                    }, 1500);
                }, 2000); // Reduced to 2s for faster UX

                return () => clearTimeout(timer);
            }
        }
    }, [step, challengeStatus, challengeIndex, addToast]);

    const handleNext = () => {
        if (step < KYC_STEPS.length - 1) {
            setStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const startLiveness = () => {
        setChallengeStatus('detecting');
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCapturedImage(imageSrc);
            addToast('success', 'Photo captured!');
        }
    }, [webcamRef]);

    const handleSubmit = async () => {
        if (!formData.bvn || !formData.nin) {
            addToast('error', 'Please fill in BVN and NIN');
            return;
        }

        setLoading(true);
        try {
            // In a real app, we would upload the 'capturedImage' to a storage service
            const mockPhotoUrl = "https://placehold.co/600x400/png";
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/kyc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    photoUrl: mockPhotoUrl,
                    bvn: formData.bvn,
                    nin: formData.nin
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to submit KYC');
            }

            addToast('success', 'Verification submitted successfully!');
            navigate('/profile');
        } catch (error: any) {
            console.error('KYC Submit Error:', error);
            addToast('error', error.message || 'Failed to submit verification');
        } finally {
            setLoading(false);
        }
    };

    const currentStepData = KYC_STEPS[step];

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                        <Shield className="text-amber-500" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">{currentStepData.title}</h1>
                    <p className="text-slate-400">{currentStepData.description}</p>
                </div>

                {/* Progress */}
                <div className="flex justify-between mb-8 px-4">
                    {KYC_STEPS.map((s, i) => (
                        <div key={s.id} className={`flex flex-col items-center gap-2 ${i <= step ? 'text-amber-500' : 'text-slate-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 
                                ${i < step ? 'bg-amber-500 border-amber-500 text-slate-950' : i === step ? 'border-amber-500 text-amber-500' : 'border-slate-700 text-slate-700'}`}>
                                {i < step ? <CheckCircle size={16} /> : i + 1}
                            </div>
                            <span className="text-xs hidden sm:block">{s.title}</span>
                        </div>
                    ))}
                </div>

                {/* Content Area */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">

                    {step === 0 && (
                        <div className="text-center space-y-6">
                            <div className="bg-slate-800/50 p-6 rounded-xl text-left space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-700 p-2 rounded-lg"><Camera size={20} /></div>
                                    <div>
                                        <h3 className="font-bold">Face Verification</h3>
                                        <p className="text-sm text-slate-400">We'll scan your face to ensure you're a real person.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-700 p-2 rounded-lg"><Shield size={20} /></div>
                                    <div>
                                        <h3 className="font-bold">Identity Document</h3>
                                        <p className="text-sm text-slate-400">Upload a valid government-issued ID.</p>
                                    </div>
                                </div>
                            </div>
                            <ActionButton onClick={handleNext}>Start Verification</ActionButton>
                        </div>
                    )}

                    {(step === 1 || step === 2) && (
                        <div className="space-y-6">
                            <div className="relative rounded-xl overflow-hidden aspect-video bg-black max-w-md mx-auto border-2 border-slate-700 shadow-2xl">
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                                    videoConstraints={{ facingMode: "user" }}
                                />
                                <div className="absolute inset-0 border-4 border-amber-500/30 rounded-xl pointer-events-none"></div>
                                {/* Face Oval Overlay */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-dashed border-white/50 rounded-[50%] pointer-events-none"></div>
                            </div>

                            {step === 1 && (
                                <div className="text-center">
                                    <p className="mb-4 text-slate-300">Make sure your face fits within the oval.</p>
                                    <ActionButton onClick={handleNext}>My Face is Visible</ActionButton>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="bg-slate-800 p-4 rounded-xl mb-6 animate-pulse-glow border border-amber-500/20">
                                    <span className="text-4xl block mb-2">{CHALLENGES[challengeIndex].icon}</span>
                                    <h3 className="text-xl font-bold text-white mb-1">{CHALLENGES[challengeIndex].text}</h3>
                                    <p className="text-amber-500 text-sm font-medium uppercase tracking-wider">
                                        {challengeStatus === 'success' ? 'Great!' : 'Detecting...'}
                                    </p>
                                </div>
                                </div>
                    )}
                </div>
                    )}

                {step === 3 && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Input
                                label="BVN"
                                value={formData.bvn}
                                onChange={(e) => setFormData({ ...formData, bvn: e.target.value })}
                                placeholder="Enter your 11-digit BVN"
                                maxLength={11}
                            />
                            <Input
                                label="NIN"
                                value={formData.nin}
                                onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                                placeholder="Enter your 11-digit NIN"
                                maxLength={11}
                            />
                        </div>

                        <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 hover:border-amber-500/50 transition-colors cursor-pointer bg-slate-900/50 text-center">
                            <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Camera size={32} className="text-slate-400" />
                            </div>
                            <h3 className="font-bold text-white mb-2">Upload ID Document</h3>
                            <p className="text-sm text-slate-400">Click to select or drag and drop</p>
                            <input type="file" className="hidden" />
                        </div>
                        <ActionButton onClick={handleSubmit} loading={loading}>Submit Verification</ActionButton>
                    </div>
                )}
            </div>
        </div>
        </div >
    );
};
