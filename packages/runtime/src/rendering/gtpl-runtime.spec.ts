import { describe, expect, it } from 'vitest';
import { createGtplRenderRuntime, type GtplRenderHost } from './gtpl-runtime.js';

type Node = { readonly kind: string; readonly value?: unknown; readonly children?: readonly Node[] };

function createHost(): GtplRenderHost<Node> {
  return {
    element: (name, attributes, children) => ({ kind: name, value: attributes, children: [children] }),
    text: (value) => ({ kind: 'text', value }),
    fragment: (children) => ({ kind: 'fragment', children }),
    repeat: (items) => ({ kind: 'repeat', value: items }),
  };
}

describe('createGtplRenderRuntime', () => {
  it('creates elements, text and fragments through the host', () => {
    const runtime = createGtplRenderRuntime(createHost());
    const node = runtime.element('StLabel', { text: 'Ready' }, runtime.text('Hello'));
    expect(node).toMatchObject({ kind: 'StLabel', value: { text: 'Ready' }, children: [{ kind: 'text', value: 'Hello' }] });
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
      value: [
        { key: 'a', index: 0, node: { kind: 'item', value: ['a', 0, 2] } },
        { key: 'b', index: 1, node: { kind: 'item', value: ['b', 1, 2] } },
      ],
    });
  });

  it('uses the empty branch for null and empty iterables', () => {
    const runtime = createGtplRenderRuntime(createHost());
    const empty = () => ({ kind: 'empty' });
    expect(runtime.for(null, () => ({ kind: 'item' }), () => 0, empty)).toEqual({ kind: 'empty' });
    expect(runtime.for([], () => ({ kind: 'item' }), () => 0, empty)).toEqual({ kind: 'empty' });
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

  it('propagates host and render callback errors', () => {
    const runtime = createGtplRenderRuntime(createHost());
    expect(() => runtime.if(true, () => { throw new Error('render failed'); }))
      .toThrow('render failed');
  });
});
