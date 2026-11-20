import { describe, expect, it } from 'vitest';
import { parseGtpl, validateGtplComponents } from '../index.js';

describe('GTPL component metadata validation', () => {
  const components = [
    { selector: 'GefButton', inputs: ['label', 'disabled', 'value'], outputs: ['clicked', 'valueChange'] },
    { selector: 'GefLabel', inputs: ['text'] },
  ];
  it('accepts registered inputs and outputs', () => {
    const parsed = parseGtpl('<GefButton [label]="title" (clicked)="activate()" [(value)]="volume" />');
    expect(validateGtplComponents(parsed.nodes, { components })).toHaveLength(0);
  });
  it('reports unknown inputs and outputs', () => {
    const parsed = parseGtpl('<GefButton [caption]="title" (pressed)="activate()" />');
    expect(validateGtplComponents(parsed.nodes, { components }).map((item) => item.code)).toEqual(['GTPL4102', 'GTPL4103']);
  });
  it('checks both sides of two-way bindings', () => {
    const parsed = parseGtpl('<GefLabel [(text)]="value" />');
    expect(validateGtplComponents(parsed.nodes, { components }).map((item) => item.code)).toEqual(['GTPL4103']);
  });
  it('allows native elements by default', () => {
    const parsed = parseGtpl('<StBox><StLabel /></StBox>');
    expect(validateGtplComponents(parsed.nodes, { components })).toHaveLength(0);
  });
  it('can reject unknown selectors in strict mode', () => {
    const parsed = parseGtpl('<GefUnknown />');
    expect(validateGtplComponents(parsed.nodes, { components, strict: true })[0]?.code).toBe('GTPL4101');
  });
  it('validates components nested in control-flow blocks', () => {
    const parsed = parseGtpl('@if (ready) { <GefButton [disabled]="busy" /> }');
    expect(validateGtplComponents(parsed.nodes, { components })).toHaveLength(0);
  });
});
