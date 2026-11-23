import { describe, expect, it } from 'vitest';
import { FlexLayout } from './flex.js';

describe('FlexLayout', () => {
  it('distributes free space using grow factors', () => {
    const result = new FlexLayout({ direction: 'row' }).layout(300, 40, [
      { basis: 50, grow: 1 }, { basis: 50, grow: 2 },
    ]);
    expect(result.items[0]!.width).toBeCloseTo(116.67, 2);
    expect(result.items[1]!.width).toBeCloseTo(183.33, 2);
    expect(result.items[1]!.x).toBe(100);
  });

  it('shrinks items proportionally when the line overflows', () => {
    const result = new FlexLayout().layout(150, 30, [
      { basis: 100 }, { basis: 100 },
    ]);
    expect(result.items.map(item => item.width)).toEqual([75, 75]);
  });

  it('wraps items and applies responsive direction and gap', () => {
    const flex = new FlexLayout({
      direction: { base: 'column', md: 'row' },
      wrap: true,
      gap: { base: 4, md: 10 },
    });
    const items = [{ basis: 60, crossSize: 20 }, { basis: 60, crossSize: 20 }, { basis: 60, crossSize: 20 }];
    const narrow = flex.layout(300, 100, items);
    expect(narrow.direction).toBe('column');
    expect(narrow.lines).toBe(3);
    const wide = flex.layout(800, 100, items);
    expect(wide.direction).toBe('row');
    expect(wide.lines).toBe(1);
    expect(wide.items[1]!.x).toBe(70);
  });

  it('supports wrapping and alignment in a row', () => {
    const result = new FlexLayout({ wrap: true, gap: 10, justify: 'center', align: 'center' })
      .layout(120, 100, [{ basis: 70, crossSize: 20 }, { basis: 70, crossSize: 40 }]);
    expect(result.lines).toBe(2);
    expect(result.items[0]!.x).toBe(25);
    expect(result.items[1]!.line).toBe(1);
  });

  it('rejects invalid dimensions and item values', () => {
    expect(() => new FlexLayout().layout(-1, 20, [])).toThrow(RangeError);
    expect(() => new FlexLayout().layout(100, 20, [{ basis: -1 }])).toThrow(RangeError);
  });
});
