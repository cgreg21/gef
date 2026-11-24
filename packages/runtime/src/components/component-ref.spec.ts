import { describe, expect, it, vi } from 'vitest';
import { InjectionToken, Injector } from '../di/injector.js';
import { mountComponent } from './component-ref.js';
import { EventEmitter } from '../../../shared/src/events/event-emitter.js';
import { signal } from '../reactivity/signal.js';
import type { GtplRenderHost } from '../rendering/gtpl-runtime.js';

type Node = { readonly kind: string; readonly value?: unknown; readonly children?: readonly Node[] };

function createHost(order: string[] = []): GtplRenderHost<Node> {
  return {
    destroy: () => { order.push('view'); },
    element: (name, attributes, child) => ({ kind: name, value: attributes, children: child ? [child] : [] }),
    text: (value) => ({ kind: 'text', value: typeof value === 'string' ? value : value.get() }),
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

describe('mountComponent', () => {
  it('owns component, view and child injector lifetimes in reverse order', () => {
    const DEPENDENCY = new InjectionToken<string>('dependency');
    const LOCAL = new InjectionToken<object>('local');
    const order: string[] = [];
    const parent = new Injector([{ provide: DEPENDENCY, useValue: 'ready' }]);
    const component = mountComponent({
      create: (injector) => { injector.get(LOCAL); return { value: injector.get(DEPENDENCY) }; },
      render: (instance, runtime) => runtime.text(instance.value),
      providers: [{ provide: LOCAL, useValue: {}, dispose: () => order.push('injector') }],
      dispose: () => order.push('component'),
    }, parent, createHost(order));

    expect(component.view.node).toEqual({ kind: 'text', value: 'ready' });
    component.destroy();
    component.destroy();
    expect(order).toEqual(['view', 'component', 'injector']);
    expect(parent.get(DEPENDENCY)).toBe('ready');
    parent.destroy();
  });

  it('assigns inputs before initialization and exposes outputs with owned cleanup', () => {
    const output = new EventEmitter<string>();
    const order: string[] = [];
    const parent = new Injector();
    const component = mountComponent({
      create: () => ({
        label: 'initial',
        output,
        onInit() { order.push(`init:${this.label}`); },
      }),
      inputs: [{ publicName: 'label', member: 'label' }],
      outputs: [{ publicName: 'changed', member: 'output' }],
      render: (instance, runtime) => runtime.text(instance.label),
    }, parent, createHost(), { label: 'provided' });
    expect(order).toEqual(['init:provided']);
    expect(component.outputs.changed).toBe(output);
    component.destroy();
    expect(() => output.emit('closed')).not.toThrow();
    parent.destroy();
  });

  it('updates bound inputs reactively and stops them when the component is destroyed', () => {
    const value = signal('first');
    const lifecycle: string[] = [];
    const parent = new Injector();
    const component = mountComponent({
      create: () => ({
        label: 'initial',
        onInit() { lifecycle.push(`init:${this.label}`); },
        onDestroy() { lifecycle.push(`destroy:${this.label}`); },
      }),
      inputs: [{ publicName: 'label', member: 'label' }],
      render: (instance, runtime) => runtime.text(instance.label),
    }, parent, createHost(), {
      label: { kind: 'binding', get: () => value.get() },
    });

    expect(component.instance.label).toBe('first');
    value.set('second');
    expect(component.instance.label).toBe('second');

    component.destroy();
    value.set('third');
    expect(component.instance.label).toBe('second');
    expect(lifecycle).toEqual(['init:first', 'destroy:second']);
    parent.destroy();
  });

  it('applies static and reactive component host property bindings', () => {
    const value = signal('first');
    const properties: Array<[string, unknown]> = [];
    const host = createHost();
    host.setProperty = (_node, property, next) => { properties.push([property, next]); };
    const parent = new Injector();
    const component = mountComponent({
      create: () => ({ label: { kind: 'binding' as const, get: () => value.get() } }),
      hostBindings: [{ member: 'label', property: 'accessible-label' }],
      render: (_instance, runtime) => runtime.text('host binding'),
    }, parent, host);
    expect(properties).toEqual([['accessible-label', 'first']]);
    value.set('second');
    expect(properties.at(-1)).toEqual(['accessible-label', 'second']);
    component.destroy();
    value.set('third');
    expect(properties.at(-1)).toEqual(['accessible-label', 'second']);
    parent.destroy();
  });

  it('cleans up the child injector when component creation fails', () => {
    const LOCAL = new InjectionToken<object>('local');
    const dispose = vi.fn();
    const parent = new Injector();
    expect(() => mountComponent({
      providers: [{ provide: LOCAL, useValue: {}, dispose }],
      create: () => { throw new Error('create failed'); },
      render: () => ({ kind: 'unused' }),
    }, parent, createHost())).toThrow('create failed');
    expect(dispose).not.toHaveBeenCalled();
    parent.destroy();
  });

  it('cleans component and injector if template rendering fails', () => {
    const LOCAL = new InjectionToken<object>('local');
    const order: string[] = [];
    const parent = new Injector();
    expect(() => mountComponent({
      providers: [{ provide: LOCAL, useValue: {}, dispose: () => order.push('injector') }],
      create: (injector) => { injector.get(LOCAL); return { value: 'ready' }; },
      render: () => { throw new Error('render failed'); },
      dispose: () => order.push('component'),
    }, parent, createHost())).toThrow('render failed');
    expect(order).toEqual(['component', 'injector']);
    parent.destroy();
  });
});
