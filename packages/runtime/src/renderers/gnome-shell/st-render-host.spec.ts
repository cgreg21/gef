import { describe, expect, it } from 'vitest';
import { createStRenderHost, type StActor, type StNamespace, type StWidgetConstructor } from './st-render-host.js';
import { createGtplRenderRuntime } from '../../rendering/gtpl-runtime.js';
import { signal } from '../../reactivity/signal.js';
import { ComponentRegistry } from '../../components/component-registry.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';
import { Injector } from '../../di/injector.js';

class FakeActor implements StActor {
  styleUpdateCount = 0;
  readonly propertyUpdateCount = new Map<string, number>();
  classUpdateCount = 0;
  readonly properties: Record<string, unknown>;
  readonly children: StActor[] = [];
  insertCount = 0;
  reorderCount = 0;
  removeCount = 0;
  readonly signals = new Map<number, { name: string; callback: (actor: StActor, ...args: unknown[]) => unknown }>();
  readonly layoutManager = { homogeneous: false, set_homogeneous: (value: boolean) => { this.layoutManager.homogeneous = value; } };
  destroyed = false;
  destroyCount = 0;
  private nextSignal = 1;

  constructor(properties: Record<string, unknown> = {}) {
    this.properties = properties;
  }

  add_child(child: StActor): void {
    this.children.push(child);
  }

  insert_child_at_index(child: StActor, index: number): void {
    this.insertCount += 1;
    this.add_child(child);
    this.children.pop();
    this.children.splice(index, 0, child);
  }

  set_child_at_index(child: StActor, index: number): void {
    this.reorderCount += 1;
    const current = this.children.indexOf(child);
    if (current !== -1) this.children.splice(current, 1);
    this.children.splice(index, 0, child);
  }

