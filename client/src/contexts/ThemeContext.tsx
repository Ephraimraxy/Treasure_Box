import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';
type AccentColor = 'amber' | 'blue' | 'emerald' | 'rose' | 'purple' | 'cyan';

interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    accent: AccentColor;
    setAccent: (accent: AccentColor) => void;
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

    // Initialize from localStorage or default
    const [mode, setModeState] = useState<ThemeMode>(() =>
        (localStorage.getItem('theme-mode') as ThemeMode) || 'dark'
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
        if (mode === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            effectiveMode = systemTheme;
        }

        root.classList.add(effectiveMode);

        // 2. Handle Accent Color
        const colorValue = THEME_COLORS[accent] || THEME_COLORS['amber'];
        root.style.setProperty('--color-primary', colorValue);

        // 3. Handle Computed Contrast (Foreground for Primary)
        // Amber/Cyan are light -> use dark text. Others -> use white text.
        const lightAccents = ['amber', 'cyan', 'lime', 'yellow'];
        const contrastColor = lightAccents.includes(accent) ? '15 23 42' : '255 255 255'; // slate-900 vs white
        root.style.setProperty('--color-primary-foreground', contrastColor);

    }, [mode, accent]);

    // Listen for system changes if in system mode
    useEffect(() => {
        if (mode !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            const root = window.document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(mediaQuery.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [mode]);

    return (
        <ThemeContext.Provider value={{ mode, setMode, accent, setAccent }}>
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
