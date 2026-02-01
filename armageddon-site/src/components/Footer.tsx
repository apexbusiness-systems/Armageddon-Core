'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════

// Lazy Supabase client initialization
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
    if (globalThis.window === undefined) return null;
    if (!supabaseClient && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
    }
    return supabaseClient;
}

export default function Footer() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const sb = getSupabase();
        if (!sb) return;

        sb.auth.getUser().then(({ data }) => setUser(data.user));

        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleGetCertified = async () => {
        const sb = getSupabase();
        if (!sb) {
            console.error('Supabase not initialized');
            return;
        }

        setIsLoading(true);
        try {
            // If already logged in, redirect to the console/dashboard
            if (user) {
                // Scroll to top where the destruction console is
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setIsLoading(false);
                return;
            }

            // If not logged in, trigger OAuth signup/login
            const { error } = await sb.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });

            if (error) {
                console.error('Auth error:', error);
            }
        } catch (error) {
            console.error('Failed to initiate auth:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <footer className="relative overflow-hidden">
            {/* CTA Section */}
            <section className="py-28 px-4 relative">
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--aerospace)]/[0.03] to-transparent" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    {/* Context line */}
                    <motion.p
                        className="display-medium text-signal/80 mb-12"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        COMPLIANCE IS A CHECKLIST.
                        <br />
                        <span className="text-[var(--aerospace)]">ARMAGEDDON IS A GUARANTEE.</span>
                    </motion.p>

                    {/* CTA Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                    >
                        <button
                            onClick={handleGetCertified}
                            disabled={isLoading}
                            className={`btn-cta mx-auto ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
                        >
                            <span>{isLoading ? 'LOADING...' : user ? 'START TESTING' : 'GET CERTIFIED'}</span>
                        </button>
                    </motion.div>

                    {/* Tier info */}
                    <motion.p
                        className="mt-8 mono-small text-signal/30"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        SELF-SERVE (FREE) → VERIFIED (EVIDENCE REVIEW) → CERTIFIED (SIGNED CERTIFICATE)
                    </motion.p>
                </div>
            </section>

            {/* Divider */}
            <div className="section-divider" />

            {/* Sub-footer */}
            <div className="py-8 px-4 bg-[var(--void)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Brand */}
                    <div className="flex items-center gap-4">
                        <span className="display-medium text-signal text-xl">ARMAGEDDON</span>
                        <span className="mono-small text-signal/30">© 2026 APEX BUSINESS SYSTEMS</span>
                    </div>

                    {/* Vercel badge */}
                    <div className="flex items-center gap-3">
                        <span className="mono-small text-signal/40">POWERED BY</span>
                        <svg className="h-5 w-5 text-signal/50" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L2 19.5h20L12 2z" />
                        </svg>
                        <span className="mono-small text-signal/40">VERCEL</span>
                    </div>

                    {/* Deployment indicator */}
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-[var(--safe)] rounded-full animate-pulse" />
                        <span className="mono-small text-signal/30">DEPLOYED TO VERCEL PROD // US-EAST</span>
                    </div>
                </div>
            </div>

            {/* Legal */}
            <div className="py-6 px-4 bg-[var(--void)] border-t border-[var(--tungsten)]">
                <p className="text-center mono-small text-signal/15 max-w-4xl mx-auto">
                    Armageddon Test Suite Certification is designed for controlled sandbox testing and does not guarantee breach prevention.
                    Certification reflects results of the tested build/configuration at time of run.
                    Not a substitute for compliance certifications (SOC 2, ISO 27001) or professional penetration testing.
                </p>
            </div>
        </footer>
    );
}
