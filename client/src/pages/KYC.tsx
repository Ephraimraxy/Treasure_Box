import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle, AlertCircle, RefreshCw, ChevronRight, Shield } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { ActionButton } from '../pages/Auth';
import { Input } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import * as cam from '@mediapipe/camera_utils';

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
    { id: 'blink', text: 'Blink your eyes', icon: '👀' },
    { id: 'smile', text: 'Give a big smile', icon: '😁' },
    { id: 'left', text: 'Turn head left', icon: '⬅️' },
    { id: 'right', text: 'Turn head right', icon: '➡️' }
];

export const KYCPage = () => {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [challengeIndex, setChallengeIndex] = useState(0);
    const [challengeStatus, setChallengeStatus] = useState<'waiting' | 'detecting' | 'success'>('waiting');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [formData, setFormData] = useState({ bvn: '', nin: '' });
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Refs for detection logic to avoid re-renders
    const faceMeshRef = useRef<FaceMesh | null>(null);
    const cameraRef = useRef<cam.Camera | null>(null);
    const lastActionTime = useRef<number>(0);

    // Initialize Face Mesh
    useEffect(() => {
        if (step === 2 && !faceMeshRef.current) {
            const mesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });

            mesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            mesh.onResults(onResults);
            faceMeshRef.current = mesh;

            if (webcamRef.current && webcamRef.current.video) {
                const camera = new cam.Camera(webcamRef.current.video, {
                    onFrame: async () => {
                        if (faceMeshRef.current && webcamRef.current?.video) {
                            await faceMeshRef.current.send({ image: webcamRef.current.video });
                        }
                    },
                    width: 640,
                    height: 480
                });
                camera.start();
                cameraRef.current = camera;
            }
        }

        return () => {
            if (faceMeshRef.current) {
                faceMeshRef.current.close();
                faceMeshRef.current = null;
            }
            if (cameraRef.current) {
                cameraRef.current.stop();
                cameraRef.current = null;
            }
        };
    }, [step]);

    const calculateEAR = (landmarks: any, eyeIndices: number[]) => {
        // Euclidean distance logic for Eye Aspect Ratio
        const p1 = landmarks[eyeIndices[0]];
        const p2 = landmarks[eyeIndices[1]];
        const p3 = landmarks[eyeIndices[2]];
        const p4 = landmarks[eyeIndices[3]];
        const p5 = landmarks[eyeIndices[4]];
        const p6 = landmarks[eyeIndices[5]];

        const vertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
        const vertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
        const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);

        return (vertical1 + vertical2) / (2.0 * horizontal);
    };

    const onResults = (results: Results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

        const landmarks = results.multiFaceLandmarks[0];
        const currentChallenge = CHALLENGES[challengeIndex];
        const now = Date.now();

        // Debounce success to prevent double triggers
        if (now - lastActionTime.current < 2000) return;

        let detected = false;

        if (currentChallenge.id === 'blink') {
            // Simple logic: vertical distance of eyelids
            const leftEyeTop = landmarks[159];
            const leftEyeBottom = landmarks[145];
            const distance = Math.hypot(leftEyeTop.x - leftEyeBottom.x, leftEyeTop.y - leftEyeBottom.y);
            if (distance < 0.015) detected = true; // Threshold for blink
        } else if (currentChallenge.id === 'smile') {
            // Mouth width
            const mouthLeft = landmarks[61];
            const mouthRight = landmarks[291];
            const width = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
            if (width > 0.35) detected = true; // Threshold for smile
        } else if (currentChallenge.id === 'left') {
            // Nose tip vs Cheek centers
            const noseTip = landmarks[1];
            const leftCheek = landmarks[234];
            if (noseTip.x < leftCheek.x + 0.05) detected = true; // Looking left
        } else if (currentChallenge.id === 'right') {
            const noseTip = landmarks[1];
            const rightCheek = landmarks[454];
            if (noseTip.x > rightCheek.x - 0.05) detected = true; // Looking right
        }

        if (detected) {
            lastActionTime.current = now;
            setChallengeStatus('success');
            addToast('success', 'Perfect!');

            setTimeout(() => {
                if (challengeIndex < CHALLENGES.length - 1) {
                    setChallengeIndex(prev => prev + 1);
                    setChallengeStatus('waiting');
                } else {
                    setStep(3);
                }
            }, 1000);
        }
    };

    const handleNext = () => {
        if (step < KYC_STEPS.length - 1) {
            setStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!formData.bvn || !formData.nin) {
            addToast('error', 'Please fill in BVN and NIN');
            return;
        }

        setLoading(true);
        try {
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
                <div className="mb-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                        <Shield className="text-amber-500" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">{currentStepData.title}</h1>
                    <p className="text-slate-400">{currentStepData.description}</p>
                </div>

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
                                        <h3 className="font-bold">Identity Numbers</h3>
                                        <p className="text-sm text-slate-400">Provide your BVN and NIN.</p>
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
                                    className="w-full h-full object-cover transform scale-x-[-1]"
                                    videoConstraints={{ facingMode: "user" }}
                                />
                                {step === 2 && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />}
                                <div className="absolute inset-0 border-4 border-amber-500/30 rounded-xl pointer-events-none"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-dashed border-white/50 rounded-[50%] pointer-events-none"></div>
                            </div>

                            {step === 1 && (
                                <div className="text-center">
                                    <p className="mb-4 text-slate-300">Make sure your face fits within the oval.</p>
                                    <ActionButton onClick={handleNext}>My Face is Visible</ActionButton>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="text-center">
                                    <div className="bg-slate-800 p-4 rounded-xl mb-6 border border-amber-500/20">
                                        <span className="text-4xl block mb-2">{CHALLENGES[challengeIndex].icon}</span>
                                        <h3 className="text-xl font-bold text-white mb-1">{CHALLENGES[challengeIndex].text}</h3>
                                        <p className="text-amber-500 text-sm font-medium uppercase tracking-wider">
                                            {challengeStatus === 'success' ? 'Great Work!' : 'Waiting for action...'}
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
                            <ActionButton onClick={handleSubmit} loading={loading}>Submit Verification</ActionButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
