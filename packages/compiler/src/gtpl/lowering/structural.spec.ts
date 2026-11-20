import { describe, expect, it } from 'vitest';
import { parseGtpl } from '../parser/parser.js';
import { lowerGtplStructuralDirectives } from './structural.js';

describe('lowerGtplStructuralDirectives', () => {
  it('lowers *if and preserves the element without its structural attribute', () => {
    const parsed = parseGtpl('<StLabel *if="visible">Shown</StLabel>');
    const result = lowerGtplStructuralDirectives(parsed.nodes);
    expect(result.diagnostics).toEqual([]);
    expect(result.nodes[0]).toMatchObject({
      kind: 'if-block',
      branches: [{
        parsedCondition: { kind: 'identifier', name: 'visible' },
        children: [{ kind: 'element', name: 'StLabel', attributes: [] }],
      }],
    });
  });

  it('lowers *for microsyntax, tracking and contextual aliases', () => {
    const parsed = parseGtpl('<StLabel *for="let item of items; track item.id; let i = index">{{item.name}} {{i}}</StLabel>');
    expect(parsed.diagnostics).toEqual([]);
    const result = lowerGtplStructuralDirectives(parsed.nodes);
    expect(result.diagnostics).toEqual([]);
    expect(result.nodes[0]).toMatchObject({
      kind: 'for-block',
      item: 'item',
      collection: 'items',
      track: 'item.id',
      aliases: [{ name: 'i', context: '$index' }],
      children: [{ kind: 'element', name: 'StLabel', attributes: [] }],
    });
  });

  it('supports the gef directive names', () => {
    const parsed = parseGtpl('<StLabel *gefIf="ready" /><StLabel *gefFor="let item of items" />');
    const result = lowerGtplStructuralDirectives(parsed.nodes);
    expect(result.diagnostics).toEqual([]);
    expect(result.nodes.map((node) => node.kind)).toEqual(['if-block', 'for-block']);
  });

  it('reports invalid microsyntax and duplicate structural directives', () => {
    const parsed = parseGtpl('<StLabel *if="ready" *for="item in items" />');
    const result = lowerGtplStructuralDirectives(parsed.nodes);
    expect(result.diagnostics.map((item) => item.code)).toContain('GTPL4201');
    expect(result.diagnostics.map((item) => item.code)).toContain('GTPL4203');
  });

  it('lowers nested structural directives recursively', () => {
    const parsed = parseGtpl('<StBox><StLabel *if="ready" /></StBox>');
    const result = lowerGtplStructuralDirectives(parsed.nodes);
    expect(result.nodes[0]).toMatchObject({
      kind: 'element',
      children: [{ kind: 'if-block' }],
    });
  });
});
