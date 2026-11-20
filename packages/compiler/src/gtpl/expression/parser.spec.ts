import { describe, expect, it } from 'vitest';
import { parseGtplExpression } from './parser.js';

describe('parseGtplExpression', () => {
  it('parses member access and calls', () => {
    const result = parseGtplExpression('device.getLabel()');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({
      kind: 'call',
      callee: {
        kind: 'member',
        property: 'getLabel',
        object: { kind: 'identifier', name: 'device' },
      },
    });
  });

  it('respects binary operator precedence', () => {
    const result = parseGtplExpression('1 + 2 * 3');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({
      kind: 'binary',
      operator: '+',
      right: { kind: 'binary', operator: '*' },
    });
  });

  it('parses optional and computed member access', () => {
    const result = parseGtplExpression('device?.sensors[index]');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({
      kind: 'member',
      computed: true,
      object: {
        kind: 'member',
        optional: true,
        property: 'sensors',
      },
    });
  });

  it('parses conditional expressions', () => {
    const result = parseGtplExpression('enabled ? "On" : "Off"');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({ kind: 'conditional' });
  });

  it('parses arrays and unary expressions', () => {
    const result = parseGtplExpression('[!busy, -count, true]');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({
      kind: 'array',
      elements: [
        { kind: 'unary', operator: '!' },
        { kind: 'unary', operator: '-' },
        { kind: 'literal', value: true },
      ],
    });
  });

  it('reports trailing tokens instead of silently accepting them', () => {
    const result = parseGtplExpression('value anotherValue');
    expect(result.diagnostics.some((item) => item.code === 'GTPL2002')).toBe(true);
  });

  it('reports unterminated strings', () => {
    const result = parseGtplExpression('"unfinished');
    expect(result.diagnostics.some((item) => item.code === 'GTPL2005')).toBe(true);
  });

  it('preserves all content in an unterminated string literal', () => {
    const result = parseGtplExpression('"unfinished');
    expect(result.expression).toMatchObject({
      kind: 'literal',
      value: 'unfinished',
    });
    expect(result.diagnostics.some((item) => item.code === 'GTPL2005')).toBe(true);
  });

  it('keeps unterminated string spans within the source', () => {
    const source = '"unfinished\\';
    const result = parseGtplExpression(source);
    const diagnostic = result.diagnostics.find((item) => item.code === 'GTPL2005');
    expect(diagnostic?.span.end).toBe(source.length);
  });

  it('reports empty expressions', () => {
    const result = parseGtplExpression('   ');
    expect(result.expression).toBeNull();
    expect(result.diagnostics[0]?.code).toBe('GTPL2001');
  });
});
