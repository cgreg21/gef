import { describe, expect, it } from 'vitest';
import { emitGtplExpression } from './expression.js';
import { parseGtplExpression } from '../expression/parser.js';

function emit(source: string): string {
  const result = parseGtplExpression(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.expression).not.toBeNull();
  return emitGtplExpression(result.expression!);
}

describe('emitGtplExpression', () => {
  it('preserves binary precedence and grouping', () => {
    expect(emit('1 + 2 * 3')).toBe('(1 + (2 * 3))');
    expect(emit('(1 + 2) * 3')).toBe('((1 + 2) * 3)');
  });

  it('emits literals as safe JavaScript source', () => {
    expect(emit('"line\\nquote\\\"end"')).toBe('"line\\nquote\\\"end"');
    expect(emit('true')).toBe('true');
    expect(emit('null')).toBe('null');
    expect(emit('42.5')).toBe('42.5');
  });

  it('emits optional, computed member access and optional calls', () => {
    expect(emit('device?.sensors[index]')).toBe('((device?.sensors)[index])');
    expect(emit('device?.[key]')).toBe('(device?.[key])');
    expect(emit('device.load?.(name)')).toBe('((device.load)?.(name))');
  });

  it('emits arrays, unary and conditional expressions', () => {
    expect(emit('[!busy, -count, enabled ? "yes" : "no"]'))
      .toBe('[( !busy), (-count), (enabled ? "yes" : "no")]'.replace('( !busy)', '(!busy)'));
  });

  it('emits a recovered unterminated string as a valid JavaScript literal', () => {
    const result = parseGtplExpression('"unfinished');
    expect(result.diagnostics.map((item) => item.code)).toContain('GTPL2005');
    expect(emitGtplExpression(result.expression!)).toBe('"unfinished"');
  });
});
