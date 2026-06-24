'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import {
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
    startGithubOAuth,
} from '@/lib/client-auth-actions';

export type AuthMode = 'signin' | 'signup';

interface AuthModalProps {
    readonly open: boolean;
    readonly mode: AuthMode;
    readonly initialError?: string | null;
    readonly onClose: () => void;
    readonly onModeChange: (mode: AuthMode) => void;
}

const MIN_PASSWORD = 6;

/**
 * Linear-time email validation. Uses deterministic structural checks instead of
 * a backtracking regex: trims input, bounds length, rejects whitespace/control
 * characters via a single char-code pass, then verifies exactly one `@`, a
 * non-empty local part, and a non-empty dotted domain.
 */
export function isSafeEmail(value: string): boolean {
    const email = value.trim();
    if (email.length < 3 || email.length > 254) return false;
    for (const ch of email) {
        const code = ch.codePointAt(0) ?? 0;
        if (code <= 0x20 || code === 0x7f) return false; // whitespace or control char
    }
    const at = email.indexOf('@');
    if (at <= 0) return false;
    if (at !== email.lastIndexOf('@')) return false;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (!local || local.length > 64) return false;
    if (!domain || domain.length > 253) return false;
    if (!domain.includes('.')) return false;
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
    if (domain.includes('..')) return false;
    return true;
}

type Feedback =
    | { readonly kind: 'none' }
    | { readonly kind: 'error'; readonly text: string }
    | { readonly kind: 'notice'; readonly text: string };

/**
 * Outer shell. The panel is mounted only while `open` is true, so its internal
 * state initializes fresh from props on every open (no state-syncing effects) and
 * resets automatically on close via unmount. AnimatePresence preserves the exit
 * animation across that unmount.
 */
export default function AuthModal({ open, mode, initialError, onClose, onModeChange }: AuthModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <AuthModalPanel
                    key="auth-modal-panel"
                    mode={mode}
                    initialError={initialError ?? null}
                    onClose={onClose}
                    onModeChange={onModeChange}
                />
            )}
        </AnimatePresence>
    );
}

interface PanelProps {
    readonly mode: AuthMode;
    readonly initialError: string | null;
    readonly onClose: () => void;
    readonly onModeChange: (mode: AuthMode) => void;
}

