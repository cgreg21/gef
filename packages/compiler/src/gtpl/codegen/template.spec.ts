import { describe, expect, it } from 'vitest';
import { emitGtplTemplate } from './template.js';
import { parseGtpl } from '../parser/parser.js';
import { lowerGtplStructuralDirectives } from '../lowering/structural.js';
import { mountGtplTemplate, type GtplRenderHost } from '../../../../runtime/src/index.js';

function emit(source: string, componentMembers: string[] = []): string {
  const parsed = parseGtpl(source);
  expect(parsed.diagnostics).toEqual([]);
  return emitGtplTemplate(parsed.nodes, { componentMembers });
}

describe('emitGtplTemplate', () => {
  it('emits elements, static attributes and interpolated text', () => {
    const output = emit('<label class="title">Hello {{name}}</label>', ['name']);
    expect(output).toContain('runtime.element("label"');
    expect(output).toContain('"class": "title"');
    expect(output).toContain('runtime.text(runtime.bind(() => String(ctx.name ?? \'\')))');
  });

  it('emits property bindings and event callbacks', () => {
    const output = emit('<button [sensitive]="enabled" (clicked)="activate()">Go</button>', ['enabled', 'activate']);
    expect(output).toContain('"sensitive": runtime.bind(() => ctx.enabled)');
    expect(output).toContain('"clicked": ($event) => (ctx.activate())');
  });

  it('emits if/else, for/empty, switch and let control flow', () => {
    const output = emit(`@let title = heading;
@if (visible; as shown) { <label>{{shown}}</label> } @else { <label>Hidden</label> }
@for (item of items; track item.id; let i = $index) { <label>{{item.name}} {{i}}</label> } @empty { Empty }
@switch (state) { @case ("ready") { Ready } @default { Wait } }`, ['heading', 'visible', 'items', 'state']);
    expect(output).toContain('const title = ctx.heading');
    expect(output).toContain('runtime.if(ctx.visible');
    expect(output).toContain('runtime.for(ctx.items');
    expect(output).toContain('return (item.id)');
    expect(output).toContain('runtime.switch(ctx.state');
  });

  it('evaluates an aliased if condition once and renders only the selected branch', () => {
    const output = emit('@if (getValue(); as value) { {{value}} } @else { fallback }', ['getValue']);
    const render = new Function(`return ${output}`)() as (ctx: unknown, runtime: unknown) => unknown;
    let calls = 0;
    const runtime = {
      fragment: (children: unknown[]) => children,
      bind: (get: () => unknown) => ({ kind: 'binding', get }),
      text: (value: string | { get: () => unknown }) => typeof value === 'string' ? value : String(value.get()),
      if: (condition: unknown, yes: (value: unknown) => unknown, no: () => unknown) =>
        condition ? yes(condition) : no(),
    };
    expect(render({ getValue: () => { calls += 1; return 'ready'; } }, runtime)).toEqual([['ready ']]);
    expect(calls).toBe(1);
  });

  it('emits lowered two-way bindings as a property and event callback', () => {
    const parsed = parseGtpl('<GefSlider [(value)]="volume" />');
    const lowered = lowerGtplStructuralDirectives(parsed.nodes);
    expect(lowered.diagnostics).toEqual([]);
    const output = emitGtplTemplate(lowered.nodes, { componentMembers: ['volume'] });
    expect(output).toContain('"value": runtime.bind(() => ctx.volume)');
    expect(output).toContain('"valueChange": ($event) => (ctx.volume = $event)');
  });

  it('runs generated template source through the runtime and host', () => {
    type Node = { kind: string; value?: unknown; children?: readonly Node[] };
    const parsed = parseGtpl('<StLabel class="title">Hello {{name}}</StLabel>');
    const lowered = lowerGtplStructuralDirectives(parsed.nodes);
    const source = emitGtplTemplate(lowered.nodes, { componentMembers: ['name'] });
    const render = new Function(`return ${source}`)() as (context: { name: string }, runtime: unknown) => Node;
    const host: GtplRenderHost<Node> = {
      destroy: () => {},
      element: (kind, value, children) => ({ kind, value, children: [children] }),
      text: (value) => ({ kind: 'text', value: typeof value === 'string' ? value : value.get() }),
      fragment: (children) => ({ kind: 'fragment', children }),
      repeat: (items) => ({ kind: 'repeat', value: items }),
    };
    const view = mountGtplTemplate({ name: 'GEF' }, render, host);
    expect(view.node).toMatchObject({
      kind: 'fragment',
      children: [{
        kind: 'StLabel',
        value: { class: 'title' },
        children: [{ kind: 'fragment', children: [{ kind: 'text', value: 'Hello GEF' }] }],
      }],
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
    expect(output).toContain('(Math.max)(ctx.count, 1)');
  });
});
