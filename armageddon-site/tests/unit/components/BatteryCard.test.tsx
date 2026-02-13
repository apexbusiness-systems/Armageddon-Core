// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BatteryCard from '@/components/BatteryCard';
import { Battery } from '@armageddon/shared';

// Mock framer-motion to render children directly without animation wrappers interfering
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
      onClick,
      onMouseEnter,
      onMouseLeave,
      // Filter out framer-motion props to avoid React warnings
      initial,
      whileInView,
      viewport,
      transition,
      animate,
      exit,
      ...props
    }: any) => (
      <div
        className={className}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        data-testid={props['data-testid'] || 'motion-div'}
        {...props}
      >
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const mockBattery: Battery = {
  id: '01',
  name: 'Test Battery',
  description: 'A test battery description',
  attackVector: 'SQL Injection',
  godMode: false,
};

describe('BatteryCard', () => {
  const defaultProps = {
    battery: mockBattery,
    index: 0,
    isExpanded: false,
    isHovered: false,
    onToggle: vi.fn(),
    onHoverChange: vi.fn(),
    isLarge: false,
  };

  it('renders baseline content correctly', () => {
    render(<BatteryCard {...defaultProps} />);

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('Test Battery')).toBeInTheDocument();
    expect(screen.getByText('A test battery description')).toBeInTheDocument();
    // Check for chevron (svg) - simple check that it exists
    const chevron = document.querySelector('svg');
    expect(chevron).toBeInTheDocument();
  });

  it('renders God Mode correctly', () => {
    const props = { ...defaultProps, battery: { ...mockBattery, godMode: true } };
    const { container } = render(<BatteryCard {...props} />);

    expect(screen.getByText('GOD MODE')).toBeInTheDocument();

    // Check for card-highlight class on the main container (first child)
    expect(container.firstChild).toHaveClass('card-highlight');

    // Check status light is amber
    const light = container.querySelector('.status-light');
    expect(light).toHaveClass('amber');

    // Check pr-24 padding
    const content = container.querySelector('.flex.items-center');
    expect(content).toHaveClass('pr-24');
  });

  it('renders normal mode correctly (no God Mode)', () => {
    const { container } = render(<BatteryCard {...defaultProps} />);

    expect(screen.queryByText('GOD MODE')).not.toBeInTheDocument();
    expect(container.firstChild).not.toHaveClass('card-highlight');

    const light = container.querySelector('.status-light');
    expect(light).toHaveClass('green');
    expect(light).not.toHaveClass('amber');
  });

  it('applies large variant classes', () => {
    const props = { ...defaultProps, isLarge: true };
    const { container } = render(<BatteryCard {...props} />);

    expect(container.firstChild).toHaveClass('lg:col-span-2', 'lg:max-w-[calc(50%-0.5rem)]', 'lg:mx-auto');
  });

  it('handles interactions correctly', () => {
    render(<BatteryCard {...defaultProps} />);

    const card = screen.getByText('Test Battery').closest('.card-panel');

    if (card) {
        fireEvent.click(card);
        expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);

        fireEvent.mouseEnter(card);
        expect(defaultProps.onHoverChange).toHaveBeenCalledWith(true);

        fireEvent.mouseLeave(card);
        expect(defaultProps.onHoverChange).toHaveBeenCalledWith(false);
    } else {
        throw new Error('Card panel not found');
    }
  });

  it('renders expanded content', () => {
    const props = { ...defaultProps, isExpanded: true };
    render(<BatteryCard {...props} />);

    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByText('_')).toBeInTheDocument(); // The blinking cursor
  });

  it('does not render expanded content when collapsed', () => {
    render(<BatteryCard {...defaultProps} />);
    expect(screen.queryByText('SQL Injection')).not.toBeInTheDocument();
  });

  it('renders hover glow line', () => {
     // Since we mocked motion.div, we can look for the absolute div at the bottom
     // The implementation has a motion.div with class `absolute bottom-0 left-0 h-[2px] bg-[var(--aerospace)]`
     const { container } = render(<BatteryCard {...defaultProps} />);
     const glowLine = container.querySelector('.absolute.bottom-0.left-0');
     expect(glowLine).toBeInTheDocument();
     expect(glowLine).toHaveClass('h-[2px]', 'bg-[var(--aerospace)]');
  });

  it('renders correctly in stress scenario (all flags on)', () => {
    const props = {
        battery: { ...mockBattery, godMode: true },
        index: 1,
        isExpanded: true,
        isHovered: true,
        onToggle: vi.fn(),
        onHoverChange: vi.fn(),
        isLarge: true,
    };

    const { container } = render(<BatteryCard {...props} />);

    // Check God Mode
    expect(screen.getByText('GOD MODE')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('card-highlight');

    // Check Large Layout
    expect(container.firstChild).toHaveClass('lg:col-span-2');

    // Check Expanded Content
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();

    // Check Hover Glow Line exists (mocked animation prevents width check unless we inspect props, but existence is key)
    const glowLine = container.querySelector('.absolute.bottom-0.left-0');
    expect(glowLine).toBeInTheDocument();
  });
});
