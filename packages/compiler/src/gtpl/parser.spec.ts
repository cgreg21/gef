import { describe, expect, it } from 'vitest';
import { parseGtpl } from './parser.js';

describe('parseGtpl', () => {
  it('parses nested and self-closing elements', () => {
    const result = parseGtpl('<StBox><StIcon iconName="computer-symbolic" /></StBox>');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
    const root = result.nodes[0];
    expect(root?.kind).toBe('element');
    if (root?.kind !== 'element') return;
    expect(root.name).toBe('StBox');
    expect(root.children).toHaveLength(1);
    const child = root.children[0];
    expect(child?.kind).toBe('element');
    if (child?.kind !== 'element') return;
    expect(child.name).toBe('StIcon');
    expect(child.attributes[0]).toMatchObject({
      name: 'iconName',
      value: 'computer-symbolic',
      kind: 'static',
    });
  });

  it('classifies Angular-inspired binding attributes', () => {
    const result = parseGtpl(
      '<StButton title="Open" [visible]="isVisible" (clicked)="open()" [(value)]="volume" *gefIf="enabled" #button />',
    );
    expect(result.diagnostics).toHaveLength(0);
    const node = result.nodes[0];
    expect(node?.kind).toBe('element');
    if (node?.kind !== 'element') return;
    expect(node.attributes.map(({ name, kind }) => [name, kind])).toEqual([
      ['title', 'static'],
      ['visible', 'property'],
      ['clicked', 'event'],
      ['value', 'two-way'],
      ['gefIf', 'structural'],
      ['button', 'reference'],
    ]);
  });

  it('splits literal text and interpolation parts', () => {
    const result = parseGtpl('<StLabel>Hello {{ user.name }}!</StLabel>');
    expect(result.diagnostics).toHaveLength(0);
    const element = result.nodes[0];
    expect(element?.kind).toBe('element');
    if (element?.kind !== 'element') return;
    const text = element.children[0];
    expect(text?.kind).toBe('text');
    if (text?.kind !== 'text') return;
    expect(text.parts.map((part) => part.kind)).toEqual(['text', 'interpolation', 'text']);
    expect(text.parts[1]).toMatchObject({ expression: 'user.name' });
  });

  it('ignores comments', () => {
    const result = parseGtpl('<!-- ignored --><StLabel />');
    expect(result.diagnostics).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
  });

  it('reports missing closing tags with source locations', () => {
    const result = parseGtpl('<StBox>\n  <StLabel />');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'GTPL1006',
      span: { line: 1, column: 1 },
    });
  });

  it('reports mismatched closing tags', () => {
    const result = parseGtpl('<StBox></StLabel>');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1005')).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1006')).toBe(true);
  });

  it('reports unterminated interpolation', () => {
    const result = parseGtpl('<StLabel>{{ value </StLabel>');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1011')).toBe(true);
  });

  it('reports unterminated comments', () => {
    const result = parseGtpl('<!-- never closed');
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'GTPL1012')).toBe(true);
  });
});


describe('GTPL expression integration', () => {
  it('attaches parsed expression trees to interpolations and bindings', () => {
    const result = parseGtpl('<StLabel [visible]="device.connected">{{ device.name }}</StLabel>');
    expect(result.diagnostics).toHaveLength(0);
    const root = result.nodes[0];
    expect(root?.kind).toBe('element');
    if (root?.kind !== 'element') return;
    expect(root.attributes[0]?.parsedExpression).toMatchObject({
      kind: 'member',
      property: 'connected',
    });
    const text = root.children[0];
    expect(text?.kind).toBe('text');
    if (text?.kind !== 'text') return;
    const interpolation = text.parts.find((part) => part.kind === 'interpolation');
    expect(interpolation).toMatchObject({
      kind: 'interpolation',
      parsedExpression: { kind: 'member', property: 'name' },
    });
  });

  it('maps binding expression diagnostics to template line and column', () => {
    const result = parseGtpl('<StBox>\\n  <StLabel [visible]="device." />\\n</StBox>');
    const diagnostic = result.diagnostics.find((item) => item.code === 'GTPL2003');
    expect(diagnostic?.span.line).toBe(2);
    expect(diagnostic?.span.column).toBeGreaterThan(20);
  });

  it('maps interpolation expression diagnostics to template coordinates', () => {
    const result = parseGtpl('<StLabel>\\n  {{ device. }}\\n</StLabel>');
    const diagnostic = result.diagnostics.find((item) => item.code === 'GTPL2003');
    expect(diagnostic?.span.line).toBe(2);
    expect(diagnostic?.span.column).toBeGreaterThan(10);
  });

  it('does not parse static values, local references, or *gefFor microsyntax as expressions', () => {
    const result = parseGtpl('<StLabel title="hello" #label *gefFor="let item of items" />');
    expect(result.diagnostics).toHaveLength(0);
    const root = result.nodes[0];
    expect(root?.kind).toBe('element');
    if (root?.kind !== 'element') return;
    expect(root.attributes.every((attribute) => !('parsedExpression' in attribute))).toBe(true);
  });

  it('reports invalid expressions in property, event, and two-way bindings', () => {
    const result = parseGtpl('<StButton [visible]="foo." (clicked)="run(]" [(value)]="[" />');
    expect(result.diagnostics.filter((item) => item.code.startsWith('GTPL200')).length).toBeGreaterThanOrEqual(3);
  });
});
