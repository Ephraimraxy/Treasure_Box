import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

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

    // Close Handler
    const handleClose = () => {
        setIsOpen(false);
        // Save timestamp to localStorage to manage frequency
        localStorage.setItem('ads_last_shown', Date.now().toString());
    };

    // Auto-rotate effect
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % ADS.length);
        }, 5000); // 5 seconds per slide

        return () => clearInterval(interval);
    }, [isOpen]);

    // Check conditions to show ad
    useEffect(() => {
        const checkShouldShow = async () => {
            // 1. Frequency Check
            const lastShown = localStorage.getItem('ads_last_shown');
            if (lastShown) {
                const timeDiff = Date.now() - parseInt(lastShown);
                const oneHour = 60 * 60 * 1000;
                // Don't show if shown in last 1 hour
                if (timeDiff < oneHour) return;
            }

            // 2. Random Chance (e.g. 70% chance to show if frequency check passed)
            // This makes it "unpredicted" as requested
            if (Math.random() > 0.7) return;

            // 3. Network/Image Check
            // Attempt to pre-load images to ensure "good network"
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
            } catch (error) {
                // Network too slow or images failed, don't show popup
                console.log('Ads skipped due to network/loading issues');
            }
        };

        // Run check after a short delay to let app load first
        const timer = setTimeout(checkShouldShow, 2000);
        return () => clearTimeout(timer);
    }, []);

    if (!isOpen) return null;

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

                    {/* Main Close/Action Area Below */}
                    <div className="absolute bottom-0 inset-x-0 p-5 z-20 flex flex-col gap-3">
                        <button
                            onClick={handleClose}
                            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg active:scale-95"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