function AuthModalPanel({ mode, initialError, onClose, onModeChange }: PanelProps) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pending, setPending] = useState(false);
    // Seeded once from props on mount — no syncing effect required.
    const [feedback, setFeedback] = useState<Feedback>(() =>
        initialError ? { kind: 'error', text: initialError } : { kind: 'none' },
    );

    // Esc to close. The listener calls onClose from an event callback, so no
    // synchronous setState happens in the effect body.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        globalThis.addEventListener('keydown', onKey);
        return () => globalThis.removeEventListener('keydown', onKey);
    }, [onClose]);

    const isSignup = mode === 'signup';

    let submitLabel: string;
    if (pending) {
        submitLabel = 'Working…';
    } else if (isSignup) {
        submitLabel = 'Create Account';
    } else {
        submitLabel = 'Sign In';
    }

    const validate = useCallback((): string | null => {
        if (!isSafeEmail(email)) return 'Enter a valid email address.';
        if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
        return null;
    }, [email, password]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFeedback({ kind: 'none' });

        const validationError = validate();
        if (validationError) {
            setFeedback({ kind: 'error', text: validationError });
            return;
        }

        const sb = getSupabase();
        if (!sb) {
            setFeedback({ kind: 'error', text: 'Authentication is not configured on this deployment.' });
            return;
        }

        setPending(true);
        const result = isSignup
            ? await signUpWithEmail(sb, email.trim(), password)
            : await signInWithEmail(sb, email.trim(), password);
        setPending(false);

        if (!result.ok) {
            setFeedback({ kind: 'error', text: result.message });
            return;
        }
        if (result.notice) {
            setFeedback({ kind: 'notice', text: result.notice });
            return;
        }
        // Authenticated with an active session → into the console.
        onClose();
        router.replace('/console');
    };

    const handleMagicLink = async () => {
        setFeedback({ kind: 'none' });
        if (!isSafeEmail(email)) {
            setFeedback({ kind: 'error', text: 'Enter a valid email to receive a magic link.' });
            return;
        }
        const sb = getSupabase();
        if (!sb) {
            setFeedback({ kind: 'error', text: 'Authentication is not configured on this deployment.' });
            return;
        }
        setPending(true);
        const result = await signInWithMagicLink(sb, email.trim());
        setPending(false);
        setFeedback(result.ok
            ? { kind: 'notice', text: result.notice ?? 'Magic link sent.' }
            : { kind: 'error', text: result.message });
    };

    const handleGithub = async () => {
        setFeedback({ kind: 'none' });
        const sb = getSupabase();
        if (!sb) {
            setFeedback({ kind: 'error', text: 'Authentication is not configured on this deployment.' });
            return;
        }
        setPending(true);
        const result = await startGithubOAuth(sb, 'Login');
        // On success the browser navigates away; only reaches here on failure.
        if (!result.ok) {
            setPending(false);
            setFeedback({ kind: 'error', text: result.message });
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={isSignup ? 'Sign up' : 'Sign in'}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

            {/* Panel */}
            <motion.div
                className="relative w-full max-w-md border border-[var(--aerospace)]/40 bg-gradient-to-b from-[var(--void)] to-[var(--tungsten)] shadow-[0_0_60px_rgba(255,51,0,0.25)] overflow-hidden"
                initial={{ scale: 0.94, y: 24 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.94, y: 24 }}
                transition={{ duration: 0.25, ease: [0.25, 0.8, 0.25, 1] }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Scanline accent */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.07]">
                    <div className="absolute top-0 left-0 h-[2px] w-full bg-[var(--aerospace)] animate-[scanline_4s_linear_infinite]" />
                </div>
                {/* Corner brackets */}
                <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[var(--aerospace)]" />
                <span className="pointer-events-none absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[var(--aerospace)]" />
                <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[var(--aerospace)]" />
                <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[var(--aerospace)]" />

                <div className="relative p-8">
                    {/* Close */}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-4 right-4 text-[var(--signal-dim)] hover:text-[var(--aerospace)] transition-colors text-lg leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                    >
                        ✕
                    </button>

                    <p className="mono-small text-[var(--aerospace)] tracking-[0.4em] mb-1">ARMAGEDDON // ACCESS</p>
                    <h2 className="text-2xl font-mono text-[var(--signal)] tracking-wider uppercase mb-6">
                        {isSignup ? 'Create Account' : 'Sign In'}
                    </h2>

                    {/* Mode tabs */}
                    <div className="flex border border-white/10 mb-6">
                        <button
                            type="button"
                            onClick={() => onModeChange('signin')}
                            className={`flex-1 py-2.5 mono-small tracking-widest uppercase transition-colors ${
                                isSignup
                                    ? 'text-[var(--signal-dim)] hover:text-[var(--signal)]'
                                    : 'bg-[var(--aerospace)] text-black font-bold'
                            }`}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            onClick={() => onModeChange('signup')}
                            className={`flex-1 py-2.5 mono-small tracking-widest uppercase transition-colors ${
                                isSignup
                                    ? 'bg-[var(--aerospace)] text-black font-bold'
                                    : 'text-[var(--signal-dim)] hover:text-[var(--signal)]'
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div>
                            <label htmlFor="auth-email" className="block mono-small text-[var(--signal-dim)] uppercase tracking-wide mb-2">
                                Email
                            </label>
                            <input
                                id="auth-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="operator@domain.com"
                                className="w-full bg-black/50 border border-white/20 p-3 font-mono text-white placeholder:text-white/30 focus:border-[var(--aerospace)] outline-none rounded-sm transition-colors"
                            />
                        </div>

                        <div>
                            <label htmlFor="auth-password" className="block mono-small text-[var(--signal-dim)] uppercase tracking-wide mb-2">
                                Password
                            </label>
                            <input
                                id="auth-password"
                                type="password"
                                autoComplete={isSignup ? 'new-password' : 'current-password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-black/50 border border-white/20 p-3 font-mono text-white placeholder:text-white/30 focus:border-[var(--aerospace)] outline-none rounded-sm transition-colors"
                            />
                        </div>

                        {feedback.kind === 'error' && (
                            <div className="border border-red-500/50 bg-red-500/10 p-3 rounded-sm">
                                <p className="mono-small text-red-300 break-words">{feedback.text}</p>
                            </div>
                        )}
                        {feedback.kind === 'notice' && (
                            <div className="border border-[var(--safe)]/50 bg-[var(--safe)]/10 p-3 rounded-sm">
                                <p className="mono-small text-[var(--safe)] break-words">{feedback.text}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={pending}
                            className="w-full mt-2 bg-[var(--aerospace)] hover:bg-white text-black font-bold font-mono py-3.5 uppercase tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        >
                            {submitLabel}
                        </button>
                    </form>

                    {/* Alternative auth methods */}
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                        <button
                            type="button"
                            onClick={handleMagicLink}
                            disabled={pending}
                            className="w-full mono-small tracking-widest uppercase text-[var(--signal-dim)] hover:text-[var(--signal)] transition-colors disabled:opacity-50 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                        >
                            Email me a magic link instead
                        </button>
                        <button
                            type="button"
                            onClick={handleGithub}
                            disabled={pending}
                            className="w-full flex items-center justify-center gap-2 border border-white/20 bg-black/40 hover:border-[var(--signal)] text-[var(--signal)] font-mono py-3 uppercase tracking-widest text-sm transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                        >
                            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                            </svg>
                            Continue with GitHub
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
