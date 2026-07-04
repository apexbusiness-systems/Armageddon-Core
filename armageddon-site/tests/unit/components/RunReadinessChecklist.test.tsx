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
            { id: 'org', label: 'Workspace membership active', ready: false, detail: 'Sign in with an organization account.', required: true },
            { id: 'backend', label: 'Live backend connected', ready: false, detail: 'Backend is not configured.', required: true },
        ];
        render(<RunReadinessChecklist items={items} />);
        expect(screen.getByText('Blocked: Workspace membership active, Live backend connected.')).toBeInTheDocument();
        expect(remainingReadinessBlockers(items)).toEqual(['Workspace membership active', 'Live backend connected']);
    });

    it('renders all-ready state', () => {
        render(<RunReadinessChecklist items={allReady} />);
        expect(screen.getByText('Ready to start')).toBeInTheDocument();
        expect(remainingReadinessBlockers(allReady)).toEqual([]);
    });

    it('shows guided remediation for setup blockers', () => {
        const items: ReadinessItem[] = [
            { id: 'target', label: 'Target configured', ready: false, detail: 'Choose the app, API, or agent endpoint Armageddon should test.', required: true, ctaLabel: 'Set target', ctaHref: '/onboarding#target-config' },
            { id: 'org', label: 'Workspace membership active', ready: false, detail: 'Your account is signed in, but it has not been added to a workspace yet.', required: true, whatItMeans: 'A workspace is required so runs, evidence, permissions, and billing are tied to the correct organization.', nextStep: 'Ask an admin to add your login email to an organization, then refresh this page.', technicalDetail: 'No organization_members row was found for this Supabase user.' },
            { id: 'backend', label: 'Live backend connected', ready: false, detail: 'The live Armageddon backend is not connected in this build.', required: true, whatItMeans: 'This deployment can save local setup, but it cannot start real runs until NEXT_PUBLIC_ARMAGEDDON_API_BASE is configured at build time.' },
            { id: 'access', label: 'Test access verified', ready: false, detail: 'Your current account or plan cannot start this test set yet.', required: true, ctaLabel: 'View pricing', ctaHref: '/pricing' },
            { id: 'signing', label: 'Evidence signing key unavailable', ready: false, detail: 'Runs may start, but signed verification artifacts are unavailable until ARMAGEDDON_ATTESTATION_SEED is configured.', required: false },
        ];
        render(<RunReadinessChecklist items={items} />);
        expect(screen.getByText('Set target')).toHaveAttribute('href', '/onboarding#target-config');
        expect(screen.getByText('Your account is signed in, but it has not been added to a workspace yet.')).toBeInTheDocument();
        expect(screen.getByText(/NEXT_PUBLIC_ARMAGEDDON_API_BASE/)).toBeInTheDocument();
        expect(screen.getByText('Your current account or plan cannot start this test set yet.')).toBeInTheDocument();
        expect(screen.getByText('Evidence signing key unavailable')).toBeInTheDocument();
    });
});
