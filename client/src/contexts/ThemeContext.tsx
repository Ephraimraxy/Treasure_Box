import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';
type AccentColor = 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'cyan';

interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    accent: AccentColor;
    setAccent: (accent: AccentColor) => void;
    refetchGlobalTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_COLORS: Record<AccentColor, string> = {
    amber: '245 158 11',
    blue: '59 130 246',
    emerald: '16 185 129',
    rose: '244 63 94',
    purple: '168 85 247',
    cyan: '6 182 212',
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();

    // Initialize from localStorage or default to 'system' (which will use global default)
    // Users who explicitly set a preference will have it in localStorage
    const [mode, setModeState] = useState<ThemeMode>(() =>
        (localStorage.getItem('theme-mode') as ThemeMode) || 'system'
    );

    const [accent, setAccentState] = useState<AccentColor>(() =>
        (localStorage.getItem('theme-accent') as AccentColor) || 'amber'
    );

    // Sync with User Profile if available (on load)
    useEffect(() => {
        if (user?.preferences?.theme) {
            // Check if it matches one of our accents
            // The current backend stores 'theme' as the accent color ID (e.g. 'amber')
            // We might want to expand preferences to store 'mode' separately in the future
            // For now, we trust local storage for mode, but sync accent from DB
            setAccentState(user.preferences.theme as AccentColor);
        }
    }, [user]);

    const [globalTheme, setGlobalTheme] = useState<ThemeMode>('dark');

    // Fetch Global Theme Default
    const fetchGlobalTheme = async () => {
        try {
            const { userApi } = await import('../api'); // Dynamic import to avoid cycles
            const { data } = await userApi.getPublicSettings();

            if (data.defaultTheme && ['light', 'dark', 'system'].includes(data.defaultTheme)) {
                setGlobalTheme(data.defaultTheme as ThemeMode);
            } else {
                // Default to dark if not set
                setGlobalTheme('dark');
            }
        } catch (error) {
            console.error('Failed to fetch global theme', error);
            // Default to dark on error
            setGlobalTheme('dark');
        }
    };

    useEffect(() => {
        fetchGlobalTheme();
    }, []);

    const setMode = (newMode: ThemeMode) => {
        setModeState(newMode);
        localStorage.setItem('theme-mode', newMode);
    };

    const setAccent = (newAccent: AccentColor) => {
        setAccentState(newAccent);
        localStorage.setItem('theme-accent', newAccent);
    };

    // Apply Theme Effects
    useEffect(() => {
        const root = window.document.documentElement;

        // 1. Handle Mode (Light/Dark)
        root.classList.remove('light', 'dark');

        let effectiveMode = mode;

        // If user chose 'system' (or hasn't chosen), use Global Default
        // Users who explicitly set 'light' or 'dark' in localStorage will override global
        if (mode === 'system') {
            if (globalTheme === 'light' || globalTheme === 'dark') {
                effectiveMode = globalTheme;
            } else if (globalTheme === 'system') {
                // Global is 'system' -> fallback to OS
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                effectiveMode = systemTheme;
            } else {
                // Default to dark if globalTheme is unset
                effectiveMode = 'dark';
            }
        }

        root.classList.add(effectiveMode);

        // 2. Handle Accent Color
        const colorValue = THEME_COLORS[accent] || THEME_COLORS['amber'];
        root.style.setProperty('--color-primary', colorValue);

        // 3. Handle Computed Contrast (Foreground for Primary)
        const lightAccents = ['amber', 'cyan', 'lime', 'yellow'];
        const contrastColor = lightAccents.includes(accent) ? '15 23 42' : '255 255 255';
        root.style.setProperty('--color-primary-foreground', contrastColor);

    }, [mode, accent, globalTheme]);

    // Listen for system changes if effective mode depends on system
    useEffect(() => {
        // We only care about OS changes if we are effectively using system
        // i.e., mode is system AND globalTheme is system
        if (mode === 'system' && globalTheme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => {
                const root = window.document.documentElement;
                root.classList.remove('light', 'dark');
                root.classList.add(mediaQuery.matches ? 'dark' : 'light');
            };

            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [mode, globalTheme]);

    return (
        <ThemeContext.Provider value={{ mode, setMode, accent, setAccent, refetchGlobalTheme: fetchGlobalTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
