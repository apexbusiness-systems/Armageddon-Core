import type { PlanId } from '@/lib/pricing';

export type CodebaseTargetKind = 'repository' | 'zip-archive';
export type CodebaseTargetStatus = 'ready' | 'local-only' | 'backend-required' | 'invalid';
export type TargetEnv = 'local' | 'staging' | 'production';

export interface CodebaseTargetBase {
    readonly id: string;
    readonly kind: CodebaseTargetKind;
    readonly status: CodebaseTargetStatus;
    readonly label: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface RepositoryCodebaseTarget extends CodebaseTargetBase {
    readonly kind: 'repository';
    readonly repositoryUrl: string;
    readonly backendCodebaseId?: string;
    readonly backendIntakeId?: string;
}

export interface ZipArchiveCodebaseTarget extends CodebaseTargetBase {
    readonly kind: 'zip-archive';
    readonly fileName: string;
    readonly fileSize: number;
    readonly mimeType: string;
}

export type CodebaseTarget = RepositoryCodebaseTarget | ZipArchiveCodebaseTarget;

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

const REPOSITORY_PATTERN = /^(https?:\/\/|git@|ssh:\/\/).+/;

function nowIso(): string {
    return new Date().toISOString();
}

function targetId(prefix: CodebaseTargetKind): string {
    const array = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(array);
    return `${prefix}-${Date.now().toString(36)}-${array[0]?.toString(36) ?? '0'}`;
}

export function validateRepositoryUrl(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed === '') return 'Repository URL is required.';
    if (!REPOSITORY_PATTERN.test(trimmed)) return 'Enter an HTTPS, SSH, or git repository URL.';
    return null;
}

export function createRepositoryTarget(repositoryUrl: string, label: string, backendIds?: { readonly codebaseId?: string; readonly intakeId?: string }): RepositoryCodebaseTarget {
    const timestamp = nowIso();
    return {
        id: targetId('repository'),
        kind: 'repository',
        status: backendIds?.codebaseId || backendIds?.intakeId ? 'ready' : 'local-only',
        label: label.trim() || 'Repository target',
        repositoryUrl: repositoryUrl.trim(),
        backendCodebaseId: backendIds?.codebaseId,
        backendIntakeId: backendIds?.intakeId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

export function createZipArchiveTarget(file: Pick<File, 'name' | 'size' | 'type'>, label: string): ZipArchiveCodebaseTarget {
    const timestamp = nowIso();
    return {
        id: targetId('zip-archive'),
        kind: 'zip-archive',
        status: 'backend-required',
        label: label.trim() || file.name,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/zip',
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

export function parseCodebaseTarget(raw: string | null): CodebaseTarget | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<CodebaseTarget>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.kind === 'repository' && typeof (parsed as Partial<RepositoryCodebaseTarget>).repositoryUrl === 'string') {
            return parsed as RepositoryCodebaseTarget;
        }
        if (parsed.kind === 'zip-archive' && typeof (parsed as Partial<ZipArchiveCodebaseTarget>).fileName === 'string') {
            return parsed as ZipArchiveCodebaseTarget;
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
    if (target.kind === 'repository') return `${target.label}: ${target.repositoryUrl}`;
    return `${target.label}: ${target.fileName} (${Math.ceil(target.fileSize / 1024)} KB, local metadata only)`;
}

export function canStartRunForTarget(target: CodebaseTarget | null): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    if (!target) return { ok: false, reason: 'Configure a repository or zip archive target in onboarding before starting a run.' };
    if (target.kind === 'zip-archive') {
        return { ok: false, reason: 'Zip archive analysis is blocked until real archive storage and ingestion are connected. Only local file metadata is saved.' };
    }
    if (target.status === 'invalid') return { ok: false, reason: 'The saved repository target is invalid. Return to onboarding and correct it.' };
    return { ok: true };
}
