'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { PlanId } from '@/lib/pricing';
import { PLANS, PLAN_ORDER } from '@/lib/pricing';
import { apiFetch, isApiConfigured } from '@/lib/runtime-api';
import { useT } from '@/i18n/useT';
import {
    DRAFT_KEY,
    createEndpointTarget,
    saveCodebaseTarget,
    validateTargetEndpointUrl,
    type CodebaseTarget,
    type OnboardingDraft,
    type TargetEnv,
} from '@/lib/codebase-target';

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
    codebaseTarget: null,
};

export default function OnboardingPage() {
    const router = useRouter();
    const { dictionary } = useT();
    const t = dictionary.onboarding;
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
            const restoredDraft = { ...EMPTY_DRAFT, ...restored, tier };
            setDraft(restoredDraft);
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
        if (d.targetUrl.trim() === '') found.push('Target endpoint URL is required.');
        if (!d.authorizationConfirmed) found.push('You must confirm you are authorized to test the target.');
        if (!d.acceptableUseAck) found.push('You must acknowledge the acceptable use policy.');
        return found;
    };

    const prepareBackendIntake = async (target: CodebaseTarget): Promise<CodebaseTarget> => {
        if (!isApiConfigured()) return target;
        try {
            const res = await apiFetch('/api/codebases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceType: 'endpoint',
                    targetEndpoint: target.endpointUrl,
                    label: target.label,
                    targetSystemName: draft.targetSystemName.trim(),
                    environment: draft.environment,
                }),
            });
            if (!res.ok) return target;
            const data = (await res.json()) as { codebaseId?: string; intakeId?: string };
            return { ...target, status: data.codebaseId || data.intakeId ? 'ready' : target.status, updatedAt: new Date().toISOString() };
        } catch {
            return target;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const found = validate(draft);
        setErrors(found);
        if (found.length > 0) return;

        let persistedDraft = draft;
        if (draft.codebaseTarget) {
            const target = await prepareBackendIntake(draft.codebaseTarget);
            persistedDraft = { ...draft, codebaseTarget: target, targetUrl: target.endpointUrl };
            try {
                saveCodebaseTarget(target);
            } catch {
                /* ignore */
            }
        }

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(persistedDraft));
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
                    <h1 className="text-xl font-mono text-signal mb-3 tracking-widest uppercase">{t.backendPending.title}</h1>
                    <p className="text-signal/80 text-sm mb-6">
                        {t.backendPending.body}
                    </p>
                    <div className="flex flex-col gap-3">
                        <Link href="/pricing" className="btn-primary w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                            {t.backendPending.viewPricing}
                        </Link>
                        <Link href={`/intake?tier=${draft.tier}`} className="btn-secondary w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                            {t.backendPending.requestScopedRun}
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
                <h1 className="text-2xl font-mono text-signal mb-2 tracking-widest uppercase">{t.title}</h1>
                <p className="mono-small text-signal/70 mb-6">
                    {t.planPrefix}: <span className="text-[var(--aerospace)]">{selectedPlan.name}</span>
                    {paymentPending && <span className="text-amber-400"> · {t.paymentPending}</span>}
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
                    <Field id="orgName" label={t.fields.orgName}>
                        <input id="orgName" type="text" required value={draft.orgName}
                            onChange={(e) => update('orgName', e.target.value)} className={inputClass} placeholder="ACME Corp" />
                    </Field>

                    <Field id="contactEmail" label={t.fields.contactEmail}>
                        <input id="contactEmail" type="email" required value={draft.contactEmail}
                            onChange={(e) => update('contactEmail', e.target.value)} className={inputClass} placeholder="security@acme.com" />
                    </Field>

                    <Field id="tier" label={t.fields.tier}>
                        <select id="tier" value={draft.tier}
                            onChange={(e) => update('tier', e.target.value as PlanId)} className={selectClass}>
                            {PLAN_ORDER.map((id) => (
                                <option key={id} value={id}>{PLANS[id].name}</option>
                            ))}
                        </select>
                    </Field>

                    <Field id="targetSystemName" label={t.fields.targetSystemName}>
                        <input id="targetSystemName" type="text" required value={draft.targetSystemName}
                            onChange={(e) => update('targetSystemName', e.target.value)} className={inputClass} placeholder="Checkout API" />
                        <p className="mono-small text-signal/60 mt-2">{t.help.targetSystemName}</p>
                    </Field>

                    <Field id="targetUrl" label="Target endpoint URL">
                        <input id="targetUrl" type="text" required value={draft.targetUrl}
                            onChange={(e) => update('targetUrl', e.target.value)} className={inputClass} placeholder="https://your-system.example.com/endpoint" />
                    </Field>

                    <Field id="environment" label={t.fields.environment}>
                        <select id="environment" value={draft.environment}
                            onChange={(e) => update('environment', e.target.value as TargetEnv)} className={selectClass}>
                            <option value="local">{t.environmentOptions.local}</option>
                            <option value="staging">{t.environmentOptions.staging}</option>
                            <option value="production">{t.environmentOptions.production}</option>
                        </select>
                    </Field>

                    <label htmlFor="authorizationConfirmed" className="flex items-start gap-3 cursor-pointer">
                        <input id="authorizationConfirmed" type="checkbox" checked={draft.authorizationConfirmed}
                            onChange={(e) => update('authorizationConfirmed', e.target.checked)} className="mt-1" />
                        <span className="mono-small text-signal/80">
                            {t.authorizationLabel}
                            <span className="block text-signal/60 mt-1">{t.help.authorization}</span>
                        </span>
                    </label>

                    <label htmlFor="acceptableUseAck" className="flex items-start gap-3 cursor-pointer">
                        <input id="acceptableUseAck" type="checkbox" checked={draft.acceptableUseAck}
                            onChange={(e) => update('acceptableUseAck', e.target.checked)} className="mt-1" />
                        <span className="mono-small text-signal/80">
                            {t.acceptableUseLabel}
                        </span>
                    </label>

                    <button type="submit"
                        className="w-full mt-2 bg-[var(--aerospace)] hover:bg-white text-black font-bold font-mono py-4 uppercase tracking-[0.2em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                        {t.submit}
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
