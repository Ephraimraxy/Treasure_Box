import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { userApi } from '../api';

// Import images from assets - we need to make sure these paths are correct
// Assuming typical Vite/React asset handling
import ad1 from '../assets/ads/Gemini_Generated_Image_lf9vwolf9vwolf9v.png';
import ad2 from '../assets/ads/Gemini_Generated_Image_rwui64rwui64rwui.png';

const ADS = [
    { id: 1, image: ad1, alt: "Special Offer 1" },
    { id: 2, image: ad2, alt: "Special Offer 2" }
];

export const AdsPopup = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(true);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [adsEnabled, setAdsEnabled] = useState(true);

    // Close Handler
    const handleClose = () => {
        setIsOpen(false);
        // Update last visit time when closed
        localStorage.setItem('ads_last_visit', Date.now().toString());
    };

    // Auto-rotate effect
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % ADS.length);
        }, 5000); // 5 seconds per slide

        return () => clearInterval(interval);
    }, [isOpen]);

    // Load server-side toggle and then decide whether to show ad
    useEffect(() => {
        let mounted = true;
        const loadSettings = async () => {
            try {
                const res = await userApi.getSettings();
                if (!mounted) return;
                const data = res.data || {};
                setAdsEnabled(data.enableUserAdsPopup ?? true);
            } catch {
                // fail open: keep ads enabled by default
                setAdsEnabled(true);
            } finally {
                if (mounted) setSettingsLoaded(true);
            }
        };

        // Only fetch if user appears logged in
        const token = localStorage.getItem('token');
        if (token) {
            loadSettings();
        } else {
            setSettingsLoaded(true);
            setAdsEnabled(false);
        }

        return () => {
            mounted = false;
        };
    }, []);

    // Check conditions to show ad once settings are loaded and ads are enabled
    useEffect(() => {
        if (!settingsLoaded || !adsEnabled) return;

        const checkShouldShow = async () => {
            const token = localStorage.getItem('token');
            if (!token) return; // Don't show if not logged in

            const currentTime = Date.now();

            // 1. Check if it's a new login (within 5 minutes of login)
            const lastLoginTime = localStorage.getItem('last_login_time');
            const isNewLogin = lastLoginTime && (currentTime - parseInt(lastLoginTime)) < (5 * 60 * 1000);

            // 2. Check if user is returning after a long time (7+ days since last visit)
            const lastVisitTime = localStorage.getItem('ads_last_visit');
            const isLongTimeReturning = lastVisitTime ? (currentTime - parseInt(lastVisitTime)) > (7 * 24 * 60 * 60 * 1000) : true;

            // 3. Always show on dashboard refresh (this component mounts on dashboard)
            const shouldShow = isNewLogin || isLongTimeReturning || true;

            if (!shouldShow) return;

            // 4. Network/Image Check - Ensure images load quickly
            try {
                const loadPromises = ADS.map(ad => {
                    return new Promise((resolve, reject) => {
                        const img = new Image();
                        img.src = ad.image;
                        img.onload = resolve;
                        img.onerror = reject;
                        // Timeout if image takes too long (bad network)
                        setTimeout(() => reject(new Error('Timeout')), 3000);
                    });
                });

                await Promise.all(loadPromises);

                // If we get here, images loaded fast enough
                setLoading(false);
                setIsOpen(true);
            } catch {
                // Network too slow or images failed, don't show popup
                console.log('Ads skipped due to network/loading issues');
            }
        };

        const timer = setTimeout(checkShouldShow, 2000);
        return () => clearTimeout(timer);
    }, [settingsLoaded, adsEnabled]);

    if (!isOpen || !adsEnabled) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-[350px] md:max-w-md bg-transparent rounded-3xl shadow-2xl overflow-hidden animate-scale-in">

                {/* Close Button - Positioned consistently */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md transition-all border border-white/20"
                >
                    <X size={20} />
                </button>

                {/* Carousel */}
                <div className="relative w-full aspect-[4/5] bg-slate-900 rounded-3xl overflow-hidden border border-white/10">
                    {ADS.map((ad, index) => (
                        <div
                            key={ad.id}
                            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'
                                }`}
                        >
                            <img
                                src={ad.image}
                                alt={ad.alt}
                                className="w-full h-full object-fill md:object-cover"
                            />
                            {/* Gradient Overlay for better text readability if images have text */}
                            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                    ))}

                    {/* Navigation Dots */}
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        {ADS.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-6 bg-emerald-500' : 'w-2 bg-white/50'
                                    }`}
                            />
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};
