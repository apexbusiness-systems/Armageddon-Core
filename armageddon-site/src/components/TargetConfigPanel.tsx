import Link from 'next/link';
import type { CodebaseTarget, OnboardingDraft } from '@/lib/codebase-target';

export interface TargetConfigPanelLabels {
    readonly stepLabel: string;
    readonly noTargetTitle: string;
    readonly noTargetDesc: string;
    readonly setTarget: string;
    readonly targetNameLabel: string;
    readonly targetUrlLabel: string;
    readonly environmentLabel: string;
    readonly authorizationStatusLabel: string;
    readonly authorizedConfirmed: string;
    readonly authorizationRequired: string;
    readonly editTarget: string;
}

const DEFAULT_LABELS: TargetConfigPanelLabels = {
    stepLabel: 'Step 1: Target Configuration',
    noTargetTitle: 'No target configured',
    noTargetDesc: 'Connect the deployed app URL, API endpoint, or LLM/agent endpoint that ARMAGEDDON should test.',
    setTarget: 'Set Target',
    targetNameLabel: 'Target name',
    targetUrlLabel: 'Target URL',
    environmentLabel: 'Environment',
    authorizationStatusLabel: 'Authorization status',
    authorizedConfirmed: 'Authorized use confirmed',
    authorizationRequired: 'Authorization confirmation required',
    editTarget: 'Edit Target',
};

interface TargetConfigPanelProps {
    readonly target: CodebaseTarget | null;
    readonly draft: Pick<OnboardingDraft, 'environment' | 'authorizationConfirmed'> | null;
    readonly labels?: TargetConfigPanelLabels;
}

export default function TargetConfigPanel({ target, draft, labels = DEFAULT_LABELS }: TargetConfigPanelProps) {
    const href = '/onboarding#target-config';
    if (!target) {
        return (
            <section className="mt-8 border border-white/10 bg-black/40 p-4 rounded-sm text-left" aria-label="Target configuration">
                <p className="mono-small text-signal/60 tracking-widest uppercase">{labels.stepLabel}</p>
                <h3 className="mono-data text-amber-300 mt-2">{labels.noTargetTitle}</h3>
                <p className="mono-small text-signal/70 mt-2">
                    {labels.noTargetDesc}
                </p>
                <Link href={href} className="btn-secondary inline-block mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                    {labels.setTarget}
                </Link>
            </section>
        );
    }

    return (
        <section className="mt-8 border border-white/10 bg-black/40 p-4 rounded-sm text-left" aria-label="Target configuration">
            <p className="mono-small text-signal/60 tracking-widest uppercase">{labels.stepLabel}</p>
            <dl className="mt-3 space-y-3">
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">{labels.targetNameLabel}</dt>
                    <dd className="mono-data text-signal">{target.label}</dd>
                </div>
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">{labels.targetUrlLabel}</dt>
                    <dd className="mono-data text-signal break-all">{target.endpointUrl}</dd>
                </div>
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">{labels.environmentLabel}</dt>
                    <dd className="mono-data text-signal uppercase">{draft?.environment ?? 'staging'}</dd>
                </div>
                <div>
                    <dt className="mono-small text-zinc-500 uppercase">{labels.authorizationStatusLabel}</dt>
                    <dd className={draft?.authorizationConfirmed ? 'mono-data text-[var(--safe)]' : 'mono-data text-amber-300'}>
                        {draft?.authorizationConfirmed ? labels.authorizedConfirmed : labels.authorizationRequired}
                    </dd>
                </div>
            </dl>
            <Link href={href} className="btn-secondary inline-block mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aerospace)]">
                {labels.editTarget}
            </Link>
        </section>
    );
}
