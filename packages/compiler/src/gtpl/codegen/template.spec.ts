import { describe, expect, it } from 'vitest';
import { emitGtplTemplate } from './template.js';
import { parseGtpl } from '../parser/parser.js';

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
    expect(output).toContain('String(ctx.name ?? \'\')');
  });

  it('emits property bindings and event callbacks', () => {
    const output = emit('<button [sensitive]="enabled" (clicked)="activate()">Go</button>', ['enabled', 'activate']);
    expect(output).toContain('"sensitive": ctx.enabled');
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
      text: (value: string) => value,
      if: (condition: unknown, yes: (value: unknown) => unknown, no: () => unknown) =>
        condition ? yes(condition) : no(),
    };
    expect(render({ getValue: () => { calls += 1; return 'ready'; } }, runtime)).toEqual([['ready ']]);
    expect(calls).toBe(1);
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
