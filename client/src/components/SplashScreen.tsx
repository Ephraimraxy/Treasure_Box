import { useState, useEffect } from 'react';
import { Box } from 'lucide-react';

interface SplashScreenProps {
    onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
    const [progress, setProgress] = useState(0);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setTimeout(() => setFadeOut(true), 200);
                    setTimeout(onComplete, 600);
                    return 100;
                }
                return prev + 2;
            });
        }, 30);

        return () => clearInterval(timer);
    }, [onComplete]);

    return (
        <div
            className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'
                }`}
        >
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/20 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 blur-[150px] rounded-full animate-pulse delay-500" />
            </div>

            {/* Logo */}
            <div className="relative z-10 animate-bounce-slow">
                <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/40 rotate-3">
                    <Box size={64} className="text-white" />
                </div>
            </div>

            {/* App Name */}
            <h1 className="relative z-10 text-4xl font-bold text-white mt-8 mb-2">
                Treasure
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"> Box</span>
            </h1>
            <p className="relative z-10 text-slate-400 mb-8">Secured Platform</p>

            {/* Progress Bar */}
            <div className="relative z-10 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-100"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <p className="relative z-10 text-slate-500 text-sm mt-3">{progress}%</p>
        </div>
    );
};

export default SplashScreen;
