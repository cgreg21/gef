import { describe, expect, it } from 'vitest';
import { analyzeGtpl, parseGtpl } from '../index.js';

function analyze(source: string, componentMembers?: readonly string[]) {
  const parsed = parseGtpl(source);
  const semantic = analyzeGtpl(parsed.nodes, componentMembers ? { componentMembers } : {});
  return [...parsed.diagnostics, ...semantic.diagnostics];
}

describe('GTPL semantic scopes', () => {
  it('resolves @let declarations for following siblings', () => {
    expect(analyze('@let user = model; <StLabel>{{ user.name }}</StLabel>')).toHaveLength(0);
  });

  it('does not expose @let declarations before their declaration', () => {
    const diagnostics = analyze('<StLabel>{{ later }}</StLabel> @let later = model;', ['model']);
    expect(diagnostics.some((item) => item.code === 'GTPL4002' && item.message.includes('"later"'))).toBe(true);
  });

  it('reports duplicate declarations in one scope', () => {
    const diagnostics = analyze('@let value = first; @let value = second;');
    expect(diagnostics.some((item) => item.code === 'GTPL4003')).toBe(true);
  });

  it('isolates branch scopes and resolves if aliases only inside their branch', () => {
    const diagnostics = analyze('@if (profile; as current) { <StLabel>{{ current.name }}</StLabel> } <StLabel>{{ current }}</StLabel>', ['profile']);
    expect(diagnostics.filter((item) => item.code === 'GTPL4002' && item.message.includes('"current"'))).toHaveLength(1);
  });

  it('resolves loop item, context variables and aliases only inside loop body', () => {
    const diagnostics = analyze('@for (device of devices; track device.id; let index = $index) { <StLabel>{{ device.name }} {{ index }} {{ $count }}</StLabel> } <StLabel>{{ device }}</StLabel>', ['devices']);
    expect(diagnostics.filter((item) => item.code === 'GTPL4002' && item.message.includes('"device"'))).toHaveLength(1);
    expect(diagnostics.some((item) => item.code === 'GTPL4002' && item.message.includes('"index"'))).toBe(false);
  });

  it('does not expose loop variables in @empty', () => {
    const diagnostics = analyze('@for (device of devices; track device.id) { <StLabel /> } @empty { <StLabel>{{ device }}</StLabel> }', ['devices']);
    expect(diagnostics.some((item) => item.code === 'GTPL4002' && item.message.includes('"device"'))).toBe(true);
  });

  it('isolates switch case scopes', () => {
    const diagnostics = analyze('@switch (state) { @case ("ready") { @let local = state; <StLabel>{{ local }}</StLabel> } @default { <StLabel>{{ local }}</StLabel> } }', ['state']);
    expect(diagnostics.some((item) => item.code === 'GTPL4002' && item.message.includes('"local"'))).toBe(true);
  });

  it('validates identifiers against optional component context', () => {
    const diagnostics = analyze('<StLabel>{{ missing }}</StLabel>', []);
    expect(diagnostics.some((item) => item.code === 'GTPL4002' && item.message.includes('"missing"'))).toBe(true);
  });

  it('keeps component-context validation opt-in for early parser consumers', () => {
    expect(analyze('<StLabel>{{ componentMember }}</StLabel>')).toHaveLength(0);
  });

  it('resolves $event only inside event handlers', () => {
    expect(analyze('<StButton (clicked)="activate($event)" />', ['activate'])).toHaveLength(0);
    const outside = analyze('<StLabel>{{ $event }}</StLabel>', []);
    expect(outside.some((item) => item.code === 'GTPL4002')).toBe(true);
  });

  it('points unknown identifiers to their exact source locations', () => {
    const source = '<StLabel>\\n{{ first + missing }}\\n</StLabel>';
    const parsed = parseGtpl(source);
    const semantic = analyzeGtpl(parsed.nodes, { componentMembers: ['first'], source });
    const diagnostic = semantic.diagnostics.find((item) => item.code === 'GTPL4002');
    expect(diagnostic?.span).toMatchObject({ start: source.indexOf('missing'), end: source.indexOf('missing') + 7, line: 2, column: 13 });
  });

  it('supports explicitly declared framework globals', () => {
    const parsed = parseGtpl('<StLabel>{{ gettext("Ready") }}</StLabel>');
    const semantic = analyzeGtpl(parsed.nodes, { componentMembers: [], globals: ['gettext'] });
    expect(semantic.diagnostics.filter((item) => item.code === 'GTPL4002')).toHaveLength(0);
  });
});
