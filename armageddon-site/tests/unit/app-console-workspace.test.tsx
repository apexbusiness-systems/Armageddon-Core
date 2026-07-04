// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConsolePage from '@/app/console/page';

vi.mock('@/components/DestructionConsole', () => ({ default: () => <section>Run Readiness Checklist Initiate Sequence Destruction Console</section> }));

describe('console workspace', () => {
    it('renders operational UI without public marketing sections', () => {
        render(<ConsolePage />);
        expect(screen.getByText(/Run Readiness Checklist/)).toBeInTheDocument();
        expect(screen.getByText(/Initiate Sequence/)).toBeInTheDocument();
        expect(screen.queryByText('The 13 Batteries')).not.toBeInTheDocument();
        expect(screen.queryByText('Compliance is a checklist')).not.toBeInTheDocument();
        expect(screen.queryByText('Start Testing')).not.toBeInTheDocument();
        expect(screen.queryByText('Certification Artifact')).not.toBeInTheDocument();
    });
});
