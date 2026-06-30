// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RunReadinessChecklist, { remainingReadinessBlockers, type ReadinessItem } from '@/components/RunReadinessChecklist';

const allReady: ReadinessItem[] = [
    { id: 'target', label: 'Target configured', ready: true, detail: 'Target saved.', required: true },
    { id: 'auth', label: 'Authorized use confirmed', ready: true, detail: 'Authorization confirmed.', required: true },
];

describe('RunReadinessChecklist', () => {
    it('renders incomplete state with exact blockers', () => {
        const items: ReadinessItem[] = [
            ...allReady.slice(0, 1),
            { id: 'org', label: 'Organization membership active', ready: false, detail: 'Sign in with an organization account.', required: true },
            { id: 'backend', label: 'Backend connected', ready: false, detail: 'Backend is not configured.', required: true },
        ];
        render(<RunReadinessChecklist items={items} />);
        expect(screen.getByText('Blocked: Organization membership active, Backend connected.')).toBeInTheDocument();
        expect(remainingReadinessBlockers(items)).toEqual(['Organization membership active', 'Backend connected']);
    });

    it('renders all-ready state', () => {
        render(<RunReadinessChecklist items={allReady} />);
        expect(screen.getByText('All required checks are ready.')).toBeInTheDocument();
        expect(remainingReadinessBlockers(allReady)).toEqual([]);
    });
});
