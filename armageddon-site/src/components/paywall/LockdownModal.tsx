'use client';

import { motion } from 'framer-motion';

interface LockdownModalProps {
    onClose: () => void;
}

export default function LockdownModal({ onClose }: LockdownModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with reduced opacity to show logs behind */}
            <motion.div
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose} // Click outside to close
            />

            {/* Modal Container */}
            <motion.div
                className="relative z-10 w-full max-w-lg bg-[#0a0a0a] border-2 border-[var(--aerospace)] shadow-[0_0_50px_rgba(255,51,0,0.3)] overflow-hidden"
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{
                    scale: 1,
                    y: 0,
                    opacity: 1,
                    x: [0, -5, 5, -5, 5, 0]
                }}
            >
                {/* Close Button X */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-signal/30 hover:text-[var(--aerospace)] transition-colors z-20"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                {/* Header Strip - Scanline */}
                <div className="h-2 w-full bg-[var(--aerospace)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite]" />
                </div>

                <div className="p-8 text-center relative">
                    {/* Background Grid Texture */}
                    <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

                    {/* Warning Icon / Symbol */}
                    <motion.div
                        className="text-6xl mb-6 flex justify-center text-[var(--aerospace)]"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 0.2, repeat: Infinity, repeatType: "reverse", repeatDelay: 3 }}
                    >
                        ⛔
                    </motion.div>

                    {/* Access Denied Header */}
                    <h2 className="display-medium text-[var(--aerospace)] mb-2 tracking-widest leading-none glitch-text" data-text="CONNECTION LOST">
                        CONNECTION LOST
                    </h2>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--aerospace)] to-transparent my-6 opacity-50" />

                    {/* Lockdown Message */}
                    <div className="mono-data text-white mb-8 space-y-2">
                        <p className="tracking-widest text-[var(--aerospace)] font-bold">
                            ADVERSARIAL SIMULATION HALTED
                        </p>
                        <p className="text-signal/60 text-xs text-center border-l-2 border-[var(--aerospace)] pl-3 ml-12 py-1 text-left">
                            DETECTED: PROMPT_INJECTION_PAYLOAD<br />
                            STATUS: INTERCEPTED<br />
                            ACTION: LEVEL 7 CLEARANCE REQUIRED
                        </p>
                    </div>

                    {/* CTA Button */}
                    <motion.button
                        className="btn-primary w-full text-lg tracking-wider group relative mb-4"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        animate={{
                            boxShadow: [
                                "0 0 0 0 rgba(255, 51, 0, 0)",
                                "0 0 0 10px rgba(255, 51, 0, 0.1)",
                                "0 0 0 20px rgba(255, 51, 0, 0)"
                            ]
                        }}
                        transition={{
                            boxShadow: {
                                duration: 1.5,
                                repeat: Infinity
                            }
                        }}
                        onClick={() => window.open('https://stripe.com', '_blank')}
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            <span>RESTORE UPLINK</span>
                            <span className="mono-small opacity-70">($4,999/mo)</span>
                        </span>
                        {/* Glitch overlay on hover */}
                        <div className="absolute inset-0 bg-[var(--aerospace)] opacity-0 group-hover:opacity-10 transition-opacity" />
                    </motion.button>

                    {/* Secondary Actions */}
                    <div className="flex justify-between items-center px-2">
                        <button onClick={onClose} className="mono-small text-signal/40 hover:text-white transition-colors">
                            ABORT SEQUENCE
                        </button>
                        <button className="mono-small text-[var(--aerospace)] hover:text-white transition-colors">
                            MEMBER LOGIN &gt;
                        </button>
                    </div>


                    <p className="mt-4 mono-small text-signal/30 text-[10px]">
                        ID: GATEKEEPER-L7 // ENFORCED BY APEX
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
