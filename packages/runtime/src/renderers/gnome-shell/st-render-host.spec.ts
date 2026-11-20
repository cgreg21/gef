import { describe, expect, it } from 'vitest';
import { createStRenderHost, type StActor, type StNamespace, type StWidgetConstructor } from './st-render-host.js';
import { createGtplRenderRuntime } from '../../rendering/gtpl-runtime.js';
import { signal } from '../../reactivity/signal.js';

class FakeActor implements StActor {
  readonly properties: Record<string, unknown>;
  readonly children: StActor[] = [];
  readonly signals = new Map<number, { name: string; callback: (actor: StActor, ...args: unknown[]) => unknown }>();
  destroyed = false;
  private nextSignal = 1;

  constructor(properties: Record<string, unknown> = {}) {
    this.properties = properties;
  }

  add_child(child: StActor): void {
    this.children.push(child);
  }

  connect(name: string, callback: (actor: StActor, ...args: unknown[]) => unknown): number {
    const id = this.nextSignal++;
    this.signals.set(id, { name, callback });
    return id;
  }

  disconnect(id: number): void {
    this.signals.delete(id);
  }

  destroy(): void {
    this.emit('destroy');
    this.destroyed = true;
    this.signals.clear();
    for (const child of this.children) child.destroy();
  }

  set_property(name: string, value: unknown): void {
    this.properties[name] = value;
  }

  emit(name: string, ...args: unknown[]): unknown {
    const signal = [...this.signals.values()].find((entry) => entry.name === name);
    return signal?.callback(this, ...args);
  }
}

class FakeBin extends FakeActor {
  set_child(child: StActor | null): void {
    this.children.length = 0;
    if (child) this.children.push(child);
  }
}

function constructor(): StWidgetConstructor {
  return FakeActor;
}

function createSt(): StNamespace {
  return {
    BoxLayout: constructor(),
    Label: constructor(),
    Icon: constructor(),
    Button: FakeBin,
    Bin: FakeBin,
    Widget: constructor(),
  };
}

describe('createStRenderHost', () => {
  it('creates registered St widgets with normalized GObject property names', () => {
    const host = createStRenderHost(createSt());
    const child = host.text('Hello');
    const actor = host.element('StLabel', { styleClass: 'title' }, child) as FakeActor;
    expect(actor.properties).toEqual({ style_class: 'title' });
    expect(actor.children).toEqual([child]);
  });

  it('connects events and passes signal arguments to handlers', () => {
    const host = createStRenderHost(createSt());
    let received: unknown;
    const actor = host.element('StButton', { clicked: (event: unknown) => { received = event; } }, host.fragment([])) as FakeActor;
    actor.emit('clicked', 2);
    expect(received).toBe(2);
    host.destroy(actor);
    expect(actor.signals.size).toBe(0);
  });

  it('updates bound properties and text from signals, then unsubscribes on destroy', () => {
    const host = createStRenderHost(createSt());
    const runtime = createGtplRenderRuntime(host);
    const title = signal('before');
    const actor = host.element('StLabel', { text: runtime.bind(() => title.get()) }, host.fragment([])) as FakeActor;
    expect(actor.properties.text).toBe('before');
    title.set('after');
    expect(actor.properties.text).toBe('after');
    host.destroy(actor);
    title.set('ignored');
    expect(actor.properties.text).toBe('after');

    const text = signal('first');
    const label = host.text(runtime.bind(() => text.get())) as FakeActor;
    expect(label.properties.text).toBe('first');
    text.set('second');
    expect(label.properties.text).toBe('second');
    host.destroy(label);
    text.set('third');
    expect(label.properties.text).toBe('second');
  });

  it('supports custom component constructors', () => {
    const host = createStRenderHost(createSt(), { components: { GefCustom: FakeActor } });
    expect(host.element('GefCustom', {}, host.fragment([]))).toBeInstanceOf(FakeActor);
  });

  it('rejects unknown selectors', () => {
    const host = createStRenderHost(createSt());
    expect(() => host.element('Unknown', {}, host.fragment([]))).toThrow(/Unknown GNOME Shell component/);
  });

  it('creates fragment and repeat containers with their child actors', () => {
    const host = createStRenderHost(createSt());
    const first = host.text('first');
    const second = host.text('second');
    const fragment = host.fragment([first, second]) as FakeActor;
    const repeat = host.repeat([
      { key: 'a', index: 0, node: first },
      { key: 'b', index: 1, node: second },
    ]) as FakeActor;
    expect(fragment.children).toEqual([first, second]);
    expect(repeat.children).toEqual([first, second]);
  });

  it('destroys a root and its child actors idempotently', () => {
    const host = createStRenderHost(createSt());
    const child = host.text('child') as FakeActor;
    const root = host.element('StBox', {}, child) as FakeActor;
    host.destroy(root);
    host.destroy(root);
    expect(root.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
  });
});
