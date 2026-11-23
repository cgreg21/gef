export const DEFAULT_BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} as const;

export type Breakpoint = keyof typeof DEFAULT_BREAKPOINTS;
export type Breakpoints = Readonly<Record<Breakpoint, number>>;
export type ResponsiveValue<T> = T | (Readonly<{ base: T }> & Partial<Readonly<Record<Breakpoint, T>>>);

export interface ResponsiveChange {
  readonly width: number;
  readonly breakpoint: Breakpoint;
}

/** Returns the active breakpoint for a viewport or native widget width. */
export function getBreakpoint(width: number, breakpoints: Breakpoints = DEFAULT_BREAKPOINTS): Breakpoint {
  if (!Number.isFinite(width) || width < 0) throw new RangeError('Responsive width must be a non-negative number.');
  const entries = (Object.entries(breakpoints) as Array<[Breakpoint, number]>).sort((a, b) => a[1] - b[1]);
  let active: Breakpoint = 'xs';
  for (const [name, minWidth] of entries) {
    if (width < minWidth) break;
    active = name;
  }
  return active;
}

/** Resolves a scalar or breakpoint map using mobile-first inheritance. */
export function resolveResponsiveValue<T>(
  value: ResponsiveValue<T>,
  width: number,
  breakpoints: Breakpoints = DEFAULT_BREAKPOINTS,
): T {
  if (typeof value !== 'object' || value === null) return value as T;
  const responsive = value as Readonly<{ base: T }> & Partial<Readonly<Record<Breakpoint, T>>>;
  const active = getBreakpoint(width, breakpoints);
  const entries = (Object.entries(breakpoints) as Array<[Breakpoint, number]>).sort((a, b) => a[1] - b[1]);
  let resolved = responsive.base;
  for (const [name, minWidth] of entries) {
    if (minWidth > width) break;
    if (responsive[name] !== undefined) resolved = responsive[name] as T;
  }
  return resolved ?? (responsive[active] as T);
}

/** Tracks width changes and notifies subscribers only when the breakpoint changes. */
export class BreakpointObserver {
  private width = 0;
  private active: Breakpoint;
  private readonly listeners = new Set<(change: ResponsiveChange) => void>();

  constructor(private readonly breakpoints: Breakpoints = DEFAULT_BREAKPOINTS, initialWidth = 0) {
    this.active = getBreakpoint(initialWidth, breakpoints);
    this.width = initialWidth;
  }

  get current(): Breakpoint { return this.active; }
  get currentWidth(): number { return this.width; }

  update(width: number): void {
    const next = getBreakpoint(width, this.breakpoints);
    this.width = width;
    if (next === this.active) return;
    this.active = next;
    const change = { width, breakpoint: next };
    for (const listener of this.listeners) listener(change);
  }

  subscribe(listener: (change: ResponsiveChange) => void): { unsubscribe(): void } {
    this.listeners.add(listener);
    return { unsubscribe: () => this.listeners.delete(listener) };
  }
}
