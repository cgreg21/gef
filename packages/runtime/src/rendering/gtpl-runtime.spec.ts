import { describe, expect, it } from 'vitest';
import { createGtplRenderRuntime, mountGtplTemplate, type GtplRenderHost } from './gtpl-runtime.js';

type Node = { readonly kind: string; readonly value?: unknown; readonly children?: readonly Node[] };

function createHost(): GtplRenderHost<Node> {
  return {
    destroy: () => {},
    element: (name, attributes, children) => ({ kind: name, value: attributes, children: children ? [children] : [] }),
    text: (value) => ({ kind: 'text', value }),
    fragment: (children) => ({ kind: 'fragment', children }),
    repeat: (state) => ({ kind: 'repeat', value: state.get() }),
    conditional: (condition, render, fallback) => condition.get() ? render(condition.get()) : fallback(),
    switch: (value, cases, renderDefault) => {
      const current = value.get();
      return cases.find((branch) => branch.values.some((candidate) => Object.is(candidate, current)))?.render()
        ?? renderDefault?.() ?? { kind: 'fragment', children: [] };
    },
  };
}

describe('createGtplRenderRuntime', () => {
  it('creates elements, text and fragments through the host', () => {
    const runtime = createGtplRenderRuntime(createHost());
    const node = runtime.element('StLabel', { text: 'Ready' }, runtime.text('Hello'));
    expect(node).toMatchObject({ kind: 'StLabel', value: { text: 'Ready' }, children: [{ kind: 'text', value: 'Hello' }] });
  });

  it('creates explicit binding values for reactive hosts', () => {
    const runtime = createGtplRenderRuntime(createHost());
    const value = runtime.bind(() => 'current');
    expect(value.kind).toBe('binding');
    expect(value.get()).toBe('current');
  });

  it('renders only the selected conditional branch and passes the condition value', () => {
    const runtime = createGtplRenderRuntime(createHost());
    expect(runtime.if('ready', (value) => ({ kind: 'yes', value }), () => ({ kind: 'no' })))
      .toEqual({ kind: 'yes', value: 'ready' });
    expect(runtime.if(false, () => ({ kind: 'yes' }), () => ({ kind: 'no' })))
      .toEqual({ kind: 'no' });
  });

  it('renders iterable items with stable keys and contextual indexes', () => {
    const runtime = createGtplRenderRuntime(createHost());
    const result = runtime.for(
      ['a', 'b'],
      (item, index, count) => ({ kind: 'item', value: [item, index, count] }),
      (item) => item,
      () => ({ kind: 'empty' }),
    );
    expect(result).toMatchObject({
      kind: 'repeat',
      value: {
        items: [
          { key: 'a', index: 0, node: { kind: 'item', value: ['a', 0, 2] } },
          { key: 'b', index: 1, node: { kind: 'item', value: ['b', 1, 2] } },
        ],
      },
    });
  });

  it('rejects duplicate track keys and cleans nodes already rendered', () => {
    const destroyed: unknown[] = [];
    const runtime = createGtplRenderRuntime({
      ...createHost(),
      destroy: (node) => { destroyed.push(node); },
    });
    expect(() => runtime.for(
      ['same', 'same'],
      (value) => ({ kind: 'item', value }),
      () => 'duplicate',
      () => ({ kind: 'empty' }),
    )).toThrow('Duplicate GTPL @for track key.');
    expect(destroyed).toEqual([{ kind: 'item', value: 'same' }]);
  });

  it('uses the empty branch for null and empty iterables', () => {
    const runtime = createGtplRenderRuntime(createHost());
    const empty = () => ({ kind: 'empty' });
    expect(runtime.for(null, () => ({ kind: 'item' }), () => 0, empty)).toMatchObject({ kind: 'repeat', value: { items: [], empty: { kind: 'empty' } } });
    expect(runtime.for([], () => ({ kind: 'item' }), () => 0, empty)).toMatchObject({ kind: 'repeat', value: { items: [], empty: { kind: 'empty' } } });
  });

  it('selects the first matching switch case and falls back otherwise', () => {
    const runtime = createGtplRenderRuntime(createHost());
    const cases = [
      { values: ['ready', 'active'], render: () => ({ kind: 'active' }) },
      { values: [0], render: () => ({ kind: 'zero' }) },
    ];
    expect(runtime.switch('active', cases, () => ({ kind: 'default' }))).toEqual({ kind: 'active' });
    expect(runtime.switch('missing', cases, () => ({ kind: 'default' }))).toEqual({ kind: 'default' });
    expect(runtime.switch(0, cases)).toEqual({ kind: 'zero' });
  });

  it('mounts a generated view and destroys its root exactly once', () => {
    const destroyed: Node[] = [];
    const host = createHost();
    const view = mountGtplTemplate(
      { label: 'Ready' },
      (context, runtime) => runtime.element('StLabel', { text: context.label }, runtime.text(context.label)),
      { ...host, destroy: (node) => { destroyed.push(node); } },
    );
    expect(view.node).toMatchObject({ kind: 'StLabel' });
    view.dispose();
    view.dispose();
    expect(destroyed).toEqual([view.node]);
  });

  it('propagates host and render callback errors', () => {
    const runtime = createGtplRenderRuntime(createHost());
    expect(() => runtime.if(true, () => { throw new Error('render failed'); }))
      .toThrow('render failed');
  });
});
