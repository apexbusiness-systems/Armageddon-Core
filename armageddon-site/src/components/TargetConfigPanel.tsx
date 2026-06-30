import Link from 'next/link';
import type { CodebaseTarget, OnboardingDraft } from '@/lib/codebase-target';

interface TargetConfigPanelProps {
    readonly target: CodebaseTarget | null;
    readonly draft: Pick<OnboardingDraft, 'environment' | 'authorizationConfirmed'> | null;
}

export default function TargetConfigPanel({ target, draft }: TargetConfigPanelProps) {
    const href = '/onboarding#target-config';
    if (!target) {
        return (
            <section className="mt-8 border border-white/10 bg-black/40 p-4 rounded-sm text-left" aria-label="Target configuration">
                <p className="mono-small text-signal/60 tracking-widest uppercase">Step 1: Target Configuration</p>
                <h3 className="mono-data text-amber-300 mt-2">No target configured</h3>
                <p className="mono-small text-signal/70 mt-2">
                    Connect the deployed app URL, API endpoint, or LLM/agent endpoint that ARMAGEDDON should test.
                </p>
                <Link href={href} className="btn-secondary inline-block mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                    Set Target
                </Link>
            </section>
        );
    }

    return (
        <section className="mt-8 border border-white/10 bg-black/40 p-4 rounded-sm text-left" aria-label="Target configuration">
            <p className="mono-small text-signal/60 tracking-widest uppercase">Step 1: Target Configuration</p>
            <dl className="mt-3 space-y-3">
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">Target name</dt>
                    <dd className="mono-data text-signal">{target.label}</dd>
                </div>
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">Target URL</dt>
                    <dd className="mono-data text-signal break-all">{target.endpointUrl}</dd>
                </div>
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">Environment</dt>
                    <dd className="mono-data text-signal uppercase">{draft?.environment ?? 'staging'}</dd>
                </div>
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">Authorization status</dt>
                    <dd className={draft?.authorizationConfirmed ? 'mono-data text-[var(--safe)]' : 'mono-data text-amber-300'}>
                        {draft?.authorizationConfirmed ? 'Authorized use confirmed' : 'Authorization confirmation required'}
                    </dd>
                </div>
            </dl>
            <Link href={href} className="btn-secondary inline-block mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                Edit Target
            </Link>
        </section>
    );
}
