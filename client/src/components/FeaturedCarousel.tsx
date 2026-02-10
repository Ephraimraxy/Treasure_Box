import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface Slide {
    id: string;
    title: string;
    description: string;
    cta: string;
    image: string;
    color: string;
}

const FEATURED_SLIDES: Slide[] = [
    {
        id: '1',
        title: 'High-Yield Investments',
        description: 'Earn up to 12% returns with our new managed portfolios.',
        cta: 'Start Investing',
        image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800', // Money/Gold abstract
        color: 'from-amber-600 to-yellow-500'
    },
    {
        id: '2',
        title: 'Refer & Earn',
        description: 'Invite friends and get ₦500 instantly for every active referral.',
        cta: 'Get Link',
        image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=800', // Handshake/Community
        color: 'from-blue-600 to-indigo-500'
    },
    {
        id: '3',
        title: 'Secure Your Future',
        description: 'Enable 2FA today to keep your assets safe and sound.',
        cta: 'Enable Now',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=800', // Lock/Shield
        color: 'from-emerald-600 to-teal-500'
    }
];

export const FeaturedCarousel = () => {
    const [current, setCurrent] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStart = useRef<number | null>(null);
    const touchEnd = useRef<number | null>(null);

    // Auto-rotate
    useEffect(() => {
        if (isPaused) return;

        const nextSlide = () => {
            setCurrent((prev) => (prev + 1) % FEATURED_SLIDES.length);
        };

        timeoutRef.current = setTimeout(nextSlide, 5000); // 5 seconds per slide

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [current, isPaused]);

    // Touch Handlers
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
        setIsPaused(true);
    }

    const onTouchMove = (e: React.TouchEvent) => {
        touchEnd.current = e.targetTouches[0].clientX;
    }

    const onTouchEnd = () => {
        setIsPaused(false);
        if (!touchStart.current || !touchEnd.current) return;

        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            setCurrent((prev) => (prev + 1) % FEATURED_SLIDES.length);
        }
        if (isRightSwipe) {
            setCurrent((prev) => (prev - 1 + FEATURED_SLIDES.length) % FEATURED_SLIDES.length);
        }
    }

    return (
        <div className="w-full space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-bold text-white tracking-tight">Featured</h2>
                <button className="text-xs font-medium text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                    View More <ArrowRight size={14} />
                </button>
            </div>

            {/* Carousel Container */}
            <div
                className="relative w-full h-48 rounded-2xl overflow-hidden shadow-2xl group touch-pan-y"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {FEATURED_SLIDES.map((slide, index) => {
                    // Only render current, prev, and next for DOM efficiency if list is huge (not here, 3 is fine)
                    // For fade, we stack them absolutely.
                    const isActive = index === current;

                    return (
                        <div
                            key={slide.id}
                            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                        >
                            {/* Background Image with Gradient Overlay */}
                            <div className="absolute inset-0 bg-slate-900">
                                <img src={slide.image} alt="" className="w-full h-full object-cover opacity-60 mix-blend-overlay" />
                                <div className={`absolute inset-0 bg-gradient-to-r ${slide.color} opacity-90 mixing-blend-multiply`} />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                            </div>

                            {/* Content */}
                            <div className="relative z-20 h-full p-6 flex flex-col justify-end items-start gap-2">
                                <div className="space-y-1 max-w-[80%]">
                                    <h3 className="text-2xl font-bold text-white leading-tight drop-shadow-md">
                                        {slide.title}
                                    </h3>
                                    <p className="text-sm text-slate-100 font-medium drop-shadow-sm line-clamp-2">
                                        {slide.description}
                                    </p>
                                </div>
                                <button className="mt-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 rounded-lg text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-2">
                                    {slide.cta} <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Pagination Dots */}
                <div className="absolute bottom-4 right-4 z-30 flex gap-1.5">
                    {FEATURED_SLIDES.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrent(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${index === current ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
