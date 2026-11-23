import { resolveResponsiveValue, type ResponsiveValue } from './responsive.js';

export interface GridOptions {
  readonly columns: ResponsiveValue<number>;
  readonly gap?: ResponsiveValue<number>;
}

export interface GridItemPosition {
  readonly index: number;
  readonly row: number;
  readonly column: number;
}

export interface GridLayoutResult {
  readonly columns: number;
  readonly gap: number;
  readonly rows: number;
  readonly items: readonly GridItemPosition[];
}

/** Calculates a responsive, zero-based grid layout without depending on a UI toolkit. */
export class GridLayout {
  constructor(private readonly options: GridOptions) {}

  layout(width: number, itemCount: number): GridLayoutResult {
    if (!Number.isFinite(width) || width < 0) throw new RangeError('Grid width must be a non-negative number.');
    if (!Number.isInteger(itemCount) || itemCount < 0) throw new RangeError('Grid item count must be a non-negative integer.');

    const columns = resolveResponsiveValue(this.options.columns, width);
    const gap = resolveResponsiveValue(this.options.gap ?? 0, width);
    if (!Number.isInteger(columns) || columns < 1) throw new RangeError('Grid columns must be a positive integer.');
    if (!Number.isFinite(gap) || gap < 0) throw new RangeError('Grid gap must be a non-negative number.');

    const items = Array.from({ length: itemCount }, (_, index) => ({
      index,
      row: Math.floor(index / columns),
      column: index % columns,
    }));
    return { columns, gap, rows: Math.ceil(itemCount / columns), items };
  }
}
