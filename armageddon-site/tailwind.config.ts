import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                void: '#050505',
                aerospace: '#FF3300',
                tungsten: '#262626',
                signal: '#F0F0F0',
                'aerospace-dark': '#CC2900',
                'aerospace-glow': 'rgba(255, 51, 0, 0.4)',
            },
            fontFamily: {
                oswald: ['var(--font-oswald)', 'sans-serif'],
                mono: ['var(--font-jetbrains)', 'monospace'],
            },
            animation: {
                scanline: 'scanline 8s linear infinite',
                pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                glitch: 'glitch 0.3s ease-in-out infinite',
                shine: 'shine 5s ease-in-out infinite',
                blink: 'blink 1s step-end infinite',
                'status-pulse': 'statusPulse 2s ease-in-out infinite',
                float: 'float 6s ease-in-out infinite',
            },
            keyframes: {
                scanline: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100vh)' },
                },
                glitch: {
                    '0%, 100%': { transform: 'translate(0)' },
                    '20%': { transform: 'translate(-2px, 2px)' },
                    '40%': { transform: 'translate(-2px, -2px)' },
                    '60%': { transform: 'translate(2px, 2px)' },
                    '80%': { transform: 'translate(2px, -2px)' },
                },
                shine: {
                    '0%, 100%': { backgroundPosition: '-200% center' },
                    '50%': { backgroundPosition: '200% center' },
                },
                blink: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0' },
                },
                statusPulse: {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.7)' },
                    '50%': { boxShadow: '0 0 0 8px rgba(34, 197, 94, 0)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
            backgroundImage: {
                noise: "url('/noise.svg')",
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            },
        },
    },
    plugins: [],
};

export default config;
