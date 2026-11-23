import { describe, expect, it } from 'vitest';
import { createStRenderHost, type StActor, type StNamespace, type StWidgetConstructor } from './st-render-host.js';
import { createGtplRenderRuntime } from '../../rendering/gtpl-runtime.js';
import { signal } from '../../reactivity/signal.js';
import { ComponentRegistry } from '../../components/component-registry.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';
import { Injector } from '../../di/injector.js';

class FakeActor implements StActor {
  readonly properties: Record<string, unknown>;
  readonly children: StActor[] = [];
  readonly signals = new Map<number, { name: string; callback: (actor: StActor, ...args: unknown[]) => unknown }>();
  destroyed = false;
  destroyCount = 0;
  private nextSignal = 1;

  constructor(properties: Record<string, unknown> = {}) {
    this.properties = properties;
  }

  add_child(child: StActor): void {
    this.children.push(child);
  }

  remove_child(child: StActor): void {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
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
    this.destroyCount += 1;
    this.emit('destroy');
    this.destroyed = true;
    this.signals.clear();
    const children = [...this.children];
    this.children.length = 0;
    for (const child of children) child.destroy();
  }

  set_property(name: string, value: unknown): void {
    this.properties[name] = value;
  }

  emit(name: string, ...args: unknown[]): unknown {
    let result: unknown;
    for (const signal of [...this.signals.values()]) {
      if (signal.name === name) result = signal.callback(this, ...args);
    }
    return result;
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
    Entry: constructor(),
    ScrollView: constructor(),
    Frame: constructor(),
    Switch: constructor(),
    Slider: constructor(),
    Spinner: constructor(),
    ProgressBar: constructor(),
    CheckBox: constructor(),
    ComboBox: constructor(),
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

  it('registers the common GNOME Shell St widget constructors', () => {
    const host = createStRenderHost(createSt());
    for (const name of ['StEntry', 'StScrollView', 'StFrame', 'StSwitch', 'StSlider', 'StSpinner', 'StProgressBar', 'StCheckBox', 'StComboBox', 'HeaderBar', 'Sidebar']) {
      expect(host.element(name, {}, undefined)).toBeInstanceOf(FakeActor);
    }
  });

  it('sets horizontal and vertical defaults for GTPL shell containers', () => {
    const host = createStRenderHost(createSt());
    expect((host.element('HeaderBar', {}, undefined) as FakeActor).properties.orientation).toBe(0);
    expect((host.element('Sidebar', {}, undefined) as FakeActor).properties.orientation).toBe(1);
  });

  it('places GTPL Grid children into native horizontal rows', () => {
    const host = createStRenderHost(createSt());
    const items = [host.text('A'), host.text('B'), host.text('C')];
    const fragment = host.fragment(items);
    const grid = host.element('Grid', { columns: '2', gap: '10' }, fragment) as FakeActor;

    expect(grid.properties).toMatchObject({ orientation: 1, spacing: 10 });
    expect(grid.children).toHaveLength(2);
    expect((grid.children[0] as FakeActor).properties).toMatchObject({ orientation: 0, spacing: 10 });
    expect((grid.children[0] as FakeActor).children).toEqual(items.slice(0, 2));
    expect((grid.children[1] as FakeActor).children).toEqual(items.slice(2));
    host.destroy(grid);
    expect(() => host.element('Grid', { columns: '0' }, undefined)).toThrow(/positive integer/);
  });

  it('maps GTPL Flex direction, gap and homogeneous to native St box properties', () => {
    const host = createStRenderHost(createSt());
    const direction = signal('column');
    const homogeneous = signal('true');
    const flex = host.element('Flex', {
      direction: { kind: 'binding', get: () => direction.get() },
      gap: 8,
      homogeneous: { kind: 'binding', get: () => homogeneous.get() },
    }, undefined) as FakeActor;

    expect(flex.properties).toMatchObject({ orientation: 1, spacing: 8, homogeneous: true });
    direction.set('row');
    homogeneous.set('false');
    expect(flex.properties.orientation).toBe(0);
    expect(flex.properties.homogeneous).toBe(false);
    host.destroy(flex);
    expect(() => host.element('Flex', { gap: -1 }, undefined)).toThrow(/Flex gap/);
    expect(() => host.element('Flex', { homogeneous: 'yes' }, undefined)).toThrow(/Flex homogeneous/);
  });

  it('does not add synthetic empty containers to leaf widgets', () => {
    const host = createStRenderHost(createSt());
    const actor = host.element('StLabel', {}, undefined) as FakeActor;
    expect(actor.children).toHaveLength(0);
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

  it('updates conditional and switch branches when their signals change', () => {
    const host = createStRenderHost(createSt());
    const runtime = createGtplRenderRuntime(host);
    const ready = signal(false);
    const conditional = runtime.if(
      runtime.bind(() => ready.get()),
      () => host.text('ready'),
      () => host.text('waiting'),
    ) as FakeBin;
    expect((conditional.children[0] as FakeActor).properties.text).toBe('waiting');
    ready.set(true);
    expect((conditional.children[0] as FakeActor).properties.text).toBe('ready');
    host.destroy(conditional);
    ready.set(false);
    expect(conditional.children).toHaveLength(0);

    const state = signal('idle');
    const switched = runtime.switch(
      runtime.bind(() => state.get()),
      [{ values: ['ready'], render: () => host.text('ready') }],
      () => host.text('idle'),
    ) as FakeBin;
    expect((switched.children[0] as FakeActor).properties.text).toBe('idle');
    state.set('ready');
    expect((switched.children[0] as FakeActor).properties.text).toBe('ready');
    const selected = switched.children[0] as FakeActor;
    host.destroy(switched);
    expect(selected.destroyCount).toBe(1);
  });

  it('reconciles repeated items by key when a collection signal changes', () => {
    const host = createStRenderHost(createSt());
    const runtime = createGtplRenderRuntime(host);
    const values = signal(['a', 'b']);
    const list = runtime.for(
      runtime.bind(() => values.get()),
      (value) => host.text(value),
      (value) => value,
      () => host.text('empty'),
    ) as FakeActor;
    const originalB = list.children[1];
    values.set(['b', 'c']);
    expect(list.children).toHaveLength(2);
    expect(list.children[0]).toBe(originalB);
    expect((list.children[0] as FakeActor).properties.text).toBe('b');
    expect((list.children[1] as FakeActor).properties.text).toBe('c');
    expect((list.children[0] as FakeActor).destroyed).toBe(false);
    host.destroy(list);
    values.set(['x']);
    expect(list.children).toHaveLength(0);
  });

  it('supports custom component constructors', () => {
    const host = createStRenderHost(createSt(), { components: { GefCustom: FakeActor } });
    expect(host.element('GefCustom', {}, host.fragment([]))).toBeInstanceOf(FakeActor);
  });

  it('mounts registered components and cleans their outputs when the St actor is destroyed', () => {
    const host = createStRenderHost(createSt());
    const changed = new EventEmitter<string>();
    const registry = new ComponentRegistry<StActor>().register('GefButton', {
      create: () => ({ label: 'initial', changed }),
      inputs: [{ publicName: 'label', member: 'label' }],
      outputs: [{ publicName: 'pressed', member: 'changed' }],
      render: (instance, runtime) => runtime.element('StLabel', { text: instance.label }, undefined),
    });
    const received: string[] = [];
    const runtime = createGtplRenderRuntime(host, undefined, undefined, new Injector(), registry);
    const actor = runtime.element('GefButton', { label: 'ready', pressed: (value: string) => received.push(value) }, undefined) as FakeActor;
    expect(actor.properties.text).toBe('ready');
    changed.emit('first');
    host.destroy(actor);
    changed.emit('second');
    expect(received).toEqual(['first']);
    expect(actor.destroyed).toBe(true);
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
    const runtime = createGtplRenderRuntime(host);
    const repeat = runtime.for(
      ['a', 'b'],
      (value) => host.text(value),
      (value) => value,
      () => host.fragment([]),
    ) as FakeActor;
    expect(fragment.children).toEqual([first, second]);
    expect(repeat.children.map((child) => (child as FakeActor).properties.text)).toEqual(['a', 'b']);
  });


  it('destroys newly rendered repeat nodes when attaching a batch fails', () => {
    class FailingBox extends FakeActor {
      override add_child(_child: StActor): void {
        throw new Error('attachment failed');
      }
    }
    const St = { ...createSt(), BoxLayout: FailingBox };
    const host = createStRenderHost(St);
    const first = host.text('first') as FakeActor;
    const second = host.text('second') as FakeActor;

    expect(() => host.repeat({
      kind: 'binding',
      get: () => ({
        items: [
          { key: 'first', index: 0, node: first },
          { key: 'second', index: 1, node: second },
        ],
      }),
    })).toThrow('attachment failed');

    expect(first.destroyed).toBe(true);
    expect(second.destroyed).toBe(true);
    expect(first.destroyCount).toBe(1);
    expect(second.destroyCount).toBe(1);
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
