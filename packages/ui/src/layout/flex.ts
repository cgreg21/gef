import { resolveResponsiveValue, type ResponsiveValue } from './responsive.js';

export type FlexDirection = 'row' | 'column';
export type FlexJustify = 'start' | 'center' | 'end' | 'space-between';
export type FlexAlign = 'start' | 'center' | 'end' | 'stretch';

export interface FlexItem {
  readonly basis: number;
  readonly grow?: number;
  readonly shrink?: number;
  readonly crossSize?: number;
}

export interface FlexOptions {
  readonly direction?: ResponsiveValue<FlexDirection>;
  readonly wrap?: ResponsiveValue<boolean>;
  readonly gap?: ResponsiveValue<number>;
  readonly justify?: ResponsiveValue<FlexJustify>;
  readonly align?: ResponsiveValue<FlexAlign>;
}

export interface FlexItemLayout {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly line: number;
}

export interface FlexLayoutResult {
  readonly direction: FlexDirection;
  readonly lines: number;
  readonly items: readonly FlexItemLayout[];
}

/** Calculates a responsive flex layout independently from the native UI toolkit. */
export class FlexLayout {
  constructor(private readonly options: FlexOptions = {}) {}

  layout(width: number, height: number, items: readonly FlexItem[]): FlexLayoutResult {
    if (!Number.isFinite(width) || width < 0 || !Number.isFinite(height) || height < 0) {
      throw new RangeError('Flex container dimensions must be non-negative numbers.');
    }

    const direction = resolveResponsiveValue(this.options.direction ?? 'row', width);
    const wrap = resolveResponsiveValue(this.options.wrap ?? false, width);
    const gap = resolveResponsiveValue(this.options.gap ?? 0, width);
    const justify = resolveResponsiveValue(this.options.justify ?? 'start', width);
    const align = resolveResponsiveValue(this.options.align ?? 'stretch', width);
    if (!Number.isFinite(gap) || gap < 0) throw new RangeError('Flex gap must be a non-negative number.');

    const mainLimit = direction === 'row' ? width : height;
    const crossLimit = direction === 'row' ? height : width;
    if (items.length === 0) return { direction, lines: 0, items: [] };

    const lines: FlexItem[][] = [[]];
    let used = 0;

    for (const item of items) {
      this.validateItem(item);
      const next = (lines[lines.length - 1].length ? gap : 0) + item.basis;
      if (wrap && lines[lines.length - 1].length && used + next > mainLimit) {
        lines.push([]);
        used = 0;
      }
      lines[lines.length - 1].push(item);
      used += (lines[lines.length - 1].length > 1 ? gap : 0) + item.basis;
    }

    const result: FlexItemLayout[] = [];
    let crossOffset = 0;
    let index = 0;
    lines.forEach((line, lineIndex) => {
      const base = line.reduce((sum, item) => sum + item.basis, 0);
      const free = mainLimit - base - gap * Math.max(0, line.length - 1);
      const grow = line.reduce((sum, item) => sum + (item.grow ?? 0), 0);
      const shrink = line.reduce((sum, item) => sum + (item.shrink ?? 1) * item.basis, 0);
      const sizes = line.map(item => Math.max(0, item.basis + (free >= 0
        ? (grow ? free * (item.grow ?? 0) / grow : 0)
        : (shrink ? free * (item.shrink ?? 1) * item.basis / shrink : 0))));
      const occupied = sizes.reduce((sum, size) => sum + size, 0) + gap * Math.max(0, line.length - 1);
      const remaining = Math.max(0, mainLimit - occupied);
      const offset = justify === 'center' ? remaining / 2 : justify === 'end' ? remaining
        : 0;
      const between = justify === 'space-between' && line.length > 1
        ? gap + remaining / (line.length - 1) : gap;
      const naturalCross = Math.max(0, ...line.map(item => item.crossSize ?? 0));
      const lineCross = naturalCross || (lines.length === 1 ? crossLimit : crossLimit / lines.length);

      let mainOffset = offset;
      line.forEach((item, itemIndex) => {
        const crossSize = align === 'stretch' ? lineCross : Math.min(item.crossSize ?? lineCross, lineCross);
        const crossPosition = crossOffset + (align === 'center' ? (lineCross - crossSize) / 2
          : align === 'end' ? lineCross - crossSize : 0);
        const mainSize = sizes[itemIndex];
        const x = direction === 'row' ? mainOffset : crossPosition;
        const y = direction === 'row' ? crossPosition : mainOffset;
        result.push({
          index: index++, x, y,
          width: direction === 'row' ? mainSize : crossSize,
          height: direction === 'row' ? crossSize : mainSize,
          line: lineIndex,
        });
        mainOffset += mainSize + between;
      });
      crossOffset += lineCross + gap;
    });

    return { direction, lines: lines.length, items: result };
  }

  private validateItem(item: FlexItem): void {
    if (!Number.isFinite(item.basis) || item.basis < 0 ||
      !Number.isFinite(item.grow ?? 0) || (item.grow ?? 0) < 0 ||
      !Number.isFinite(item.shrink ?? 1) || (item.shrink ?? 1) < 0 ||
      !Number.isFinite(item.crossSize ?? 0) || (item.crossSize ?? 0) < 0) {
      throw new RangeError('Flex item basis, grow, shrink and crossSize must be non-negative numbers.');
    }
  }
}
