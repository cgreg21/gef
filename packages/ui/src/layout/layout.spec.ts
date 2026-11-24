import { describe, expect, it, vi } from 'vitest';
import { GridLayout } from './grid.js';
import { BreakpointObserver, getBreakpoint, resolveResponsiveValue } from './responsive.js';

describe('responsive utilities', () => {
  it('uses the default mobile-first breakpoints', () => {
    expect(getBreakpoint(375)).toBe('xs');
    expect(getBreakpoint(600)).toBe('sm');
    expect(getBreakpoint(900)).toBe('md');
    expect(getBreakpoint(1100)).toBe('lg');
    expect(getBreakpoint(1300)).toBe('xl');
    expect(getBreakpoint(1500)).toBe('xxl');
  });

  it('resolves responsive values by inheriting the last configured breakpoint', () => {
    const columns = { base: 1, sm: 2, lg: 4 };
    expect(resolveResponsiveValue(columns, 400)).toBe(1);
    expect(resolveResponsiveValue(columns, 700)).toBe(2);
    expect(resolveResponsiveValue(columns, 1000)).toBe(4);
  });

  it('notifies only when the active breakpoint changes', () => {
    const observer = new BreakpointObserver();
    const changed = vi.fn();
    const subscription = observer.subscribe(changed);
    observer.update(400);
    observer.update(700);
    observer.update(800);
    observer.update(900);
    observer.update(1000);
    expect(changed.mock.calls.map(([change]) => change.breakpoint)).toEqual(['sm', 'md', 'lg']);
    expect(observer.current).toBe('lg');
    subscription.unsubscribe();
    observer.update(1300);
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('tracks native widget width changes and disconnects on unsubscribe', () => {
    let width = 500;
    let callback: (() => void) | undefined;
    let disconnected = false;
    const widget = {
      connect: (signal: string, listener: () => void) => {
        expect(signal).toBe('notify::width');
        callback = listener;
        return 7;
      },
      disconnect: (id: number) => { expect(id).toBe(7); disconnected = true; },
      get_width: () => width,
    };
    const observer = new BreakpointObserver();
    const changed = vi.fn();
    observer.subscribe(changed);
    const subscription = observer.observe(widget);
    expect(observer.currentWidth).toBe(500);
    width = 800;
    callback?.();
    expect(changed.mock.calls.map(([change]) => change.breakpoint)).toEqual(['md']);
    subscription.unsubscribe();
    expect(disconnected).toBe(true);
  });

  it('calculates responsive grid positions', () => {
    const grid = new GridLayout({ columns: { base: 1, sm: 2, lg: 3 }, gap: { base: 8, md: 16 } });
    expect(grid.layout(400, 3)).toEqual({
      columns: 1, gap: 8, rows: 3,
      items: [{ index: 0, row: 0, column: 0 }, { index: 1, row: 1, column: 0 }, { index: 2, row: 2, column: 0 }],
    });
    expect(grid.layout(1000, 5)).toMatchObject({
      columns: 3, gap: 16, rows: 2,
      items: [
        { index: 0, row: 0, column: 0 },
        { index: 1, row: 0, column: 1 },
        { index: 2, row: 0, column: 2 },
        { index: 3, row: 1, column: 0 },
        { index: 4, row: 1, column: 1 },
      ],
    });
  });

  it('rejects invalid widths, counts and grid settings', () => {
    expect(() => getBreakpoint(-1)).toThrow(RangeError);
    expect(() => new GridLayout({ columns: 0 }).layout(500, 1)).toThrow(RangeError);
    expect(() => new GridLayout({ columns: 2 }).layout(500, -1)).toThrow(RangeError);
  });
});
