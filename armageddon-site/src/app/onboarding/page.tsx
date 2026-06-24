'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { PlanId } from '@/lib/pricing';
import { PLANS, PLAN_ORDER } from '@/lib/pricing';
import { isApiConfigured } from '@/lib/runtime-api';

type TargetEnv = 'local' | 'staging' | 'production';

interface OnboardingDraft {
    orgName: string;
    contactEmail: string;
    tier: PlanId;
    targetSystemName: string;
    targetUrl: string;
    environment: TargetEnv;
    authorizationConfirmed: boolean;
    acceptableUseAck: boolean;
}

const DRAFT_KEY = 'armageddon:onboarding-draft';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlanId(value: string | null): value is PlanId {
    return value !== null && (PLAN_ORDER as readonly string[]).includes(value);
}

const EMPTY_DRAFT: OnboardingDraft = {
    orgName: '',
    contactEmail: '',
    tier: 'self-serve',
    targetSystemName: '',
    targetUrl: '',
    environment: 'staging',
    authorizationConfirmed: false,
    acceptableUseAck: false,
};

export default function OnboardingPage() {
    const router = useRouter();
    const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
    const [paymentPending, setPaymentPending] = useState(false);
    const [errors, setErrors] = useState<readonly string[]>([]);
    const [backendPending, setBackendPending] = useState(false);

    // Hydrate from saved draft + URL params (client-only → static-export safe).
    // Deferred to a microtask so the browser-state sync is not a synchronous
    // setState in the effect body, and never runs during SSR/hydration render.
    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            let restored: Partial<OnboardingDraft> = {};
            try {
                const raw = localStorage.getItem(DRAFT_KEY);
                if (raw) restored = JSON.parse(raw) as Partial<OnboardingDraft>;
            } catch {
                restored = {};
            }

            const params = new URLSearchParams(window.location.search);
            const tierParam = params.get('tier');
            const tier: PlanId = isPlanId(tierParam) ? tierParam : (restored.tier ?? 'self-serve');
            setPaymentPending(params.get('payment') === 'pending');
            setDraft({ ...EMPTY_DRAFT, ...restored, tier });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const selectedPlan = useMemo(() => PLANS[draft.tier], [draft.tier]);

    const update = <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
        setDraft((prev) => {
            const next = { ...prev, [key]: value };
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
            } catch {
                /* ignore quota / disabled storage */
            }
            return next;
        });
    };

    const validate = (d: OnboardingDraft): readonly string[] => {
        const found: string[] = [];
        if (d.orgName.trim() === '') found.push('Organization name is required.');
        if (!EMAIL_PATTERN.test(d.contactEmail.trim())) found.push('A valid contact email is required.');
        if (d.targetSystemName.trim() === '') found.push('Target system name is required.');
        if (d.targetUrl.trim() === '') found.push('Target URL or repository URL is required.');
        if (!d.authorizationConfirmed) found.push('You must confirm you are authorized to test the target.');
        if (!d.acceptableUseAck) found.push('You must acknowledge the acceptable use policy.');
        return found;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const found = validate(draft);
        setErrors(found);
        if (found.length > 0) return;

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            /* ignore */
        }

        const { tier } = draft;

        if (tier === 'enterprise') {
            router.push('/intake?tier=enterprise');
            return;
        }

        if (tier === 'verified' || tier === 'certified') {
            // Paid review tiers: never pretend payment is captured.
            router.push(`/intake?tier=${tier}&payment=pending`);
            return;
        }

        // self-serve / pro / team
        if (isApiConfigured()) {
            router.push('/console');
            return;
        }
        // No live backend on this deployment — be explicit, don't fake a run.
        setBackendPending(true);
    };

    if (backendPending) {
        return (
            <main className="min-h-screen grid-bg flex items-center justify-center p-6">
                <div className="max-w-md w-full border border-white/10 bg-black/80 p-8 rounded-sm text-center">
                    <h1 className="text-xl font-mono text-signal mb-3 tracking-widest uppercase">Draft saved</h1>
                    <p className="text-signal/80 text-sm mb-6">
                        Live runs aren&apos;t connected on this deployment yet. Your onboarding details are saved
                        locally. Choose a plan or request a scoped run to continue.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Link href="/pricing" className="btn-primary w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                            View pricing
                        </Link>
                        <Link href={`/intake?tier=${draft.tier}`} className="btn-secondary w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                            Request a scoped run
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen grid-bg flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg w-full border border-white/10 bg-black/80 p-8 rounded-sm"
            >
                <h1 className="text-2xl font-mono text-signal mb-2 tracking-widest uppercase">Onboarding Setup</h1>
                <p className="mono-small text-signal/70 mb-6">
                    Plan: <span className="text-[var(--aerospace)]">{selectedPlan.name}</span>
                    {paymentPending && <span className="text-amber-400"> · payment pending</span>}
                </p>

                {errors.length > 0 && (
                    <div className="mb-5 border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 p-3 rounded-sm">
                        <ul className="list-disc list-inside space-y-1">
                            {errors.map((err) => (
                                <li key={err} className="mono-small text-red-300">{err}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 form-control" noValidate>
                    <Field id="orgName" label="Organization Name">
                        <input id="orgName" type="text" required value={draft.orgName}
                            onChange={(e) => update('orgName', e.target.value)} className={inputClass} placeholder="ACME Corp" />
                    </Field>

                    <Field id="contactEmail" label="Contact Email">
                        <input id="contactEmail" type="email" required value={draft.contactEmail}
                            onChange={(e) => update('contactEmail', e.target.value)} className={inputClass} placeholder="security@acme.com" />
                    </Field>

                    <Field id="tier" label="Selected Tier">
                        <select id="tier" value={draft.tier}
                            onChange={(e) => update('tier', e.target.value as PlanId)} className={selectClass}>
                            {PLAN_ORDER.map((id) => (
                                <option key={id} value={id}>{PLANS[id].name}</option>
                            ))}
                        </select>
                    </Field>

                    <Field id="targetSystemName" label="Target System Name">
                        <input id="targetSystemName" type="text" required value={draft.targetSystemName}
                            onChange={(e) => update('targetSystemName', e.target.value)} className={inputClass} placeholder="Checkout API" />
                    </Field>

                    <Field id="targetUrl" label="Target URL or Repository URL">
                        <input id="targetUrl" type="text" required value={draft.targetUrl}
                            onChange={(e) => update('targetUrl', e.target.value)} className={inputClass} placeholder="https://… or git@…" />
                    </Field>

                    <Field id="environment" label="Environment">
                        <select id="environment" value={draft.environment}
                            onChange={(e) => update('environment', e.target.value as TargetEnv)} className={selectClass}>
                            <option value="local">Local</option>
                            <option value="staging">Staging</option>
                            <option value="production">Production</option>
                        </select>
                    </Field>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={draft.authorizationConfirmed}
                            onChange={(e) => update('authorizationConfirmed', e.target.checked)} className="mt-1" />
                        <span className="mono-small text-signal/80">
                            I confirm I am authorized to run adversarial tests against this target.
                        </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={draft.acceptableUseAck}
                            onChange={(e) => update('acceptableUseAck', e.target.checked)} className="mt-1" />
                        <span className="mono-small text-signal/80">
                            I acknowledge the acceptable use policy and that Armageddon produces evidence, not a guarantee.
                        </span>
                    </label>

                    <button type="submit"
                        className="w-full mt-2 bg-[var(--aerospace)] hover:bg-white text-black font-bold font-mono py-4 uppercase tracking-[0.2em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                        Continue
                    </button>
                </form>
            </motion.div>
        </main>
    );
}

const inputClass =
    'w-full bg-black/50 border border-white/20 p-3 font-mono text-white focus:border-signal outline-none rounded-sm transition-colors';
const selectClass =
    'w-full bg-black border border-white/20 p-3 font-mono text-white focus:border-signal outline-none rounded-sm appearance-none';

function Field({ id, label, children }: { readonly id: string; readonly label: string; readonly children: React.ReactNode }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-mono text-zinc-400 mb-2 uppercase tracking-wide">
                {label}
            </label>
            {children}
        </div>
    );
}
