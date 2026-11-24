import { describe, expect, it } from 'vitest';
import { emitGtplTemplate, emitGtplTemplateWithSourceMap } from './template.js';
import { parseGtpl } from '../parser/parser.js';
import { lowerGtplStructuralDirectives } from '../lowering/structural.js';
import { mountGtplTemplate, type GtplRenderHost } from '../../../../runtime/src/index.js';

function emit(source: string, componentMembers: string[] = []): string {
  const parsed = parseGtpl(source);
  expect(parsed.diagnostics).toEqual([]);
  return emitGtplTemplate(parsed.nodes, { componentMembers });
}

function compact(source: string): string {
  return source.replace(/\s+/g, ' ');
}


describe('emitGtplTemplate', () => {
  it('emits a v3 source map for top-level template nodes', () => {
    const source = '<StLabel />\n<StButton />';
    const parsed = parseGtpl(source);
    expect(parsed.diagnostics).toEqual([]);
    const generated = emitGtplTemplateWithSourceMap(parsed.nodes, {
      source: 'view.gtpl',
      sourceContent: source,
      file: 'view.js',
    });
    expect(generated.code).toBe(emitGtplTemplate(parsed.nodes));
    expect(generated.map).toMatchObject({
      version: 3,
      file: 'view.js',
      sources: ['view.gtpl'],
      sourcesContent: [source],
      names: [],
    });
    expect(generated.map.mappings.split(/[;,]/).filter(Boolean)).toHaveLength(2);
    expect(generated.map.mappings).not.toBe('');
  });


  it('formats generated JavaScript across lines and maps the generated positions', () => {
    const source = '<StBox><StLabel>{{name}}</StLabel></StBox>';
    const parsed = parseGtpl(source);
    expect(parsed.diagnostics).toEqual([]);
    const generated = emitGtplTemplateWithSourceMap(parsed.nodes, { source: 'view.gtpl' });
    expect(generated.code).toContain('\n');
    expect(generated.code).toMatch(/=> \{\n\s+return/);
    expect(generated.map.mappings.split(';').length).toBeGreaterThan(1);
    expect(generated.code).not.toContain('__GEF_MAP_');
  });

  it('maps nested elements and their text nodes', () => {
    const source = `<StBox>
  <StLabel>{{name}}</StLabel>
</StBox>`;
    const parsed = parseGtpl(source);
    expect(parsed.diagnostics).toEqual([]);
    const generated = emitGtplTemplateWithSourceMap(parsed.nodes, { source: 'view.gtpl' });
    expect(generated.map.mappings.split(/[;,]/).filter(Boolean)).toHaveLength(4);
    expect(generated.code).not.toContain('__GEF_MAP_');
    expect(generated.map.mappings).not.toBe('');
  });


  it('maps interpolation and expression-bound attribute source positions', () => {
    const source = '<StLabel [visible]="ready && enabled">{{user.name}}</StLabel>';
    const parsed = parseGtpl(source);
    expect(parsed.diagnostics).toEqual([]);
    const generated = emitGtplTemplateWithSourceMap(parsed.nodes, { source: 'view.gtpl' });
    // Element, text node, three binding AST nodes and two interpolation AST nodes.
    expect(generated.map.mappings.split(/[;,]/).filter(Boolean)).toHaveLength(7);
    expect(generated.code).not.toContain('__GEF_MAP_');
  });


  it('maps expressions in control-flow blocks to their source positions', () => {
    const source = '@let title = heading;\\n@if (visible) { {{title}} }\\n@for (item of items; track item.id) { {{item.name}} }\\n@switch (state) { @case ("ready") { Ready } }';
    const parsed = parseGtpl(source);
    expect(parsed.diagnostics).toEqual([]);
    const generated = emitGtplTemplateWithSourceMap(parsed.nodes, { source: 'view.gtpl' });
    // Four block expressions, two interpolations, and their rendered template nodes.
    expect(generated.map.mappings.split(/[;,]/).filter(Boolean).length).toBeGreaterThanOrEqual(10);
    expect(generated.code).not.toContain('__GEF_MAP_');
  });

  it('maps nested expression AST nodes independently', () => {
    const source = '<StLabel [visible]="ready && user.isActive(name)">{{user.profile.name}}</StLabel>';
    const parsed = parseGtpl(source);
    expect(parsed.diagnostics).toEqual([]);
    const generated = emitGtplTemplateWithSourceMap(parsed.nodes, { source: 'view.gtpl' });
    expect(generated.map.mappings.split(/[;,]/).filter(Boolean).length).toBeGreaterThan(10);
    expect(generated.code).not.toContain('__GEF_MAP_');
  });

  it('ignores formatting whitespace between native child widgets', () => {
    const parsed = parseGtpl(`<AdwPreferencesPage>
  <AdwPreferencesGroup>
    <AdwActionRow title="General" />
  </AdwPreferencesGroup>
</AdwPreferencesPage>`);
    expect(parsed.diagnostics).toEqual([]);
    const source = emitGtplTemplate(parsed.nodes);
    expect(source).not.toContain('runtime.fragment');
    expect(source).toContain('runtime.element("AdwPreferencesGroup"');
    expect(source).toContain('runtime.element("AdwActionRow"');
  });

  it('preserves whitespace that belongs to text content', () => {
    const output = emit('<StLabel>\\n  Hello\\n</StLabel>');
    expect(output).toContain('\\\\n  Hello\\\\n');
  });

  it('preserves whitespace around inline child widgets', () => {
    const output = emit('<StLabel>Before\\n  <StIcon />\\nAfter</StLabel>');
    expect(output).toContain('\\\\n  ');
    expect(output).toContain('\\\\nAfter');
  });

  it('treats free template identifiers as context members by default', () => {
    const parsed = parseGtpl('<StLabel>{{name}}</StLabel>');
    expect(parsed.diagnostics).toEqual([]);
    expect(emitGtplTemplate(parsed.nodes)).toContain('ctx.name');
  });

  it('keeps built-in globals unqualified while resolving context members', () => {
    const parsed = parseGtpl('<StLabel>{{String(name)}}</StLabel>');
    expect(parsed.diagnostics).toEqual([]);
    expect(emitGtplTemplate(parsed.nodes)).toContain('String(ctx.name)');
  });

  it('emits elements, static attributes and interpolated text', () => {
    const output = emit('<label class="title">Hello {{name}}</label>', ['name']);
    expect(output).toContain('runtime.element("label"');
    expect(output).toContain('"class": "title"');
    expect(compact(output)).toContain(`runtime.text(runtime.bind(() => "Hello " + String(ctx.name ?? '')))`);
  });

  it('emits object literals and resolves every class/style expression identifier', () => {
    const output = emit('<StLabel [class]="{ active: isActive, disabled: isDisabled }" [style]="{ color: textColor }" />', ['isActive', 'isDisabled', 'textColor']);
    expect(output).toContain('"active": ctx.isActive');
    expect(output).toContain('"disabled": ctx.isDisabled');
    expect(output).toContain('"color": ctx.textColor');
  });

  it('emits property bindings and event callbacks', () => {
    const output = emit('<button [sensitive]="enabled" (clicked)="activate()">Go</button>', ['enabled', 'activate']);
    expect(compact(output)).toContain('"sensitive": runtime.bind(() => ctx.enabled)');
    expect(compact(output)).toContain('"clicked": ($event) => (ctx.activate())');
  });

  it('emits if/else, for/empty, switch and let control flow', () => {
    const output = emit(`@let title = heading;
@if (visible; as shown) { <label>{{shown}}</label> } @else { <label>Hidden</label> }
@for (item of items; track item.id; let i = $index) { <label>{{item.name}} {{i}}</label> } @empty { Empty }
@switch (state) { @case ("ready") { Ready } @default { Wait } }`, ['heading', 'visible', 'items', 'state']);
    expect(compact(output)).toContain('const title = ctx.heading');
    expect(compact(output)).toContain('runtime.if(runtime.bind(() => ctx.visible)');
    expect(compact(output)).toContain('runtime.for( runtime.bind(() => ctx.items)');
    expect(compact(output)).toContain('return (item.id)');
    expect(compact(output)).toContain('runtime.switch(runtime.bind(() => ctx.state)');
  });

  it('evaluates an aliased if condition once and renders only the selected branch', () => {
    const output = emit('@if (getValue(); as value) { {{value}} } @else { fallback }', ['getValue']);
    const render = new Function(`return ${output}`)() as (ctx: unknown, runtime: unknown) => unknown;
    let calls = 0;
    const runtime = {
      fragment: (children: unknown[]) => children,
      text: (value: string | { get: () => unknown }) => typeof value === 'string' ? value : String(value.get()),
      bind: (get: () => unknown) => ({ kind: 'binding', get }),
      if: (condition: unknown, yes: (value: unknown) => unknown, no: () => unknown) => {
        const value = typeof condition === 'object' && condition !== null && 'get' in condition
          ? (condition.get as () => unknown)() : condition;
        return value ? yes(value) : no();
      },
    };
    expect(render({ getValue: () => { calls += 1; return 'ready'; } }, runtime)).toBe('ready ');
    expect(calls).toBe(1);
  });

  it('emits lowered two-way bindings as a property and event callback', () => {
    const parsed = parseGtpl('<GefSlider [(value)]="volume" />');
    const lowered = lowerGtplStructuralDirectives(parsed.nodes);
    expect(lowered.diagnostics).toEqual([]);
    const output = emitGtplTemplate(lowered.nodes, { componentMembers: ['volume'] });
    expect(compact(output)).toContain('"value": runtime.bind(() => ctx.volume)');
    expect(compact(output)).toContain('"valueChange": ($event) => (ctx.volume = $event)');
  });

  it('runs generated template source through the runtime and host', () => {
    type Node = { kind: string; value?: unknown; children?: readonly Node[] };
    const parsed = parseGtpl('<StLabel class="title">Hello {{name}}</StLabel>');
    const lowered = lowerGtplStructuralDirectives(parsed.nodes);
    const source = emitGtplTemplate(lowered.nodes, { componentMembers: ['name'] });
    const render = new Function(`return ${source}`)() as (context: { name: string }, runtime: unknown) => Node;
    const host: GtplRenderHost<Node> = {
      destroy: () => {},
      element: (kind, value, children) => ({ kind, value, children: children ? [children] : [] }),
      text: (value) => ({ kind: 'text', value: typeof value === 'string' ? value : value.get() }),
      fragment: (children) => ({ kind: 'fragment', children }),
      repeat: (state) => ({ kind: 'repeat', value: state.get() }),
      conditional: (condition, renderBranch, fallback) => condition.get() ? renderBranch(condition.get()) : fallback(),
      switch: (value, cases, renderDefault) => {
        const current = value.get();
        return cases.find((branch) => branch.values.some((candidate) => Object.is(candidate, current)))?.render()
          ?? renderDefault?.() ?? { kind: 'fragment', children: [] };
      },
    };
    const view = mountGtplTemplate({ name: 'GEF' }, render, host);
    expect(view.node).toMatchObject({
      kind: 'StLabel',
      value: { class: 'title' },
      children: [{ kind: 'text', value: 'Hello GEF' }],
    });
    view.dispose();
  });

  it('rejects structural shorthand until its dedicated lowering pass exists', () => {
    const parsed = parseGtpl('<label *if="visible">Shown</label>');
    expect(() => emitGtplTemplate(parsed.nodes, { componentMembers: ['visible'] }))
      .toThrow(/requires a lowering pass/);
  });

  it('qualifies component members but preserves local variables and globals', () => {
    const output = emit('<label>{{name}} {{Math.max(count, 1)}}</label>', ['name', 'count']);
    expect(output).toContain('ctx.name');
    expect(compact(output)).toContain('(Math.max)(ctx.count, 1)');
  });
});
