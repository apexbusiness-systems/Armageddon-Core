'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLANS, PLAN_ORDER, type PlanId } from '@/lib/pricing';
import { getCheckoutTarget, withCheckoutContext, type CheckoutContext, type CheckoutTarget } from '@/lib/payment-links';
import { resolveActiveOrg } from '@/lib/active-org';
import { useT } from '@/i18n/useT';
import type { PricingDictionary } from '@/i18n/types';

// Honest line under each CTA: payment not yet collectable (in-app fallback) vs.
// the manual workspace-upgrade promise after a real Stripe checkout. Enterprise
// is a scoped-program deposit, not a workspace upgrade, so it gets no upgrade
// promise. null = no note (the line stays reserved for card alignment).
function checkoutNote(planId: PlanId, target: CheckoutTarget, t: PricingDictionary): string | null {
    if (target.paymentPending) return t.checkoutPendingNote;
    if (target.external && planId !== 'enterprise') return t.checkoutFulfilmentNote;
    return null;
}

export default function PricingPageClient() {
    const { dictionary } = useT();
    const t = dictionary.pricing;
    // Signed-in buyers get their org UUID + email attached to Stripe checkout so
    // the payment maps to their workspace. Resolved after mount: the static HTML
    // always carries the plain Payment Links, which work for anonymous buyers.
    const [checkoutContext, setCheckoutContext] = useState<CheckoutContext>({});

    useEffect(() => {
        let cancelled = false;
        resolveActiveOrg()
            .then((org) => {
                if (!cancelled && org.ok) setCheckoutContext({ orgId: org.organizationId, email: org.email });
            })
            .catch(() => {
                // Offline or backend unavailable: keep the plain Payment Links.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <main className="relative min-h-screen bg-[var(--void)] text-[var(--signal)] px-4 py-20">
            <div className="max-w-6xl mx-auto">
                <header className="text-center mb-14">
                    <p className="mono-small text-[var(--aerospace)] tracking-[0.3em] mb-4">ARMAGEDDON TEST SUITE</p>
                    <h1 className="display-medium text-signal mb-6 max-w-3xl mx-auto leading-tight">
                        {t.headline}
                    </h1>
                    <p className="text-signal/80 max-w-2xl mx-auto text-base leading-relaxed">
                        {t.subheadline}
                    </p>
                </header>

                <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Pricing plans">
                    {PLAN_ORDER.map((planId) => {
                        const plan = PLANS[planId];
                        const planCopy = t.plans[planId];
                        const target = getCheckoutTarget(planId);
                        const note = checkoutNote(planId, target, t);

                        return (
                            <div
                                key={plan.id}
                                className="pricing-card flex flex-col border border-white/10 rounded-sm p-6"
                            >
                                <div className="mb-4">
                                    <h2 className="mono-data text-signal tracking-wider text-lg">{planCopy.name}</h2>
                                    <p className="mt-1 text-signal/60 text-sm leading-snug">{planCopy.tagline}</p>
                                </div>

                                <div className="mb-5 flex items-baseline gap-2">
                                    <span
                                        className={`font-bold text-signal whitespace-nowrap ${
                                            plan.price.length > 12 ? 'text-2xl' : 'text-3xl'
                                        }`}
                                    >
                                        {plan.price}
                                    </span>
                                    {planCopy.cadenceLabel && (
                                        <span className="mono-small text-signal/60 whitespace-nowrap">{planCopy.cadenceLabel}</span>
                                    )}
                                </div>

                                <ul className="flex-1 space-y-2 mb-6">
                                    {planCopy.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm text-signal/80">
                                            <span aria-hidden="true" className="text-[var(--safe)] mt-0.5">▸</span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {target.external ? (
                                    <a
                                        href={withCheckoutContext(target.href, checkoutContext)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-primary w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                                    >
                                        {planCopy.ctaLabel}
                                    </a>
                                ) : (
                                    <Link
                                        href={target.href}
                                        className="btn-primary w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                                    >
                                        {planCopy.ctaLabel}
                                    </Link>
                                )}

                                <p className={`mt-3 mono-small text-signal/50 text-center text-[10px] ${note ? '' : 'invisible'}`}>
                                    {note ?? t.checkoutPendingNote}
                                </p>
                            </div>
                        );
                    })}
                </section>

                <p className="mt-12 max-w-3xl mx-auto text-center text-signal/60 text-sm leading-relaxed border-t border-white/10 pt-8">
                    {t.safety}
                </p>

                <div className="mt-8 text-center">
                    <Link
                        href="/intake?tier=enterprise"
                        className="mono-small text-[var(--aerospace)] hover:text-white underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]"
                    >
                        {t.enterpriseLinkLabel}
                    </Link>
                </div>
            </div>
        </main>
    );
}
