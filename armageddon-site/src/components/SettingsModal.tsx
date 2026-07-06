'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { Settings, User as UserIcon, CreditCard, HelpCircle, ChevronRight } from 'lucide-react';
import { apiFetch, isApiConfigured } from '@/lib/runtime-api';
import { readSavedCodebaseTarget, type CodebaseTarget } from '@/lib/codebase-target';

interface SettingsModalProps {
    readonly open: boolean;
    readonly user: User | null;
    readonly onClose: () => void;
}

type TabId = 'profile' | 'billing' | 'faq';

export default function SettingsModal({ open, user, onClose }: SettingsModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <SettingsModalPanel
                    key="settings-modal-panel"
                    user={user}
                    onClose={onClose}
                />
            )}
        </AnimatePresence>
    );
}

interface PanelProps {
    readonly user: User | null;
    readonly onClose: () => void;
}

function SettingsModalPanel({ user, onClose }: PanelProps) {
    const [activeTab, setActiveTab] = useState<TabId>('profile');
    const [tier, setTier] = useState<string>(() => {
        if (!user) return 'unauthenticated';
        if (!isApiConfigured()) return 'free_dry';
        return 'loading';
    });
    const [target] = useState<CodebaseTarget | null>(() => {
        try {
            return readSavedCodebaseTarget();
        } catch {
            return null;
        }
    });

    // Escape key listener to close modal
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        globalThis.addEventListener('keydown', onKey);
        return () => globalThis.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Fetch active tier on mount
    useEffect(() => {
        if (!user || !isApiConfigured()) return;

        let cancelled = false;
        apiFetch('/api/gatekeeper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                setTier(data?.tier ?? 'free_dry');
            })
            .catch(() => {
                if (cancelled) return;
                setTier('free_dry');
            });

        return () => {
            cancelled = true;
        };
    }, [user]);

    const formattedTier = useMemo(() => {
        if (tier === 'loading') return 'FETCHING TIER...';
        if (tier === 'unauthenticated') return 'GUEST / DRY RUN';
        if (tier === 'certified') return 'LEVEL 7 / CERTIFIED RUNS';
        if (tier === 'verified') return 'LEVEL 6 / VERIFIED RUNS';
        return 'FREE DRY RUNS';
    }, [tier]);

    return (
        <motion.div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Settings, Profile & FAQ Control Center"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

            {/* Panel */}
            <motion.div
                className="relative w-full max-w-3xl border border-[var(--aerospace)]/40 bg-gradient-to-b from-[var(--void)] to-[var(--tungsten)] shadow-[0_0_60px_rgba(255,51,0,0.25)] overflow-hidden rounded-sm"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                transition={{ duration: 0.25, ease: [0.25, 0.8, 0.25, 1] }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Scanline accent */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06]">
                    <div className="absolute top-0 left-0 h-[2px] w-full bg-[var(--aerospace)] animate-[scanline_4s_linear_infinite]" />
                </div>

                {/* Corner brackets */}
                <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[var(--aerospace)]" />
                <span className="pointer-events-none absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[var(--aerospace)]" />
                <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[var(--aerospace)]" />
                <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[var(--aerospace)]" />

                <div className="relative flex flex-col md:flex-row h-[580px]">
                    {/* Left Sidebar Tabs */}
                    <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-white/10 bg-black/30 p-5 flex flex-col gap-1.5 justify-between animate-[pulse_6s_infinite]">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 mb-6">
                                <Settings className="w-4 h-4 text-[var(--aerospace)] animate-[spin_8s_linear_infinite]" />
                                <span className="mono-small text-[var(--signal)] font-bold tracking-wider">CONTROL CENTER</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setActiveTab('profile')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm mono-small tracking-wider text-left transition-all ${
                                    activeTab === 'profile'
                                        ? 'bg-[var(--aerospace)] text-black font-bold'
                                        : 'text-[var(--signal-dim)] hover:text-white hover:bg-white/[0.04]'
                                }`}
                            >
                                <UserIcon className="w-4 h-4" />
                                PROFILE & TARGET
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('billing')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm mono-small tracking-wider text-left transition-all ${
                                    activeTab === 'billing'
                                        ? 'bg-[var(--aerospace)] text-black font-bold'
                                        : 'text-[var(--signal-dim)] hover:text-white hover:bg-white/[0.04]'
                                }`}
                            >
                                <CreditCard className="w-4 h-4" />
                                BILLING & TIER
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('faq')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm mono-small tracking-wider text-left transition-all ${
                                    activeTab === 'faq'
                                        ? 'bg-[var(--aerospace)] text-black font-bold'
                                        : 'text-[var(--signal-dim)] hover:text-white hover:bg-white/[0.04]'
                                }`}
                            >
                                <HelpCircle className="w-4 h-4" />
                                QUICKSTART & FAQS
                            </button>
                        </div>

                        <div className="hidden md:block pt-4 border-t border-white/5">
                            <p className="text-[10px] font-mono text-[var(--signal-dim)]/40 uppercase">ARMAGEDDON TEST SUITE</p>
                            <p className="text-[9px] font-mono text-[var(--signal-dim)]/30 font-bold">v1.0.0 // MOAT replica</p>
                        </div>
                    </div>

                    {/* Right Content Panel */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/10">
                            <span className="mono-small text-[var(--aerospace)] tracking-widest uppercase font-bold">
                                {activeTab === 'profile' && 'Profile & Configured Target'}
                                {activeTab === 'billing' && 'Subscription & Billing'}
                                {activeTab === 'faq' && 'Onboarding Guide & Frequently Asked Questions'}
                            </span>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close settings"
                                className="text-[var(--signal-dim)] hover:text-white transition-colors p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div className="border border-white/10 bg-black/40 p-4 rounded-sm">
                                        <h3 className="mono-small text-[var(--signal)] font-bold uppercase tracking-wider mb-3">Operator Authentication</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                            <div>
                                                <span className="text-[var(--signal-dim)]/50 block">EMAIL ADDRESS</span>
                                                <span className="text-[var(--signal)] font-bold">{user?.email ?? 'dry-run-guest@armageddontest.icu'}</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--signal-dim)]/50 block">CLEARANCE STATUS</span>
                                                <span className="text-[var(--safe)] font-bold">{formattedTier}</span>
                                            </div>
                                            <div className="md:col-span-2">
                                                <span className="text-[var(--signal-dim)]/50 block">OPERATOR ID</span>
                                                <span className="text-[var(--signal-dim)] text-[10px] break-all">{user?.id ?? 'ANONYMOUS_SESSION_ID'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-white/10 bg-black/40 p-4 rounded-sm">
                                        <h3 className="mono-small text-[var(--signal)] font-bold uppercase tracking-wider mb-3">Active Target Configuration</h3>
                                        {target ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                                                    <div>
                                                        <span className="text-[var(--signal-dim)]/50 block">SYSTEM NAME</span>
                                                        <span className="text-[var(--signal)] font-bold">{target.label}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[var(--signal-dim)]/50 block">TARGET KIND</span>
                                                        <span className="text-[var(--aerospace)] uppercase font-bold">{target.kind}</span>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <span className="text-[var(--signal-dim)]/50 block">ENDPOINT URL</span>
                                                        <span className="text-[var(--signal)] break-all select-all font-bold">{target.endpointUrl}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--safe)] animate-pulse" />
                                                    <span className="text-[10px] font-mono text-[var(--safe)] uppercase">Connected locally</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-xs text-[var(--signal-dim)]/70 font-mono">No target configured for this workspace session.</p>
                                                <a
                                                    href="/onboarding"
                                                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--aerospace)] hover:underline"
                                                    onClick={onClose}
                                                >
                                                    Configure a Target System <ChevronRight className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* BILLING TAB */}
                            {activeTab === 'billing' && (
                                <div className="space-y-6">
                                    <div className="border border-white/10 bg-black/40 p-4 rounded-sm">
                                        <h3 className="mono-small text-[var(--signal)] font-bold uppercase tracking-wider mb-2">Active Plan</h3>
                                        <p className="text-xs font-mono text-[var(--signal-dim)] mb-4">
                                            Your account is currently running on the <strong className="text-[var(--aerospace)]">{formattedTier}</strong>.
                                        </p>
                                        <div className="p-3 border border-white/15 bg-white/[0.02] rounded-sm">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <span className="text-xs font-bold text-[var(--signal)] font-mono block">Billing Portal (Stripe)</span>
                                                    <span className="text-[10px] text-[var(--signal-dim)] font-mono">Manage payment methods, invoices, and active plans.</span>
                                                </div>
                                                <a
                                                    href="/pricing"
                                                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] tracking-wider uppercase rounded-sm transition-all"
                                                    onClick={onClose}
                                                >
                                                    View pricing
                                                </a>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-white/10 bg-black/40 p-4 rounded-sm space-y-3">
                                        <h3 className="mono-small text-[var(--signal)] font-bold uppercase tracking-wider">Subscription Tiers</h3>
                                        <div className="space-y-2 text-xs font-mono">
                                            <div className="flex justify-between py-1.5 border-b border-white/5">
                                                <span className="text-[var(--signal)]">Self-Serve Dry Run</span>
                                                <span className="text-[var(--signal-dim)]">Free ($0/mo)</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 border-b border-white/5">
                                                <span className="text-[var(--signal)]">Pro Tier</span>
                                                <span className="text-[var(--signal-dim)]">$49/mo</span>
                                            </div>
                                            <div className="flex justify-between py-1.5 border-b border-white/5">
                                                <span className="text-[var(--signal)]">Team Tier</span>
                                                <span className="text-[var(--signal-dim)]">$199/mo</span>
                                            </div>
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-[var(--signal)]">Level 7 / 8 Certified</span>
                                                <span className="text-[var(--aerospace)]">Custom scoping</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FAQS & ONBOARDING TAB */}
                            {activeTab === 'faq' && (
                                <div className="space-y-6">
                                    {/* Onboarding Guide */}
                                    <div className="border border-white/10 bg-black/40 p-4 rounded-sm">
                                        <h3 className="mono-small text-[var(--signal)] font-bold uppercase tracking-wider mb-3">Quickstart Onboarding Guide</h3>
                                        <ol className="space-y-3 text-xs font-mono list-decimal pl-4 text-[var(--signal-dim)]">
                                            <li>
                                                <strong className="text-[var(--signal)]">Setup a Target:</strong> Go to the onboarding form and specify the API endpoint or application URL you wish to test.
                                            </li>
                                            <li>
                                                <strong className="text-[var(--signal)]">Select Threat Batteries:</strong> Choose the adversarial tests to execute. Batteries include prompt-injection defenses (B10), adversarial safety checks (B11-B13), and indirect document extractions (B14).
                                            </li>
                                            <li>
                                                <strong className="text-[var(--signal)]">Initiate Sequence:</strong> Run the dry-run simulation (offline mode) or verify waivers to trigger live-fire runs.
                                            </li>
                                            <li>
                                                <strong className="text-[var(--signal)]">Download signed evidence:</strong> Once passed, export the signed receipt JSON or MD reports to prove the system has passed the gate.
                                            </li>
                                        </ol>
                                    </div>

                                    {/* FAQs Section */}
                                    <div className="space-y-4">
                                        <h3 className="mono-small text-[var(--signal)] font-bold uppercase tracking-wider">Frequently Asked Questions</h3>

                                        <div className="border border-white/5 bg-white/[0.01] p-3 rounded-sm">
                                            <h4 className="text-xs font-bold text-[var(--signal)] font-mono mb-1">What is the difference between simulation and live-fire?</h4>
                                            <p className="text-[11px] text-[var(--signal-dim)]/80 font-mono leading-relaxed">
                                                Simulation Mode (SIM_MODE=true) runs deterministic test scenarios with locally seeded adapters for educational and testing runs. Live Fire (SIM_MODE=false) initiates real attacks against the designated URL to stress-test your system boundaries.
                                            </p>
                                        </div>

                                        <div className="border border-white/5 bg-white/[0.01] p-3 rounded-sm">
                                            <h4 className="text-xs font-bold text-[var(--signal)] font-mono mb-1">How do I verify signed receipts and evidence files?</h4>
                                            <p className="text-[11px] text-[var(--signal-dim)]/80 font-mono leading-relaxed">
                                                All passed certified runs generate an attestation manifest. You can download the manifest along with verify.mjs, and verify the cryptographic signature against the ARMAGEDDON public key locally.
                                            </p>
                                        </div>

                                        <div className="border border-white/5 bg-white/[0.01] p-3 rounded-sm">
                                            <h4 className="text-xs font-bold text-[var(--signal)] font-mono mb-1">Is a credit card required to run dry tests?</h4>
                                            <p className="text-[11px] text-[var(--signal-dim)]/80 font-mono leading-relaxed">
                                                No, the basic dry-run sandbox tier is completely free and requires no credit cards to execute or verify locally.
                                            </p>
                                        </div>

                                        <div className="border border-white/5 bg-white/[0.01] p-3 rounded-sm">
                                            <h4 className="text-xs font-bold text-[var(--signal)] font-mono mb-1">How is my data handled during a run?</h4>
                                            <p className="text-[11px] text-[var(--signal-dim)]/80 font-mono leading-relaxed">
                                                ARMAGEDDON is fully PIPEDA and GDPR compliant. Code structures, payloads, and target records are processed in short-lived memory sandboxes and never retained post-run or used for training.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
