import { describe, expect, it, vi } from 'vitest';
import { InjectionToken, Injector } from '../di/injector.js';
import { mountComponent, mountDecoratedComponent } from './component-ref.js';
import { ComponentRegistry } from './component-registry.js';
import { Component, Input } from '../../../shared/src/components/metadata.js';
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
  it('mounts decorated components directly from their metadata', () => {
    const lifecycle: string[] = [];
    @Component({ selector: 'test-root', template: '<TestLabel />' })
    class TestComponent {
      onInit(): void { lifecycle.push('init'); }
      onDestroy(): void { lifecycle.push('destroy'); }
    }
    const parent = new Injector();
    const component = mountDecoratedComponent(TestComponent, (_instance, runtime) => runtime.text('decorated'), parent, createHost());
    expect(component.view.node).toEqual({ kind: 'text', value: 'decorated' });
    expect(lifecycle).toEqual(['init']);
    component.destroy();
    expect(lifecycle).toEqual(['init', 'destroy']);
    parent.destroy();
  });

  it('mounts nested decorated components and destroys them with the root view', () => {
    const lifecycle: string[] = [];
    const callbacks = new Map<Node, Array<() => void>>();
    const host = createHost();
    host.onDestroy = (node, callback) => {
      const current = callbacks.get(node) ?? [];
      current.push(callback);
      callbacks.set(node, current);
    };
    host.destroy = (node) => {
      lifecycle.push(`view:${node.kind}`);
      for (const callback of callbacks.get(node) ?? []) callback();
    };

    @Component({ selector: 'gef-child', template: '<StLabel />' })
    class ChildComponent {
      @Input() label = 'default';
      onInit(): void { lifecycle.push(`child:init:${this.label}`); }
      onDestroy(): void { lifecycle.push('child:destroy'); }
    }
    @Component({ selector: 'gef-parent', template: '<gef-child />' })
    class ParentComponent {
      onInit(): void { lifecycle.push('parent:init'); }
      onDestroy(): void { lifecycle.push('parent:destroy'); }
    }

    const components = new ComponentRegistry<Node>().registerType(
      ChildComponent,
      (instance, runtime) => runtime.text(instance.label),
    );
    const parent = new Injector();
    const root = mountDecoratedComponent(
      ParentComponent,
      (_instance, runtime) => runtime.element('gef-child', { label: 'nested' }, undefined),
      parent,
      host,
      {},
      { components },
    );
    expect(root.view.node).toEqual({ kind: 'text', value: 'nested' });
    expect(lifecycle).toEqual(['parent:init', 'child:init:nested']);
    root.destroy();
    expect(lifecycle).toEqual([
      'parent:init', 'child:init:nested',
      'view:text', 'view:text', 'child:destroy', 'parent:destroy',
    ]);
    parent.destroy();
  });

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

  it('forwards component host class and style bindings to the native host', () => {
    const active = signal(true);
    const opacity = signal(0.5);
    const calls: Array<Record<string, unknown>> = [];
    const host = createHost();
    host.setHostAttributes = (_node, attributes) => { calls.push({ ...attributes }); };
    const parent = new Injector();
    const component = mountComponent({
      create: () => ({
        classes: { primary: true },
        active: { kind: 'binding' as const, get: () => active.get() },
        styles: { minWidth: '120px' },
        opacity: { kind: 'binding' as const, get: () => opacity.get() },
      }),
      hostBindings: [
        { member: 'classes', property: 'class' },
        { member: 'active', property: 'class.active' },
        { member: 'styles', property: 'style' },
        { member: 'opacity', property: 'style.opacity' },
      ],
      render: (_instance, runtime) => runtime.text('styled component'),
    }, parent, host);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      class: { primary: true },
      'class.active': expect.objectContaining({ kind: 'binding' }),
      style: { minWidth: '120px' },
      'style.opacity': expect.objectContaining({ kind: 'binding' }),
    });
    expect((calls[0]?.['class.active'] as { get(): boolean }).get()).toBe(true);
    expect((calls[0]?.['style.opacity'] as { get(): number }).get()).toBe(0.5);
    active.set(false);
    opacity.set(0.8);
    expect((calls[0]?.['class.active'] as { get(): boolean }).get()).toBe(false);
    expect((calls[0]?.['style.opacity'] as { get(): number }).get()).toBe(0.8);
    component.destroy();
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
