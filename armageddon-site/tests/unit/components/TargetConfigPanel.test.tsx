// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TargetConfigPanel from '@/components/TargetConfigPanel';

// Render framer-motion elements as plain DOM (no animation gating in tests).
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_t: Record<string, unknown>, prop: string) => {
        const C = React.forwardRef<HTMLElement, Record<string, unknown>>(
          (props, ref) => {
            const { initial, animate, exit, transition, whileInView, viewport, ...rest } =
              props;
            return React.createElement(prop, { ...rest, ref });
          }
        );
        C.displayName = `Motion${String(prop)}`;
        return C;
      },
    }
  ),
}));

// Render next/link as a plain anchor so href assertions are router-context free.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement('a', { href, ...rest }, children),
}));

const DRAFT_KEY = 'armageddon:onboarding-draft';

describe('TargetConfigPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the unconfigured state with an onboarding link when no draft exists', async () => {
    render(<TargetConfigPanel />);
    expect(await screen.findByText('NO TARGET CONFIGURED')).toBeInTheDocument();
    expect(screen.getByText('Configure target').closest('a')).toHaveAttribute(
      'href',
      '/onboarding'
    );
  });

  it('renders the locked state with system name and URL when a valid draft exists', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        targetUrl: 'https://acme.test',
        targetSystemName: 'Checkout API',
        environment: 'staging',
      })
    );
    render(<TargetConfigPanel />);
    expect(await screen.findByText('TARGET LOCKED')).toBeInTheDocument();
    expect(screen.getByText('Checkout API')).toBeInTheDocument();
    expect(screen.getByText('https://acme.test')).toBeInTheDocument();
    expect(screen.getByText('EDIT →').closest('a')).toHaveAttribute('href', '/onboarding');
  });

  it('treats a draft with an empty targetUrl as not configured', async () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ targetUrl: '   ', targetSystemName: 'Ghost', environment: 'staging' })
    );
    render(<TargetConfigPanel />);
    expect(await screen.findByText('NO TARGET CONFIGURED')).toBeInTheDocument();
    expect(screen.queryByText('TARGET LOCKED')).not.toBeInTheDocument();
  });
});
