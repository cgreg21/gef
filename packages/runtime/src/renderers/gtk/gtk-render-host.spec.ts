import { describe, expect, it } from 'vitest';
import { createGtkRenderHost, type GtkActor, type GtkNamespace, type GtkWidgetConstructor } from './gtk-render-host.js';
import { createGtplRenderRuntime } from '../../rendering/gtpl-runtime.js';
import { signal } from '../../reactivity/signal.js';

class FakeWidget implements GtkActor {
  readonly properties: Record<string, unknown>;
  readonly children: GtkActor[] = [];
  readonly classes = new Set<string>();
  readonly signals = new Map<number, { name: string; callback: (actor: GtkActor, ...args: unknown[]) => unknown }>();
  parent: FakeWidget | null = null;
  private nextSignal = 1;

  constructor(properties: Record<string, unknown> = {}) { this.properties = properties; }
  append(child: GtkActor): void { this.attach(child); }
  add(child: GtkActor): void { this.attach(child); }
  remove(child: GtkActor): void {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    (child as FakeWidget).parent = null;
  }
  set_child(child: GtkActor | null): void {
    for (const previous of [...this.children]) this.remove(previous);
    if (child) this.attach(child);
  }
  set_property(name: string, value: unknown): void { this.properties[name] = value; }
  connect(name: string, callback: (actor: GtkActor, ...args: unknown[]) => unknown): number {
    const id = this.nextSignal++;
    this.signals.set(id, { name, callback });
    return id;
  }
  disconnect(id: number): void { this.signals.delete(id); }
  get_parent(): GtkActor | null { return this.parent; }
  add_css_class(name: string): void { this.classes.add(name); }
  remove_css_class(name: string): void { this.classes.delete(name); }
  emit(name: string, ...args: unknown[]): unknown {
    return [...this.signals.values()].find((entry) => entry.name === name)?.callback(this, ...args);
  }
  private attach(child: GtkActor): void {
    const widget = child as FakeWidget;
    widget.parent?.remove(widget);
    widget.parent = this;
    this.children.push(child);
  }
}

function constructor(): GtkWidgetConstructor { return FakeWidget; }
function createGtk(): GtkNamespace {
  return {
    Box: constructor(),
    Label: constructor(),
    Button: constructor(),
    Entry: constructor(),
    Image: constructor(),
    ScrolledWindow: constructor(),
  };
}

describe('createGtkRenderHost', () => {
  it('creates GTK widgets with normalized properties and optional children', () => {
    const host = createGtkRenderHost(createGtk());
    const label = host.element('GtkLabel', { label: 'Hello' }, undefined) as FakeWidget;
    expect(label.properties).toEqual({ label: 'Hello' });
    expect(label.children).toHaveLength(0);
  });

  it('uses GTK container APIs for nested children', () => {
    const host = createGtkRenderHost(createGtk());
    const child = host.text('Hello');
    const button = host.element('GtkButton', {}, child) as FakeWidget;
    expect(button.children).toEqual([child]);
    expect((child as FakeWidget).parent).toBe(button);
  });

  it('updates bound properties and text, then disposes subscriptions', () => {
    const host = createGtkRenderHost(createGtk());
    const runtime = createGtplRenderRuntime(host);
    const title = signal('before');
    const label = host.element('GtkLabel', { label: runtime.bind(() => title.get()) }, undefined) as FakeWidget;
    expect(label.properties.label).toBe('before');
    title.set('after');
    expect(label.properties.label).toBe('after');
    host.destroy(label);
    title.set('ignored');
    expect(label.properties.label).toBe('after');

    const text = signal('first');
    const textWidget = host.text(runtime.bind(() => text.get())) as FakeWidget;
    text.set('second');
    expect(textWidget.properties.label).toBe('second');
    host.destroy(textWidget);
    text.set('third');
    expect(textWidget.properties.label).toBe('second');
  });

  it('connects event signals and disconnects them on disposal', () => {
    const host = createGtkRenderHost(createGtk());
    let received: unknown;
    const button = host.element('GtkButton', { clicked: (event: unknown) => { received = event; } }, undefined) as FakeWidget;
    button.emit('clicked', 'activate');
    expect(received).toBe('activate');
    host.destroy(button);
    expect(button.signals.size).toBe(0);
  });

  it('updates CSS classes from static and reactive class attributes', () => {
    const host = createGtkRenderHost(createGtk());
    const runtime = createGtplRenderRuntime(host);
    const classes = signal('active');
    const widget = host.element('GtkBox', {
      class: 'base',
      className: runtime.bind(() => classes.get()),
    }, undefined) as FakeWidget;
    expect([...widget.classes].sort()).toEqual(['active', 'base']);
    classes.set('disabled');
    expect([...widget.classes].sort()).toEqual(['base', 'disabled']);
    host.destroy(widget);
    classes.set('gone');
    expect([...widget.classes].sort()).toEqual(['base', 'disabled']);
  });

  it('updates conditional branches and keyed loop children', () => {
    const host = createGtkRenderHost(createGtk());
    const runtime = createGtplRenderRuntime(host);
    const visible = signal(false);
    const conditional = runtime.if(
      runtime.bind(() => visible.get()),
      () => host.text('visible'),
      () => host.text('hidden'),
    ) as FakeWidget;
    expect((conditional.children[0] as FakeWidget).properties.label).toBe('hidden');
    visible.set(true);
    expect((conditional.children[0] as FakeWidget).properties.label).toBe('visible');
    host.destroy(conditional);

    const values = signal(['a', 'b']);
    const list = runtime.for(
      runtime.bind(() => values.get()),
      (value) => host.text(value),
      (value) => value,
      () => host.text('empty'),
    ) as FakeWidget;
    const originalB = list.children[1];
    values.set(['b', 'c']);
    expect(list.children[0]).toBe(originalB);
    expect(list.children.map((child) => (child as FakeWidget).properties.label)).toEqual(['b', 'c']);
    host.destroy(list);
  });

  it('supports registered libadwaita and custom widget constructors', () => {
    const host = createGtkRenderHost(createGtk(), {
      adw: { PreferencesPage: FakeWidget },
      components: { CustomRow: FakeWidget },
    });
    expect(host.element('AdwPreferencesPage', {}, undefined)).toBeInstanceOf(FakeWidget);
    expect(host.element('CustomRow', {}, undefined)).toBeInstanceOf(FakeWidget);
  });

  it('rejects unknown widget selectors', () => {
    const host = createGtkRenderHost(createGtk());
    expect(() => host.element('Unknown', {}, undefined)).toThrow(/Unknown GTK component/);
  });
});
