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

  it('parses call arguments with a trailing comma', () => {
    const result = parseGtplExpression('format(value,)');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({
      kind: 'call',
      arguments: [{ kind: 'identifier', name: 'value' }],
    });
  });

  it('parses array elements with a trailing comma', () => {
    const result = parseGtplExpression('[first, second,]');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({
      kind: 'array',
      elements: [
        { kind: 'identifier', name: 'first' },
        { kind: 'identifier', name: 'second' },
      ],
    });
  });

  it('recovers missing commas in calls and arrays', () => {
    const call = parseGtplExpression('format(first second)');
    expect(call.expression).toMatchObject({
      kind: 'call',
      arguments: [
        { kind: 'identifier', name: 'first' },
        { kind: 'identifier', name: 'second' },
      ],
    });
    expect(call.diagnostics.some((item) => item.code === 'GTPL2008')).toBe(true);

    const array = parseGtplExpression('[first second]');
    expect(array.expression).toMatchObject({
      kind: 'array',
      elements: [
        { kind: 'identifier', name: 'first' },
        { kind: 'identifier', name: 'second' },
      ],
    });
    expect(array.diagnostics.some((item) => item.code === 'GTPL2008')).toBe(true);
  });

  it('preserves partial call, array and computed member nodes when closers are missing', () => {
    expect(parseGtplExpression('format(value').expression).toMatchObject({
      kind: 'call',
      arguments: [{ kind: 'identifier', name: 'value' }],
    });
    expect(parseGtplExpression('[value').expression).toMatchObject({
      kind: 'array',
      elements: [{ kind: 'identifier', name: 'value' }],
    });
    expect(parseGtplExpression('items[index').expression).toMatchObject({
      kind: 'member',
      computed: true,
      property: { kind: 'identifier', name: 'index' },
    });
  });

  it('does not consume a closing delimiter when an operand is missing', () => {
    const result = parseGtplExpression('format(value +)');
    expect(result.expression).toMatchObject({ kind: 'call' });
    expect(result.diagnostics.some((item) => item.code === 'GTPL2004')).toBe(true);
    expect(result.diagnostics.every((item) => item.span.start >= 0 && item.span.end <= 'format(value +)'.length)).toBe(true);
  });

  it('parses optional calls and computed optional access', () => {
    expect(parseGtplExpression('device.load?.(name)').expression).toMatchObject({
      kind: 'call',
      optional: true,
      callee: { kind: 'member', property: 'load' },
    });
    expect(parseGtplExpression('device?.[key]').expression).toMatchObject({
      kind: 'member',
      computed: true,
      optional: true,
    });
  });

  it('reports unsupported characters only once', () => {
    const result = parseGtplExpression('value @ other');
    expect(result.diagnostics.filter((item) => item.code === 'GTPL2006')).toHaveLength(1);
    expect(result.diagnostics.some((item) => item.code === 'GTPL2004')).toBe(false);
  });

  it('recovers from mismatched delimiters without stalling', () => {
    const result = parseGtplExpression('[first)');
    expect(result.expression).toMatchObject({ kind: 'array' });
    expect(result.diagnostics.some((item) => item.code === 'GTPL2007')).toBe(true);
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

  it('preserves an escaped quote at the end of an unterminated string', () => {
    const result = parseGtplExpression('"unfinished\\"');
    expect(result.expression).toMatchObject({
      kind: 'literal',
      value: 'unfinished"',
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
