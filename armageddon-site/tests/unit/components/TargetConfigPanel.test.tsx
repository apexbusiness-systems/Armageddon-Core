// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TargetConfigPanel from '@/components/TargetConfigPanel';

// Render framer-motion elements as plain DOM (no animation gating in tests).
// Components are cached per tag: like the real `motion.div`, the type must be
// stable across renders, or every re-render would remount (and detach) the DOM.
vi.mock('framer-motion', () => {
  const cache = new Map<string, React.ElementType>();
  return {
    motion: new Proxy(
      {},
      {
        get: (_t: Record<string, unknown>, prop: string) => {
          const cached = cache.get(prop);
          if (cached) return cached;
          const C = React.forwardRef<HTMLElement, Record<string, unknown>>(
            (props, ref) => {
              const { initial, animate, exit, transition, whileInView, viewport, ...rest } =
                props;
              return React.createElement(prop, { ...rest, ref });
            }
          );
          C.displayName = `Motion${String(prop)}`;
          cache.set(prop, C);
          return C;
        },
      }
    ),
  };
});

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

  it('reserves its box in the static (pre-hydration) HTML instead of rendering nothing (CLS)', () => {
    // Server/static render never runs effects, so this is the pre-hydration markup.
    // Rendering null here made hydration insert the panel and shift the page.
    const html = renderToString(<TargetConfigPanel />);
    expect(html).toContain('NO TARGET CONFIGURED');
    expect(html).toContain('invisible');
    expect(html).toContain('aria-hidden="true"');
  });

  it('becomes visible and exposed to assistive tech once hydrated', async () => {
    render(<TargetConfigPanel />);
    const label = await screen.findByText('NO TARGET CONFIGURED');
    const panel = label.closest('.max-w-2xl') as HTMLElement;
    await waitFor(() => expect(panel).not.toHaveClass('invisible'));
    expect(panel).not.toHaveAttribute('aria-hidden');
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
