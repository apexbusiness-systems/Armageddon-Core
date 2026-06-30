export interface ReadinessItem {
    readonly id: string;
    readonly label: string;
    readonly ready: boolean;
    readonly detail: string;
    readonly required: boolean;
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

export default function RunReadinessChecklist({
    items,
    title = 'Run Readiness Checklist',
    allReadyLabel = 'All required checks are ready.',
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
                </div>
            </div>
            <ul className="mt-4 space-y-2">
                {items.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                        <span className={item.ready ? 'text-[var(--safe)]' : 'text-amber-300'} aria-hidden="true">
                            {item.ready ? '✓' : '!' }
                        </span>
                        <span>
                            <span className="mono-data text-signal block">{item.label}</span>
                            <span className="mono-small text-signal/70 block">{item.detail}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