  remove_child(child: StActor): void {
    this.removeCount += 1;
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

  set_style(style: string): void { this.styleUpdateCount += 1; this.properties.style = style; }

  set_property(name: string, value: unknown): void {
    this.propertyUpdateCount.set(name, (this.propertyUpdateCount.get(name) ?? 0) + 1);
    this.properties[name] = value;
  }

  get_property(name: string): unknown {
    return this.properties[name];
  }

  get_layout_manager(): { set_homogeneous(value: boolean): void } {
    return this.layoutManager;
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

class FakePasswordEntry extends FakeActor {
  readonly textActor = new FakeActor();
  constructor(properties: Record<string, unknown> = {}) {
    super(properties);
    this.properties.clutterText = this.textActor;
  }
  get_clutter_text(): FakeActor { return this.textActor; }
  set_property(name: string, value: unknown): void {
    super.set_property(name, value);
    if (name === 'text') this.textActor.set_property('text', value);
  }
}

class FakePopupMenu {
  static latest: FakePopupMenu | undefined;
  readonly actor = new FakeActor();
  readonly items: FakeActor[] = [];
  opened = false;
  constructor(readonly source: StActor, readonly alignment: number, readonly side: number) { FakePopupMenu.latest = this; }
  addMenuItem(item: StActor): void { this.items.push(item as FakeActor); this.actor.add_child(item); }
  removeAll(): void { for (const item of [...this.items]) this.actor.remove_child(item); this.items.length = 0; }
  open(): void { this.opened = true; }
  close(): void { this.opened = false; }
}

class FakePopupMenuManager {
  readonly menus: FakePopupMenu[] = [];
  addMenu(menu: FakePopupMenu): void { this.menus.push(menu); }
  removeMenu(menu: FakePopupMenu): void { const index = this.menus.indexOf(menu); if (index >= 0) this.menus.splice(index, 1); }
}

function createPopupMenu() {
  const uiGroup = new FakeActor();
  return {
    uiGroup,
    sideTop: 0,
    PopupMenu: FakePopupMenu,
    PopupMenuItem: class extends FakeActor { constructor(label: string) { super({ text: label }); } },
    PopupMenuManager: FakePopupMenuManager,
  };
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
    PasswordEntry: FakePasswordEntry,
    ScrollView: FakeBin,
    Viewport: FakeBin,
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
  it('skips unchanged native writes and applies changed reactive property values', () => {
    const host = createStRenderHost(createSt());
    const revision = signal(0);
    const label = signal('first');
    const actor = host.element('StLabel', {
      text: { kind: 'binding', get: () => { revision.get(); return label.get(); } },
    }, undefined) as FakeActor;
    expect(actor.propertyUpdateCount.get('text')).toBe(1);
    revision.set(1);
    expect(actor.propertyUpdateCount.get('text')).toBe(1);
    label.set('second');
    expect(actor.properties.text).toBe('second');
    expect(actor.propertyUpdateCount.get('text')).toBe(2);
    revision.set(2);
    expect(actor.propertyUpdateCount.get('text')).toBe(2);
    host.destroy(actor);
  });


  it('synchronizes element class and style bindings once initially', () => {
    const host = createStRenderHost(createSt());
    let classReads = 0;
    let styleReads = 0;
    const actor = host.element('StLabel', {
      classBinding: { kind: 'binding', get: () => { classReads += 1; return { active: true }; } },
      style: { kind: 'binding', get: () => { styleReads += 1; return 'color: red;'; } },
    }, undefined) as FakeActor;

    expect(classReads).toBe(1);
    expect(styleReads).toBe(1);
    expect(actor.properties.style_class).toBe('active');
    expect(actor.properties.style).toBe('color: red;');
    host.destroy(actor);
  });

  it('creates registered St widgets with normalized GObject property names', () => {
    const host = createStRenderHost(createSt());
    const child = host.text('Hello');
    const actor = host.element('StLabel', { styleClass: 'title' }, child) as FakeActor;
    expect(actor.properties).toEqual({ style_class: 'title' });
    expect(actor.children).toEqual([child]);
  });


  it('applies static and reactive inline styles to native St widgets', () => {
    const host = createStRenderHost(createSt());
    const style = signal('color: red;');
    const revision = signal(0);
    const actor = host.element('StLabel', {
      class: 'heading',
      style: { kind: 'binding', get: () => { revision.get(); return style.get(); } },
    }, undefined) as FakeActor;
    expect(actor.properties.style_class).toBe('heading');
    expect(actor.properties.style).toBe('color: red;');
    expect(actor.styleUpdateCount).toBe(1);
    revision.set(1);
    expect(actor.styleUpdateCount).toBe(1);
    style.set('font-weight: bold;');
    expect(actor.properties.style).toBe('font-weight: bold;');
    expect(actor.styleUpdateCount).toBe(2);
    revision.set(2);
    expect(actor.styleUpdateCount).toBe(2);
    host.destroy(actor);
  });

  it('synchronizes component host classes and styles once initially', () => {
    const host = createStRenderHost(createSt());
    const classes = signal({ active: true });
    const color = signal('red');
    const revision = signal(0);
    let classReads = 0;
    let styleReads = 0;
    const actor = host.element('StLabel', {}, undefined) as FakeActor;
    host.setHostAttributes?.(actor, {
      classBinding: { kind: 'binding', get: () => { classReads += 1; return classes.get(); } },
      styleBinding: { kind: 'binding', get: () => { styleReads += 1; revision.get(); return `color: ${color.get()};`; } },
    });
    expect(actor.properties.style_class).toBe('active');
    expect(actor.styleUpdateCount).toBe(1);
    expect(classReads).toBe(1);
    expect(styleReads).toBe(1);
    classes.set({ active: false });
    color.set('blue');
    expect(actor.properties.style_class).toBe('');
    expect(actor.styleUpdateCount).toBe(2);
    expect(classReads).toBe(2);
    expect(styleReads).toBe(2);
    revision.set(1);
    expect(actor.styleUpdateCount).toBe(2);
    expect(styleReads).toBe(3);
    host.destroy(actor);
  });

  it('combines reactive class maps and individual classes with unit-aware style bindings', () => {
    const host = createStRenderHost(createSt());
    const classes = signal({ active: true, muted: false });
    const active = signal(false);
    const width = signal(120);
    const actor = host.element('StLabel', {
      class: 'heading',
      classBinding: { kind: 'binding', get: () => classes.get() },
      'class.selected': { kind: 'binding', get: () => active.get() },
      'style.width.px': { kind: 'binding', get: () => width.get() },
      'style.color': { kind: 'binding', get: () => 'red' },
    }, undefined) as FakeActor;
    expect(actor.properties.style_class).toContain('heading');
    expect(actor.properties.style_class).toContain('active');
    expect(actor.properties.style).toContain('width: 120px;');
    expect(actor.properties.style).toContain('color: red;');
    classes.set({ active: false, muted: true });
    active.set(true);
    width.set(240);
    expect(actor.properties.style_class).toContain('muted');
    expect(actor.properties.style_class).toContain('selected');
    expect(actor.properties.style_class).not.toContain('active');
    expect(actor.properties.style).toContain('width: 240px;');
    host.destroy(actor);
  });

  it('binds StPasswordEntry through its native Clutter.Text actor', () => {
    const host = createStRenderHost(createSt());
    const value = signal('secret');
    const changed: string[] = [];
    const entry = host.element('StPasswordEntry', {
      text: { kind: 'binding', get: () => value.get() },
      textChange: (text: string) => { changed.push(text); value.set(text); },
    }, undefined) as FakePasswordEntry;

    expect(entry.properties.text).toBe('secret');
    value.set('updated externally');
    expect(entry.properties.text).toBe('updated externally');
    entry.set_property('text', 'typed secret');
    entry.textActor.emit('text-changed');
    expect(changed).toEqual(['typed secret']);
    expect(value.get()).toBe('typed secret');
    host.destroy(entry);
    entry.textActor.emit('text-changed');
    expect(changed).toEqual(['typed secret']);
  });

  it('requires the native Clutter.Text actor for StPasswordEntry', () => {
    const St = { ...createSt(), PasswordEntry: constructor() };
    const host = createStRenderHost(St);
    expect(() => host.element('StPasswordEntry', { text: '' }, undefined))
      .toThrow(/requires its native Clutter.Text actor/);
  });

  it('creates a scrollable multiline StTextArea backed by editable Clutter.Text', () => {
    const host = createStRenderHost(createSt(), { clutter: { Text: FakeActor } });
    const value = signal('first line\nsecond line');
    const changed: string[] = [];
    const area = host.element('StTextArea', {
      text: { kind: 'binding', get: () => value.get() },
      textChange: (text: string) => { changed.push(text); value.set(text); },
    }, undefined) as FakeBin;
    const viewport = area.children[0] as FakeBin;
    const text = viewport.children[0] as FakeActor;

    expect(text.properties).toMatchObject({
      editable: true,
      activatable: false,
      single_line_mode: false,
      line_wrap: true,
      text: 'first line\nsecond line',
    });
    value.set('external update');
    expect(text.properties.text).toBe('external update');
    text.properties.text = 'typed\nby user';
    text.emit('text-changed');
    expect(changed).toEqual(['typed\nby user']);
    expect(value.get()).toBe('typed\nby user');
    host.destroy(area);
    text.emit('text-changed');
    expect(changed).toEqual(['typed\nby user']);
  });

  it('requires the native Clutter.Text and St.Viewport APIs for StTextArea', () => {
    const host = createStRenderHost(createSt());
    expect(() => host.element('StTextArea', { text: '' }, undefined))
      .toThrow(/requires St.ScrollView, St.Viewport and Clutter.Text/);
  });

  it('creates a native St button and PopupMenu select with reactive options and cleanup', () => {
    const popupMenu = createPopupMenu();
    const host = createStRenderHost(createSt(), { popupMenu });
    const options = signal(['Small', 'Medium', 'Large']);
    const value = signal('Medium');
    const changed: string[] = [];
    const select = host.element('StSelect', {
      options: { kind: 'binding', get: () => options.get() },
      value: { kind: 'binding', get: () => value.get() },
      valueChange: (next: string) => { changed.push(next); value.set(next); },
    }, undefined) as FakeActor;
    const menu = FakePopupMenu.latest!;
    expect(select.properties.label).toBe('Medium');
    expect(menu.items.map((item) => item.properties.text)).toEqual(['Small', 'Medium', 'Large']);
    select.emit('clicked');
    expect(menu.opened).toBe(true);
    options.set(['Small', 'Large']);
    expect(menu.items.map((item) => item.properties.text)).toEqual(['Small', 'Large']);
    menu.items[1]!.emit('activate');
    expect(changed).toEqual(['Large']);
    expect(select.properties.label).toBe('Large');
    expect(menu.opened).toBe(false);
    host.destroy(select);
    expect(popupMenu.uiGroup.children).toHaveLength(0);
    expect(select.destroyed).toBe(true);
    value.set('Small');
    expect(select.properties.label).toBe('Large');
  });

  it('requires the injected PopupMenu API for the composite StSelect control', () => {
    const host = createStRenderHost(createSt());
    expect(() => host.element('StSelect', { options: [], value: '' }, undefined)).toThrow(/requires GNOME Shell PopupMenu/);
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

    expect(flex.properties).toMatchObject({ orientation: 1, spacing: 8 });
    expect(flex.layoutManager.homogeneous).toBe(true);
    direction.set('row');
    homogeneous.set('false');
    expect(flex.properties.orientation).toBe(0);
    expect(flex.layoutManager.homogeneous).toBe(false);
    host.destroy(flex);
    expect(() => host.element('Flex', { gap: -1 }, undefined)).toThrow(/Flex gap/);
    expect(() => host.element('Flex', { homogeneous: 'yes' }, undefined)).toThrow(/Flex homogeneous/);
  });

  it('rejects native Flex options that St BoxLayout cannot implement', () => {
    const host = createStRenderHost(createSt());
    expect(() => host.element('Flex', { wrap: true }, undefined)).toThrow(/Flex wrap is not supported/);
    expect(() => host.element('StButton', { grow: 2 }, undefined)).toThrow(/grow weights are not supported/);
  });
  it('maps static and reactive GTPL Flex alignment to St alignment properties', () => {
    const host = createStRenderHost(createSt());
    const aligned = host.element('Flex', { align: 'center' }, undefined) as FakeActor;
    expect(aligned.properties).toMatchObject({ x_align: 2, y_align: 2 });

    const value = signal('start');
    const reactive = host.element('Flex', {
      align: { kind: 'binding', get: () => value.get() },
    }, undefined) as FakeActor;
    expect(reactive.properties).toMatchObject({ x_align: 1, y_align: 1 });
    value.set('end');
    expect(reactive.properties).toMatchObject({ x_align: 3, y_align: 3 });
    host.destroy(reactive);
    expect(() => host.element('Flex', { align: 'middle' }, undefined)).toThrow(/Flex align/);
  });

  it('maps static and reactive GTPL expand to both St expansion axes', () => {
    const host = createStRenderHost(createSt());
    const expanded = host.element('StButton', { expand: 'true' }, undefined) as FakeActor;
    expect(expanded.properties).toMatchObject({ x_expand: true, y_expand: true });

    const value = signal('false');
    const reactive = host.element('StButton', {
      expand: { kind: 'binding', get: () => value.get() },
    }, undefined) as FakeActor;
    expect(reactive.properties).toMatchObject({ x_expand: false, y_expand: false });
    value.set('true');
    expect(reactive.properties).toMatchObject({ x_expand: true, y_expand: true });
    host.destroy(reactive);
    expect(() => host.element('StButton', { expand: 'yes' }, undefined)).toThrow(/expand must/);
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

  it('destroys conditional and switch branches when St attachment fails', () => {
    class FailingBin extends FakeBin {
      override set_child(_child: StActor | null): void { throw new Error('attachment failed'); }
    }
    const host = createStRenderHost({ ...createSt(), Bin: FailingBin });
    const conditionalNode = new FakeActor();
    expect(() => host.conditional(
      { kind: 'binding', get: () => true },
      () => conditionalNode,
      () => new FakeActor(),
    )).toThrow('attachment failed');
    expect(conditionalNode.destroyed).toBe(true);

    const switchNode = new FakeActor();
    expect(() => host.switch(
      { kind: 'binding', get: () => 'ready' },
      [{ values: ['ready'], render: () => switchNode }],
      () => new FakeActor(),
    )).toThrow('attachment failed');
    expect(switchNode.destroyed).toBe(true);
  });

  it('rejects conditional and switch containers without set_child', () => {
    class MissingChildBin extends FakeBin {
      constructor(properties: Record<string, unknown> = {}) {
        super(properties);
        Object.defineProperty(this, 'set_child', { value: undefined });
      }
    }
    const host = createStRenderHost({ ...createSt(), Bin: MissingChildBin });
    const conditionalNode = new FakeActor();
    expect(() => host.conditional(
      { kind: 'binding', get: () => true },
      () => conditionalNode,
      () => new FakeActor(),
    )).toThrow('This St container cannot set child actors.');
    expect(conditionalNode.destroyed).toBe(true);
    expect(conditionalNode.destroyCount).toBe(1);

    const switchNode = new FakeActor();
    expect(() => host.switch(
      { kind: 'binding', get: () => 'ready' },
      [{ values: ['ready'], render: () => switchNode }],
      () => new FakeActor(),
    )).toThrow('This St container cannot set child actors.');
    expect(switchNode.destroyed).toBe(true);
    expect(switchNode.destroyCount).toBe(1);
  });

  it('destroys replacement branches when detaching the previous St child fails', () => {
    class FailingDetachBin extends FakeBin {
      override set_child(child: StActor | null): void {
        if (child === null) throw new Error('detach failed');
        super.set_child(child);
      }
    }
    const host = createStRenderHost({ ...createSt(), Bin: FailingDetachBin });
    const condition = signal(false);
    const conditionalOld = new FakeActor();
    const conditionalNext = new FakeActor();
    const conditional = host.conditional(
      { kind: 'binding', get: () => condition.get() },
      () => conditionalNext,
      () => conditionalOld,
    ) as FakeBin;
    expect(conditional.children[0]).toBe(conditionalOld);
    expect(() => condition.set(true)).toThrow('detach failed');
    expect(conditionalNext.destroyed).toBe(true);
    expect(conditional.children[0]).toBe(conditionalOld);
    host.destroy(conditional);

    const selected = signal('idle');
    const switchOld = new FakeActor();
    const switchNext = new FakeActor();
    const switched = host.switch(
      { kind: 'binding', get: () => selected.get() },
      [{ values: ['ready'], render: () => switchNext }],
      () => switchOld,
    ) as FakeBin;
    expect(switched.children[0]).toBe(switchOld);
    expect(() => selected.set('ready')).toThrow('detach failed');
    expect(switchNext.destroyed).toBe(true);
    expect(switched.children[0]).toBe(switchOld);
    host.destroy(switched);
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

  it('updates retained St rows when their keyed item and index change', () => {
    const host = createStRenderHost(createSt());
    const runtime = createGtplRenderRuntime(host);
    const values = signal([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]);
    let renders = 0;
    const list = runtime.for(
      runtime.bind(() => values.get()),
      (item, _index, _count, registerUpdate) => {
        let current = item;
        let currentIndex = _index;
        let currentCount = _count;
        registerUpdate((nextItem, nextIndex, nextCount) => {
          current = nextItem;
          currentIndex = nextIndex;
          currentCount = nextCount;
        });
        renders += 1;
        return host.element('StLabel', {
          text: runtime.bind(() => `${current.label}:${currentIndex}/${currentCount}`),
        }, undefined);
      },
      (item) => item.id,
      () => host.text('empty'),
    ) as FakeActor;
    const originalA = list.children[0] as FakeActor;
    const originalB = list.children[1] as FakeActor;
    expect(originalA.properties.text).toBe('A:0/2');
    expect(originalB.properties.text).toBe('B:1/2');
    values.set([{ id: 'b', label: 'B2' }, { id: 'a', label: 'A2' }]);
    expect(list.children).toEqual([originalB, originalA]);
    expect(originalB.properties.text).toBe('B2:0/2');
    expect(originalA.properties.text).toBe('A2:1/2');
    expect(renders).toBe(2);
    host.destroy(list);
  });
  it('updates nested St branches and loops when a parent row changes', () => {
    const host = createStRenderHost(createSt());
    const runtime = createGtplRenderRuntime(host);
    const values = signal([{
      id: 'parent',
      label: 'Before',
      show: true,
      mode: 'idle',
      children: [{ id: 'child', label: 'Child' }],
    }]);
    const list = runtime.for(
      runtime.bind(() => values.get()),
      (item, _index, _count, registerUpdate) => {
        let current = item;
        registerUpdate((nextItem) => { current = nextItem; });
        const conditional = runtime.if(
          runtime.bind(() => current.show),
          () => host.element('StLabel', { text: runtime.bind(() => current.label) }, undefined),
          () => host.text('hidden'),
        );
        const switched = runtime.switch(
          runtime.bind(() => current.mode),
          [{ values: ['ready'], render: () => host.element('StLabel', { text: runtime.bind(() => current.label + '-switch') }, undefined) }],
          () => host.text('idle'),
        );
        const nested = runtime.for(
          runtime.bind(() => current.children),
          (child, _childIndex, _childCount, registerChildUpdate) => {
            let currentChild = child;
            registerChildUpdate((nextChild) => { currentChild = nextChild; });
            return host.element('StLabel', { text: runtime.bind(() => currentChild.label) }, undefined);
          },
          (child) => child.id,
          () => host.text('empty child'),
        );
        return host.element('StBox', {}, host.fragment([conditional, switched, nested]));
      },
      (item) => item.id,
      () => host.text('empty parent'),
    ) as FakeActor;
    const row = list.children[0] as FakeActor;
    const content = row.children[0] as FakeActor;
    const conditional = content.children[0] as FakeActor;
    const switched = content.children[1] as FakeActor;
    const nested = content.children[2] as FakeActor;
    const originalChild = nested.children[0] as FakeActor;
    expect((conditional.children[0] as FakeActor).properties.text).toBe('Before');
    expect((switched.children[0] as FakeActor).properties.text).toBe('idle');
    expect(originalChild.properties.text).toBe('Child');
    values.set([{
      id: 'parent',
      label: 'After',
      show: true,
      mode: 'ready',
      children: [{ id: 'child', label: 'Child 2' }, { id: 'new', label: 'New child' }],
    }]);
    expect(list.children[0]).toBe(row);
    expect((conditional.children[0] as FakeActor).properties.text).toBe('After');
    expect((switched.children[0] as FakeActor).properties.text).toBe('After-switch');
    expect(nested.children[0]).toBe(originalChild);
    expect(nested.children.map((child) => (child as FakeActor).properties.text)).toEqual(['Child 2', 'New child']);
    host.destroy(list);
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


  it('moves only the St row that changes position', () => {
    const host = createStRenderHost(createSt());
    const state = signal({ items: [
      { key: 'a', index: 0, node: host.text('a') as FakeActor },
      { key: 'b', index: 1, node: host.text('b') as FakeActor },
      { key: 'c', index: 2, node: host.text('c') as FakeActor },
    ] });
    const list = host.repeat({ kind: 'binding', get: () => state.get() }) as FakeActor;
    const [a, b, c] = list.children as [FakeActor, FakeActor, FakeActor];
    list.reorderCount = 0;
    list.removeCount = 0;
    state.set({ items: [
      { key: 'c', index: 0, node: c },
      { key: 'a', index: 1, node: a },
      { key: 'b', index: 2, node: b },
    ] });
    expect(list.children).toEqual([c, a, b]);
    expect(list.reorderCount).toBe(1);
    expect(list.removeCount).toBe(0);
    host.destroy(list);
  });

  it('rejects repeat containers without the native child APIs', () => {
    class MissingChildApiBox extends FakeActor {
      constructor(properties: Record<string, unknown> = {}) {
        super(properties);
        Object.defineProperties(this, {
          insert_child_at_index: { value: undefined },
          set_child_at_index: { value: undefined },
          add_child: { value: undefined },
          remove_child: { value: undefined },
        });
      }
    }
    const host = createStRenderHost({ ...createSt(), BoxLayout: MissingChildApiBox });
    const child = host.text('child') as FakeActor;

    expect(() => host.repeat({
      kind: 'binding',
      get: () => ({ items: [{ key: 'child', index: 0, render: () => child }] }),
    })).toThrow('This St container cannot contain child actors.');
    expect(child.destroyed).toBe(true);
    expect(child.destroyCount).toBe(1);
  });

  it('rejects incremental repeat removal when the St container has no remove_child API', () => {
    class MissingRemoveBox extends FakeActor {
      constructor(properties: Record<string, unknown> = {}) {
        super(properties);
        Object.defineProperty(this, 'remove_child', { value: undefined });
      }
    }
    const host = createStRenderHost({ ...createSt(), BoxLayout: MissingRemoveBox });
    const first = host.text('first') as FakeActor;
    const values = signal({ items: [{ key: 'first', index: 0, node: first }] });
    const list = host.repeat({ kind: 'binding', get: () => values.get() }) as FakeActor;

    expect(list.children).toEqual([first]);
    expect(() => values.set({ items: [] })).toThrow('This St container cannot remove child actors.');
    expect(list.children).toEqual([first]);
    expect(first.destroyed).toBe(false);
    host.destroy(list);
  });

  it('rejects fallback repeat removal when the St container has no remove_child API', () => {
    class MissingFallbackRemoveBox extends FakeActor {
      constructor(properties: Record<string, unknown> = {}) {
        super(properties);
        Object.defineProperties(this, {
          insert_child_at_index: { value: undefined },
          set_child_at_index: { value: undefined },
          remove_child: { value: undefined },
        });
      }
    }
    const host = createStRenderHost({ ...createSt(), BoxLayout: MissingFallbackRemoveBox });
    const first = host.text('first') as FakeActor;
    const values = signal({ items: [{ key: 'first', index: 0, node: first }] });
    const list = host.repeat({ kind: 'binding', get: () => values.get() }) as FakeActor;

    expect(list.children).toEqual([first]);
    expect(() => values.set({ items: [] })).toThrow('This St container cannot remove child actors.');
    expect(list.children).toEqual([first]);
    expect(first.destroyed).toBe(false);
    host.destroy(list);
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
