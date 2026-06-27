// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TargetConfigPanel from '@/components/TargetConfigPanel';
import { createEndpointTarget } from '@/lib/codebase-target';

describe('TargetConfigPanel', () => {
    it('renders the empty state with Set Target CTA', () => {
        render(<TargetConfigPanel target={null} draft={null} />);
        expect(screen.getByText('Step 1: Target Configuration')).toBeInTheDocument();
        expect(screen.getByText('No target configured')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Set Target' })).toHaveAttribute('href', '/onboarding#target-config');
    });

    it('renders the configured target state with Edit Target CTA', () => {
        render(<TargetConfigPanel target={createEndpointTarget('https://app.example.com', 'Checkout API')} draft={{ environment: 'staging', authorizationConfirmed: true }} />);
        expect(screen.getByText('Checkout API')).toBeInTheDocument();
        expect(screen.getByText('https://app.example.com')).toBeInTheDocument();
        expect(screen.getByText('staging')).toBeInTheDocument();
        expect(screen.getByText('Authorized use confirmed')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Edit Target' })).toHaveAttribute('href', '/onboarding#target-config');
    });
});
