export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                primary: {
                    DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
                    foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
                },
                background: 'rgb(var(--bg-background) / <alpha-value>)',
                surface: {
                    DEFAULT: 'rgb(var(--bg-surface) / <alpha-value>)',
                    highlight: 'rgb(var(--bg-surface-highlight) / <alpha-value>)',
                },
                foreground: {
                    DEFAULT: 'rgb(var(--text-foreground) / <alpha-value>)',
                    muted: 'rgb(var(--text-muted) / <alpha-value>)',
                    inverted: 'rgb(var(--text-inverted) / <alpha-value>)',
                },
                border: {
                    DEFAULT: 'rgb(var(--border-color) / <alpha-value>)',
                    highlight: 'rgb(var(--border-highlight) / <alpha-value>)',
                },
            },
        },
    },
    plugins: [],
}
