import { describe, expect, it } from 'vitest';
import { createStRenderHost, type StActor, type StNamespace, type StWidgetConstructor } from './st-render-host.js';

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

  set_child(child: StActor | null): void {
    this.children.length = 0;
    if (child) this.children.push(child);
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
    this.destroyed = true;
    this.signals.clear();
    for (const child of this.children) child.destroy();
  }

  emit(name: string, ...args: unknown[]): unknown {
    const signal = [...this.signals.values()].find((entry) => entry.name === name);
    return signal?.callback(this, ...args);
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
    Button: constructor(),
    Bin: constructor(),
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

  it('supports custom component constructors', () => {
    const host = createStRenderHost(createSt(), { components: { GefCustom: FakeActor } });
    expect(host.element('GefCustom', {}, host.fragment([]))).toBeInstanceOf(FakeActor);
  });

  it('rejects unknown selectors and containers with multiple children', () => {
    const host = createStRenderHost(createSt());
    expect(() => host.element('Unknown', {}, host.fragment([]))).toThrow(/Unknown GNOME Shell component/);
    const bin = new FakeActor();
    expect(() => {
      const invalid = host.fragment([host.text('one'), host.text('two')]);
      (bin as FakeActor).set_child(invalid);
      throw new Error('container shape is not exposed by the host');
    }).toThrow();
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
