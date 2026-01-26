'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthControl() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const toggleAuth = () => {
        setIsLoggedIn(!isLoggedIn);
        // In a real app, this would trigger a Supabase auth flow or redirect
    };

    return (
        <div
            className="fixed top-6 right-6 z-50 flex items-center gap-4"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <AnimatePresence>
                {isLoggedIn && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="mono-small text-signal/40 text-xs text-right hidden md:block"
                    >
                        <div>ID: OPERATOR_7</div>
                        <div className="text-[var(--safe)]">CLEARANCE: LEVEL 7</div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={toggleAuth}
                className={`
                    relative px-6 py-2 border backdrop-blur-md transition-all duration-300
                    ${isLoggedIn
                        ? 'border-[var(--safe)] bg-[var(--safe)]/10 text-[var(--safe)]'
                        : 'border-[var(--aerospace)] bg-[var(--aerospace)]/10 text-[var(--aerospace)]'
                    }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {/* Scanline overlay */}
                <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                    <div className="w-full h-[2px] bg-current absolute top-0 animate-[scanline_3s_linear_infinite]" />
                </div>

                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isLoggedIn ? 'bg-[var(--safe)]' : 'bg-[var(--aerospace)]'} animate-pulse`} />
                    <span className="mono-small tracking-widest font-bold">
                        {isLoggedIn ? 'LOGOUT' : 'LOGIN'}
                    </span>
                </div>
            </motion.button>
        </div>
    );
}
