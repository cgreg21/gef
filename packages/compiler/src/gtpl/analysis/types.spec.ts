import { describe, expect, it } from 'vitest';
import { parseGtpl } from '../parser/parser.js';
import { lowerGtplStructuralDirectives } from '../lowering/structural.js';
import { validateGtplExpressionTypes } from './types.js';

function check(template: string, context: string) {
  const parsed = parseGtpl(template);
  const lowered = lowerGtplStructuralDirectives(parsed.nodes);
  return validateGtplExpressionTypes(lowered.nodes, context);
}

describe('validateGtplExpressionTypes', () => {
  it('accepts expressions compatible with component member types', () => {
    expect(check('<StLabel>{{name.toUpperCase()}} {{count + 1}}</StLabel>', '{ name: string; count: number }')).toEqual([]);
  });

  it('reports invalid member access and operators', () => {
    const diagnostics = check('<StLabel>{{count.toUpperCase()}}</StLabel>', '{ count: number }');
    expect(diagnostics.map((item) => item.code)).toContain('GTPL5001');
  });

  it('checks bindings and event expressions', () => {
    const diagnostics = check('<StButton [label]="missing.toUpperCase()" (clicked)="save($event)" />', '{ save(event: unknown): void }');
    expect(diagnostics.map((item) => item.code)).toContain('GTPL5001');
  });

  it('checks exhaustive switches against literal union context members', () => {
    const missing = check('@switch (state) { @case (\'idle\') { <StLabel /> } @default never; }', "{ state: 'idle' | 'ready' }");
    expect(missing.map((item) => item.code)).toContain('GTPL5002');
    const complete = check('@switch (state) { @case (\'idle\') { <StLabel /> } @case (\'ready\') { <StLabel /> } @default never; }', "{ state: 'idle' | 'ready' }");
    expect(complete).toEqual([]);
  });

  it('keeps loop locals available to expressions', () => {
    expect(check('@for (item of items; track item.id) { <StLabel>{{item.name}}</StLabel> }', '{ items: Array<{ id: number; name: string }> }')).toEqual([]);
  });
});
