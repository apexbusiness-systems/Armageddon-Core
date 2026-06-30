export interface ReadinessItem {
    readonly id: string;
    readonly label: string;
    readonly ready: boolean;
    readonly detail: string;
    readonly required: boolean;
    readonly whatItMeans?: string;
    readonly whyItMatters?: string;
    readonly nextStep?: string;
    readonly ctaLabel?: string;
    readonly ctaHref?: string;
    readonly technicalDetail?: string;
}

interface RunReadinessChecklistProps {
    readonly items: readonly ReadinessItem[];
    readonly title?: string;
    readonly allReadyLabel?: string;
    readonly blockedPrefix?: string;
}

export function remainingReadinessBlockers(items: readonly ReadinessItem[]): readonly string[] {
    return items.filter((item) => item.required && !item.ready).map((item) => item.label);
}

function readinessSummary(blockers: readonly string[]): string {
    if (blockers.length === 0) return 'All required setup checks are complete.';
    const hasBackendBlocker = blockers.some((blocker) => blocker.toLowerCase().includes('backend'));
    if (hasBackendBlocker) return 'Backend unavailable';
    return 'Setup incomplete';
}

export default function RunReadinessChecklist({
    items,
    title = 'Run Readiness Checklist',
    allReadyLabel = 'Ready to start',
    blockedPrefix = 'Blocked: ',
}: RunReadinessChecklistProps) {
    const blockers = remainingReadinessBlockers(items);
    return (
        <section className="mt-4 border border-white/10 bg-black/40 p-4 rounded-sm text-left" aria-label="Run readiness checklist">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="mono-small text-signal/60 tracking-widest uppercase">{title}</p>
                    <p className={blockers.length === 0 ? 'mono-small text-[var(--safe)] mt-1' : 'mono-small text-amber-300 mt-1'}>
                        {blockers.length === 0 ? allReadyLabel : `${blockedPrefix}${blockers.join(', ')}.`}
                    </p>
                    <p className="mono-small text-signal/60 mt-1">
                        {readinessSummary(blockers)}
                    </p>
                </div>
            </div>
            <ul className="mt-4 space-y-2">
                {items.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                        <span className={item.ready ? 'text-[var(--safe)]' : 'text-amber-300'} aria-hidden="true">
                            {item.ready ? '✓' : '!' }
                        </span>
                        <span className="flex-1">
                            <span className="mono-data text-signal block">{item.label}</span>
                            <span className="mono-small text-signal/70 block">{item.detail}</span>
                            {item.whatItMeans && <span className="mono-small text-signal/60 block mt-1">What it means: {item.whatItMeans}</span>}
                            {item.whyItMatters && <span className="mono-small text-signal/60 block">Why it matters: {item.whyItMatters}</span>}
                            {item.nextStep && <span className="mono-small text-signal/80 block">Next step: {item.nextStep}</span>}
                            {item.ctaLabel && item.ctaHref && (
                                <a href={item.ctaHref} className="mono-small text-[var(--aerospace)] underline underline-offset-4 inline-block mt-1">{item.ctaLabel}</a>
                            )}
                            {item.technicalDetail && <span className="mono-small text-signal/40 block mt-1">Admin detail: {item.technicalDetail}</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
