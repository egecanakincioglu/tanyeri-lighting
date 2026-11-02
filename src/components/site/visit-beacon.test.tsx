import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitBeacon } from './visit-beacon.tsx';

const mocks = vi.hoisted(() => ({ pathname: '/tr/urunler', sendBeacon: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));

describe('VisitBeacon', () => {
  beforeEach(() => {
    mocks.sendBeacon.mockClear();
    Object.defineProperty(navigator, 'sendBeacon', { value: mocks.sendBeacon, configurable: true });
    mocks.pathname = '/tr/urunler';
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing and sends the path of the opened page once', () => {
    const { container } = render(<VisitBeacon />);
    expect(container.innerHTML).toBe('');
    expect(mocks.sendBeacon).toHaveBeenCalledTimes(1);
    expect(mocks.sendBeacon).toHaveBeenCalledWith('/api/visits', '/tr/urunler');
  });

  it('sends again when the path changes, not on a re-render with the same path', () => {
    const { rerender } = render(<VisitBeacon />);
    rerender(<VisitBeacon />);
    expect(mocks.sendBeacon).toHaveBeenCalledTimes(1);
    mocks.pathname = '/tr/iletisim';
    rerender(<VisitBeacon />);
    expect(mocks.sendBeacon).toHaveBeenCalledTimes(2);
    expect(mocks.sendBeacon).toHaveBeenLastCalledWith('/api/visits', '/tr/iletisim');
  });
});
