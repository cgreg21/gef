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

  it('parses chained pipes and pipe arguments', () => {
    expect(parseGtplExpression('name | uppercase | slice:1:3')).toMatchObject({
      diagnostics: [],
      expression: {
        kind: 'pipe',
        name: 'slice',
        arguments: [{ kind: 'literal', value: 1 }, { kind: 'literal', value: 3 }],
        expression: { kind: 'pipe', name: 'uppercase' },
      },
    });
  });

  it('reports a missing pipe name', () => {
    expect(parseGtplExpression('name | 3').diagnostics.map((item) => item.code)).toContain('GTPL2010');
  });

  it('parses right-associative assignments and rejects invalid targets', () => {
    expect(parseGtplExpression('state = next = $event')).toMatchObject({
      diagnostics: [],
      expression: {
        kind: 'assignment',
        target: { kind: 'identifier', name: 'state' },
        value: { kind: 'assignment', target: { kind: 'identifier', name: 'next' } },
      },
    });
    expect(parseGtplExpression('getState() = value').diagnostics.map((item) => item.code)).toContain('GTPL2009');
  });

  it('parses object literals with shorthand-free keys and trailing commas', () => {
    const result = parseGtplExpression('{ active: isActive, "aria-label": label, 2: count, }');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression).toMatchObject({
      kind: 'object',
      properties: [
        { key: 'active', value: { kind: 'identifier', name: 'isActive' } },
        { key: 'aria-label', value: { kind: 'identifier', name: 'label' } },
        { key: '2', value: { kind: 'identifier', name: 'count' } },
      ],
    });
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
  it('survives deterministic malformed-expression fuzzing with bounded AST and diagnostic spans', () => {
    const tokens = [
      'value', 'items', '0', '42.5', '"text"', "'escaped\\\\'quote'",
      'true', 'null', '?.', '.', '[', ']', '(', ')', ',', ':', '?',
      '+', '-', '*', '**', '/', '&&', '||', '??', '!', '===', '<',
      '{', '}', '@', ';', '\\\\', '',
    ];
    let seed = 0x6d2b79f5;
    const random = (limit: number): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % limit;
    };
    const sources = Array.from({ length: 1200 }, () =>
      Array.from({ length: 1 + random(24) }, () => tokens[random(tokens.length)] ?? '')
        .join(random(2) ? ' ' : ''),
    );

    const assertExpressionSpans = (node: import('../ast/expression.js').ExpressionNode | null, source: string): void => {
      if (!node) return;
      expect(node.span.start).toBeGreaterThanOrEqual(0);
      expect(node.span.end).toBeGreaterThanOrEqual(node.span.start);
      expect(node.span.end).toBeLessThanOrEqual(source.length);
      switch (node.kind) {
        case 'array':
          for (const element of node.elements) assertExpressionSpans(element, source);
          break;
        case 'object':
          for (const property of node.properties) assertExpressionSpans(property.value, source);
          break;
        case 'assignment':
          assertExpressionSpans(node.target, source);
          assertExpressionSpans(node.value, source);
          break;
        case 'pipe':
          assertExpressionSpans(node.expression, source);
          for (const argument of node.arguments) assertExpressionSpans(argument, source);
          break;
        case 'unary':
          assertExpressionSpans(node.argument, source);
          break;
        case 'binary':
          assertExpressionSpans(node.left, source);
          assertExpressionSpans(node.right, source);
          break;
        case 'conditional':
          assertExpressionSpans(node.test, source);
          assertExpressionSpans(node.consequent, source);
          assertExpressionSpans(node.alternate, source);
          break;
        case 'member':
          assertExpressionSpans(node.object, source);
          if (typeof node.property !== 'string') assertExpressionSpans(node.property, source);
          break;
        case 'call':
          assertExpressionSpans(node.callee, source);
          for (const argument of node.arguments) assertExpressionSpans(argument, source);
          break;
      }
    };

    for (const source of sources) {
      const result = parseGtplExpression(source);
      assertExpressionSpans(result.expression, source);
      for (const diagnostic of result.diagnostics) {
        expect(diagnostic.span.start).toBeGreaterThanOrEqual(0);
        expect(diagnostic.span.end).toBeGreaterThanOrEqual(diagnostic.span.start);
        expect(diagnostic.span.end).toBeLessThanOrEqual(source.length);
      }
    }
  });

  it('handles deeply nested expression delimiters without corrupting source spans', () => {
    const depth = 160;
    const source = 'format('.repeat(depth) + 'value' + ')'.repeat(depth);
    const result = parseGtplExpression(source);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.expression?.span).toEqual({ start: 0, end: source.length });
  });

});
