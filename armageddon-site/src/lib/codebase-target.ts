import type { PlanId } from '@/lib/pricing';

export type CodebaseTargetKind = 'endpoint';
export type CodebaseTargetStatus = 'ready' | 'local-only' | 'invalid';
export type TargetEnv = 'local' | 'staging' | 'production';

export interface CodebaseTarget {
    readonly id: string;
    readonly kind: CodebaseTargetKind;
    readonly status: CodebaseTargetStatus;
    readonly label: string;
    readonly endpointUrl: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface OnboardingDraft {
    readonly orgName: string;
    readonly contactEmail: string;
    readonly tier: PlanId;
    readonly targetSystemName: string;
    readonly targetUrl: string;
    readonly environment: TargetEnv;
    readonly authorizationConfirmed: boolean;
    readonly acceptableUseAck: boolean;
    readonly codebaseTarget: CodebaseTarget | null;
}

export const DRAFT_KEY = 'armageddon:onboarding-draft';
export const CODEBASE_TARGET_KEY = 'armageddon:codebase-target';

const HTTP_ENDPOINT_PATTERN = /^https?:\/\/.+/;

function nowIso(): string {
    return new Date().toISOString();
}

function targetId(): string {
    const array = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(array);
    return `endpoint-${Date.now().toString(36)}-${array[0]?.toString(36) ?? '0'}`;
}

export function validateTargetEndpointUrl(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed === '') return 'Target endpoint or app URL is required.';
    if (!HTTP_ENDPOINT_PATTERN.test(trimmed)) return 'Enter an HTTPS target endpoint or deployed app URL.';
    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Enter an HTTPS target endpoint or deployed app URL.';
    } catch {
        return 'Enter a valid target endpoint or deployed app URL.';
    }
    return null;
}

export function createEndpointTarget(endpointUrl: string, label: string): CodebaseTarget {
    const timestamp = nowIso();
    return {
        id: targetId(),
        kind: 'endpoint',
        status: 'local-only',
        label: label.trim() || 'System under test',
        endpointUrl: endpointUrl.trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

export function parseCodebaseTarget(raw: string | null): CodebaseTarget | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Omit<Partial<CodebaseTarget>, 'kind'> & { readonly repositoryUrl?: string; readonly kind?: string };
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.kind === 'endpoint' && typeof parsed.endpointUrl === 'string') {
            return parsed as CodebaseTarget;
        }
        // Backward-compatible migration for client drafts saved by the previous
        // repository-labelled UI. The runtime still consumes an endpoint URL, so
        // normalize the old shape to the current target endpoint model.
        if (parsed.kind === 'repository' && typeof parsed.repositoryUrl === 'string') {
            return createEndpointTarget(parsed.repositoryUrl, typeof parsed.label === 'string' ? parsed.label : 'System under test');
        }
    } catch {
        return null;
    }
    return null;
}

export function readSavedCodebaseTarget(storage: Pick<Storage, 'getItem'> = localStorage): CodebaseTarget | null {
    return parseCodebaseTarget(storage.getItem(CODEBASE_TARGET_KEY));
}

export function saveCodebaseTarget(target: CodebaseTarget, storage: Pick<Storage, 'setItem'> = localStorage): void {
    storage.setItem(CODEBASE_TARGET_KEY, JSON.stringify(target));
}

export function targetSummary(target: CodebaseTarget): string {
    return `${target.label}: ${target.endpointUrl}`;
}

export type TargetReadinessCode = 'missing' | 'invalid';

export function canStartRunForTarget(target: CodebaseTarget | null): { readonly ok: true } | { readonly ok: false; readonly code: TargetReadinessCode } {
    if (!target) return { ok: false, code: 'missing' };
    if (target.status === 'invalid') return { ok: false, code: 'invalid' };
    return { ok: true };
}
