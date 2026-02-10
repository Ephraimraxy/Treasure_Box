import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, Gift, TrendingUp, Shield, Zap } from 'lucide-react';

interface Slide {
    id: string;
    title: string;
    description: string;
    cta: string;
    image: string;
    color: string;
    icon: React.ReactNode;
    badge?: string;
}

const FEATURED_SLIDES: Slide[] = [
    {
        id: '1',
        title: 'Earn Up To 15% Returns',
        description: 'Unlock premium investment plans with guaranteed returns. Start with just ₦20,000 and watch your money grow daily.',
        cta: 'Invest Now',
        image: 'https://images.unsplash.com/photo-1639762681057-408e52192e55?auto=format&fit=crop&q=80&w=800',
        color: 'from-amber-600/95 via-yellow-600/90 to-orange-600/85',
        icon: <TrendingUp size={20} className="text-amber-300" />,
        badge: '🔥 HOT'
    },
    {
        id: '2',
        title: 'Refer Friends, Get ₦500',
        description: 'Share your unique referral link and earn ₦500 instantly for every friend who joins Treasure Box.',
        cta: 'Share & Earn',
        image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=800',
        color: 'from-blue-600/95 via-indigo-600/90 to-violet-600/85',
        icon: <Gift size={20} className="text-blue-300" />,
        badge: '💰 BONUS'
    },
    {
        id: '3',
        title: 'Pay Bills Instantly',
        description: 'Buy airtime, data, and pay electricity bills from your wallet in seconds. Zero hassle, instant delivery.',
        cta: 'Pay Now',
        image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=800',
        color: 'from-emerald-600/95 via-teal-600/90 to-cyan-600/85',
        icon: <Zap size={20} className="text-emerald-300" />,
        badge: '⚡ FAST'
    },
    {
        id: '4',
        title: 'Your Money, Protected',
        description: 'Bank-grade encryption, transaction PIN security, and full KYC verification to keep your assets safe.',
        cta: 'Learn More',
        image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800',
        color: 'from-purple-600/95 via-fuchsia-600/90 to-pink-600/85',
        icon: <Shield size={20} className="text-purple-300" />,
    },
    {
        id: '5',
        title: 'New! Virtual Accounts',
        description: 'Get your own dedicated virtual bank account for instant deposits. Fund your wallet 24/7 via bank transfer.',
        cta: 'Get Account',
        image: 'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&q=80&w=800',
        color: 'from-rose-600/95 via-red-600/90 to-orange-600/85',
        icon: <Sparkles size={20} className="text-rose-300" />,
        badge: '✨ NEW'
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

        timeoutRef.current = setTimeout(nextSlide, 5000);

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

    const goTo = (index: number) => {
        setCurrent(index);
        setIsPaused(true);
        setTimeout(() => setIsPaused(false), 3000);
    };

    return (
        <div className="w-full space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-bold text-white tracking-tight">Featured</h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => goTo((current - 1 + FEATURED_SLIDES.length) % FEATURED_SLIDES.length)}
                        className="p-1 rounded-full bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={() => goTo((current + 1) % FEATURED_SLIDES.length)}
                        className="p-1 rounded-full bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Carousel Container */}
            <div
                className="relative w-full h-52 rounded-2xl overflow-hidden shadow-2xl group touch-pan-y"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {FEATURED_SLIDES.map((slide, index) => {
                    const isActive = index === current;

                    return (
                        <div
                            key={slide.id}
                            className={`absolute inset-0 transition-all duration-700 ease-in-out ${isActive ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105'}`}
                        >
                            {/* Background Image with Gradient Overlay */}
                            <div className="absolute inset-0 bg-slate-900">
                                <img
                                    src={slide.image}
                                    alt=""
                                    className="w-full h-full object-cover opacity-40"
                                    loading="lazy"
                                />
                                <div className={`absolute inset-0 bg-gradient-to-br ${slide.color}`} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                                {/* Decorative glow */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                            </div>

                            {/* Content */}
                            <div className="relative z-20 h-full p-5 flex flex-col justify-between">
                                {/* Top Row: Badge */}
                                <div className="flex items-center justify-between">
                                    {slide.badge ? (
                                        <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold text-white tracking-wider">
                                            {slide.badge}
                                        </span>
                                    ) : <span />}
                                    <div className="w-9 h-9 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center">
                                        {slide.icon}
                                    </div>
                                </div>

                                {/* Bottom Content */}
                                <div className="space-y-2.5">
                                    <div className="space-y-1 max-w-[85%]">
                                        <h3 className="text-xl font-bold text-white leading-tight drop-shadow-md">
                                            {slide.title}
                                        </h3>
                                        <p className="text-[13px] text-white/80 font-medium leading-snug line-clamp-2 drop-shadow-sm">
                                            {slide.description}
                                        </p>
                                    </div>
                                    <button className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/25 rounded-xl text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-2 shadow-lg">
                                        {slide.cta} <ArrowRight size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Pagination Dots */}
                <div className="absolute bottom-4 right-5 z-30 flex gap-1.5">
                    {FEATURED_SLIDES.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goTo(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${index === current ? 'w-6 bg-white shadow-lg' : 'w-1.5 bg-white/40 hover:bg-white/60'
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
