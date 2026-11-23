import { describe, expect, it } from 'vitest';
import { createGtkRenderHost, type GtkActor, type GtkNamespace, type GtkWidgetConstructor } from './gtk-render-host.js';
import { createGtplRenderRuntime } from '../../rendering/gtpl-runtime.js';
import { signal } from '../../reactivity/signal.js';
import { ComponentRegistry } from '../../components/component-registry.js';
import { DirectiveRegistry } from '../../directives/directive-registry.js';
import { Injector } from '../../di/injector.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

class FakeWidget implements GtkActor {
  readonly properties: Record<string, unknown>;
  readonly children: GtkActor[] = [];
  readonly classes = new Set<string>();
  readonly signals = new Map<number, { name: string; callback: (actor: GtkActor, ...args: unknown[]) => unknown }>();
  parent: FakeWidget | null = null;
  private nextSignal = 1;

  constructor(properties: Record<string, unknown> = {}) { this.properties = properties; }
  append(child: GtkActor): void { this.attachChild(child); }
  add(child: GtkActor): void { this.attach(child); }
  add_suffix(child: GtkActor): void { this.attach(child); }
  remove_suffix(child: GtkActor): void { this.remove(child); }
  remove(child: GtkActor): void {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    (child as FakeWidget).parent = null;
  }
  set_property(name: string, value: unknown): void { this.properties[name] = value; }
  get_property(name: string): unknown { return this.properties[name]; }
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
  private attachChild(child: GtkActor): void {
    const widget = child as FakeWidget;
    widget.parent?.remove(widget);
    widget.parent = this;
    this.children.push(child);
  }
}

class FakeGrid extends FakeWidget {
  readonly cells: Array<{ child: GtkActor; column: number; row: number }> = [];
  attach(child: GtkActor, column: number, row: number): void {
    this.append(child);
    this.cells.push({ child, column, row });
  }
}

class FakeHeaderBar extends FakeWidget {
  pack_start(child: GtkActor): void { this.append(child); }
}

class FakeSingleChild extends FakeWidget {
  set_child(child: GtkActor | null): void {
    for (const previous of [...this.children]) this.remove(previous);
    if (child) this.append(child);
  }
}

class NodeGtkWidget implements GtkActor {
  readonly children: NodeGtkWidget[] = [];
  readonly classes = new Set<string>();
  readonly handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();
  parent: NodeGtkWidget | null = null;
  [property: string]: unknown;

  constructor(properties: Record<string, unknown> = {}) { Object.assign(this, properties); }
  append(child: GtkActor): void {
    const widget = child as NodeGtkWidget;
    widget.parent?.remove(widget);
    widget.parent = this;
    this.children.push(widget);
  }
  remove(child: GtkActor): void {
    const widget = child as NodeGtkWidget;
    const index = this.children.indexOf(widget);
    if (index !== -1) this.children.splice(index, 1);
    widget.parent = null;
  }
  setChild(child: GtkActor | null): void {
    for (const previous of [...this.children]) this.remove(previous);
    if (child) this.append(child);
  }
  getParent(): GtkActor | null { return this.parent; }
  addCssClass(name: string): void { this.classes.add(name); }
  removeCssClass(name: string): void { this.classes.delete(name); }
  on(signal: string, callback: (...args: unknown[]) => unknown): void {
    const handlers = this.handlers.get(signal) ?? new Set();
    handlers.add(callback);
    this.handlers.set(signal, handlers);
  }
  off(signal: string, callback: (...args: unknown[]) => unknown): void {
    const handlers = this.handlers.get(signal);
    handlers?.delete(callback);
    if (handlers?.size === 0) this.handlers.delete(signal);
  }
  emit(signal: string, ...args: unknown[]): void {
    for (const callback of this.handlers.get(signal) ?? []) callback(...args);
  }
}

function createNodeGtk(): GtkNamespace {
  return {
    Box: NodeGtkWidget,
    Label: NodeGtkWidget,
    Button: NodeGtkWidget,
    Entry: NodeGtkWidget,
    Image: NodeGtkWidget,
    ScrolledWindow: NodeGtkWidget,
  };
}

class FakeActionRow extends FakeWidget {
  override remove(_child: GtkActor): void {
    throw new Error('AdwActionRow requires remove_suffix for suffix children');
  }
  override remove_suffix(child: GtkActor): void {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    (child as FakeWidget).parent = null;
  }
}

class FailingBox extends FakeWidget {
  static remaining = -1;
  override append(child: GtkActor): void {
    if (FailingBox.remaining === 0) throw new Error('attachment failed');
    if (FailingBox.remaining > 0) FailingBox.remaining -= 1;
    super.append(child);
  }
}

function constructor(): GtkWidgetConstructor { return FakeWidget; }
function createGtk(): GtkNamespace {
  return {
    Box: constructor(),
    Label: constructor(),
    Button: FakeSingleChild,
    Entry: constructor(),
    Image: constructor(),
    ScrolledWindow: FakeSingleChild,
    Switch: FakeWidget,
    CheckButton: FakeWidget,
    DropDown: FakeWidget,
    SpinButton: FakeWidget,
    ProgressBar: FakeWidget,
    Separator: FakeWidget,
    ListBox: FakeWidget,
    ListBoxRow: FakeWidget,
    Grid: FakeGrid,
    Stack: FakeWidget,
    Revealer: FakeWidget,
    TextView: FakeWidget,
    PasswordEntry: FakeWidget,
    SearchEntry: FakeWidget,
  };
}

describe('createGtkRenderHost', () => {
  it('registers common GTK4 widgets and optional libadwaita widgets', () => {
    const host = createGtkRenderHost(createGtk(), {
      adw: { PreferencesPage: FakeWidget, PreferencesGroup: FakeWidget, ActionRow: FakeWidget,
        SwitchRow: FakeWidget, EntryRow: FakeWidget, PasswordEntryRow: FakeWidget,
        ExpanderRow: FakeWidget, ComboRow: FakeWidget, SpinRow: FakeWidget,
        Banner: FakeWidget, HeaderBar: FakeWidget, ToolbarView: FakeWidget },
    });
    for (const name of ['GtkCheckButton', 'GtkDropDown', 'GtkSpinButton', 'GtkProgressBar', 'GtkSeparator', 'GtkListBox', 'GtkListBoxRow', 'GtkGrid', 'GtkStack', 'GtkRevealer', 'GtkTextView', 'GtkPasswordEntry', 'GtkSearchEntry', 'AdwSwitchRow', 'AdwEntryRow', 'AdwPasswordEntryRow', 'AdwExpanderRow', 'AdwComboRow', 'AdwSpinRow', 'AdwBanner', 'AdwHeaderBar', 'AdwToolbarView', 'HeaderBar', 'Sidebar']) {
      expect(host.element(name, {}, undefined)).toBeInstanceOf(FakeWidget);
    }
  });

  it('uses the supplied libadwaita header bar and packs template children into it', () => {
    const host = createGtkRenderHost(createGtk(), { adw: { HeaderBar: FakeHeaderBar } });
    const child = host.element('GtkButton', {}, undefined) as FakeWidget;
    const header = host.element('HeaderBar', {}, child) as FakeHeaderBar;

    expect(header).toBeInstanceOf(FakeHeaderBar);
    expect(header.properties.orientation).toBeUndefined();
    expect(header.children).toEqual([child]);
    expect(child.parent).toBe(header);
    host.destroy(header);
  });

  it('sets horizontal and vertical defaults for GTPL application containers', () => {
    const host = createGtkRenderHost(createGtk());
    expect((host.element('HeaderBar', {}, undefined) as FakeWidget).properties.orientation).toBe(0);
    expect((host.element('Sidebar', {}, undefined) as FakeWidget).properties.orientation).toBe(1);
  });

  it('places GTPL Grid children in native GTK grid cells', () => {
    const host = createGtkRenderHost(createGtk());
    const items = [host.text('A'), host.text('B'), host.text('C')];
    const fragment = host.fragment(items);
    const grid = host.element('Grid', { columns: '2', gap: '10' }, fragment) as FakeGrid;

    expect(grid.properties).toMatchObject({ row_spacing: 10, column_spacing: 10 });
    expect(grid.cells.map(({ column, row }) => [column, row])).toEqual([[0, 0], [1, 0], [0, 1]]);
    expect(grid.children).toEqual(items);
    expect(items.every((item) => (item as FakeWidget).parent === grid)).toBe(true);
    host.destroy(grid);
    expect(() => host.element('Grid', { columns: '0' }, undefined)).toThrow(/positive integer/);
  });

  it('maps GTPL Flex direction and gap to native GTK box properties', () => {
    const host = createGtkRenderHost(createGtk());
    const direction = signal('row');
    const flex = host.element('Flex', {
      direction: { kind: 'binding', get: () => direction.get() },
      gap: '12',
    }, undefined) as FakeWidget;

    expect(flex.properties).toMatchObject({ orientation: 0, spacing: 12 });
    direction.set('column');
    expect(flex.properties.orientation).toBe(1);
    host.destroy(flex);
    expect(() => host.element('Flex', { direction: 'diagonal' }, undefined)).toThrow(/Flex direction/);
  });

  it('removes libadwaita action-row suffix children with the matching GTK API', () => {
    const host = createGtkRenderHost(createGtk(), {
      adw: { ActionRow: FakeActionRow },
    });
    const child = host.element('GtkSwitch', {}, undefined) as FakeWidget;
    const row = host.element('AdwActionRow', {}, child) as FakeActionRow;

    expect(row.children).toEqual([child]);
    host.destroy(child);
    expect(row.children).toHaveLength(0);
    expect(child.parent).toBeNull();
    host.destroy(row);
  });

  it('supports Node-GTK camelCase properties, signals and child APIs', () => {
    const host = createGtkRenderHost(createNodeGtk(), { api: 'node-gtk' });
    const runtime = createGtplRenderRuntime(host);
    const title = signal('before');
    const label = host.element('GtkLabel', {
      label: runtime.bind(() => title.get()),
      'use-underline': true,
    }, undefined) as NodeGtkWidget;
    expect(label.label).toBe('before');
    expect(label.useUnderline).toBe(true);

    let clicks = 0;
    let active: unknown;
    const button = host.element('GtkButton', {
      clicked: () => { clicks += 1; },
      activeChange: (value: unknown) => { active = value; },
    }, label) as NodeGtkWidget;
    const root = host.element('GtkBox', {}, button) as NodeGtkWidget;
    expect(button.children).toEqual([label]);
    expect(label.parent).toBe(button);

    button.emit('clicked');
    button.active = true;
    button.emit('notify::active');
    title.set('after');
    expect(clicks).toBe(1);
    expect(active).toBe(true);
    expect(label.label).toBe('after');

    host.destroy(root);
    button.emit('clicked');
    title.set('ignored');
    expect(clicks).toBe(1);
    expect(button.handlers.size).toBe(0);
    expect(label.label).toBe('after');
  });

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

  it('tears down nested GTK signals and reactive bindings with the root widget', () => {
    const host = createGtkRenderHost(createGtk());
    const runtime = createGtplRenderRuntime(host);
    const label = signal('before');
    let clicks = 0;
    const text = host.element('GtkLabel', {
      label: runtime.bind(() => label.get()),
    }, undefined) as FakeWidget;
    const button = host.element('GtkButton', {
      clicked: () => { clicks += 1; },
    }, text) as FakeWidget;
    const root = host.element('GtkBox', {}, button) as FakeWidget;

    expect(root.children).toEqual([button]);
    expect(button.children).toEqual([text]);
    expect(text.properties.label).toBe('before');

    host.destroy(root);
    button.emit('clicked');
    label.set('after');

    expect(clicks).toBe(0);
    expect(button.signals.size).toBe(0);
    expect(text.properties.label).toBe('before');
    expect(root.children).toEqual([button]);
    expect(button.children).toEqual([text]);
    expect(button.parent).toBe(root);
    expect(text.parent).toBe(button);
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

  it('disposes repeat children with their GTK container', () => {
    const host = createGtkRenderHost(createGtk());
    const child = host.element('GtkButton', { clicked: () => undefined }, undefined) as FakeWidget;
    const list = host.repeat({
      kind: 'binding',
      get: () => ({ items: [{ key: 'one', index: 0, node: child }] }),
    }) as FakeWidget;
    expect(child.parent).toBe(list);
    expect(child.signals.size).toBe(1);
    host.destroy(list);
    expect(child.parent).toBe(list);
    expect(child.signals.size).toBe(0);
  });

  it('cleans up new repeat children when GTK attachment fails', () => {
    FailingBox.remaining = -1;
    const Gtk = { ...createGtk(), Box: FailingBox };
    const host = createGtkRenderHost(Gtk);
    const previous = host.element('GtkButton', { clicked: () => undefined }, undefined) as FakeWidget;
    const state = signal({ items: [{ key: 'previous', index: 0, node: previous }] });
    const list = host.repeat({ kind: 'binding', get: () => state.get() }) as FakeWidget;
    const first = host.element('GtkButton', { clicked: () => undefined }, undefined) as FakeWidget;
    const second = host.element('GtkButton', { clicked: () => undefined }, undefined) as FakeWidget;
    FailingBox.remaining = 1;
    expect(() => state.set({ items: [
      { key: 'first', index: 0, node: first },
      { key: 'second', index: 1, node: second },
    ] })).toThrow('attachment failed');
    FailingBox.remaining = -1;
    expect(first.signals.size).toBe(0);
    expect(second.signals.size).toBe(0);
    host.destroy(list);
  });

  it('cleans up GTK conditional and switch nodes when attachment fails', () => {
    const host = createGtkRenderHost({ ...createGtk(), Box: FailingBox });
    const condition = signal(false);
    let conditionalNode!: FakeWidget;
    const conditional = host.conditional(
      { kind: 'binding', get: () => condition.get() },
      () => {
        conditionalNode = host.element('GtkButton', { clicked: () => undefined }, undefined) as FakeWidget;
        return conditionalNode;
      },
      () => host.text('fallback'),
    ) as FakeWidget;
    FailingBox.remaining = 0;
    expect(() => condition.set(true)).toThrow('attachment failed');
    FailingBox.remaining = -1;
    expect(conditionalNode.signals.size).toBe(0);
    host.destroy(conditional);

    const selected = signal('fallback');
    let switchNode!: FakeWidget;
    const switched = host.switch(
      { kind: 'binding', get: () => selected.get() },
      [{
        values: ['button'],
        render: () => {
          switchNode = host.element('GtkButton', { clicked: () => undefined }, undefined) as FakeWidget;
          return switchNode;
        },
      }],
      () => host.text('fallback'),
    ) as FakeWidget;
    FailingBox.remaining = 0;
    expect(() => selected.set('button')).toThrow('attachment failed');
    FailingBox.remaining = -1;
    expect(switchNode.signals.size).toBe(0);
    host.destroy(switched);
  });

  it('supports registered libadwaita and custom widget constructors', () => {
    const host = createGtkRenderHost(createGtk(), {
      adw: { PreferencesPage: FakeWidget, PreferencesGroup: FakeWidget, ActionRow: FakeWidget },
      components: { CustomRow: FakeWidget },
    });
    const page = host.element('AdwPreferencesPage', {}, undefined) as FakeWidget;
    const group = host.element('AdwPreferencesGroup', {}, undefined);
    const row = host.element('AdwActionRow', {}, host.element('GtkSwitch', { active: true }, undefined));
    expect(page).toBeInstanceOf(FakeWidget);
    expect(group).toBeInstanceOf(FakeWidget);
    expect((row as FakeWidget).children).toHaveLength(1);
    expect(host.element('CustomRow', {}, undefined)).toBeInstanceOf(FakeWidget);
  });

  it('mounts selector-matched directives and disposes host listeners with GTK view teardown', () => {
    const host = createGtkRenderHost(createGtk());
    const activated: unknown[] = [];
    const changed = new EventEmitter<string>();
    const outputs: string[] = [];
    const directives = new DirectiveRegistry<GtkActor>().register('[gefAction]', {
      create: () => ({ accessibleName: 'Action', activate: (event: unknown) => activated.push(event), changed }),
      hostBindings: [{ member: 'accessibleName', property: 'accessible-name' }],
      hostListeners: [{ member: 'activate', event: 'clicked' }],
      outputs: [{ publicName: 'changed', member: 'changed' }],
    });
    const runtime = createGtplRenderRuntime(host, undefined, directives, new Injector());
    const button = runtime.element('GtkButton', { gefAction: true, changed: (value: string) => outputs.push(value) }, undefined) as FakeWidget;
    expect(button.properties.accessible_name).toBe('Action');
    button.emit('clicked', 'go');
    expect(activated).toEqual(['go']);
    changed.emit('first');
    host.destroy(button);
    changed.emit('second');
    expect(outputs).toEqual(['first']);
    expect(button.signals.size).toBe(0);
  });

  it('maps two-way property changes to GTK notify signals and current values', () => {
    const host = createGtkRenderHost(createGtk());
    const values: unknown[] = [];
    const widget = host.element('GtkSwitch', {
      active: { kind: 'binding', get: () => false },
      activeChange: (value: unknown) => values.push(value),
    }, undefined) as FakeWidget;
    (widget as unknown as { active: boolean }).active = true;
    widget.emit('notify::active');
    expect(values).toEqual([true]);
    host.destroy(widget);
  });

  it('mounts registered components with reactive inputs and disposes their outputs', () => {
    const host = createGtkRenderHost(createGtk());
    const changed = new EventEmitter<string>();
    const label = signal('initial');
    const registry = new ComponentRegistry<GtkActor>().register('GefSettingsRow', {
      create: () => {
        const value = signal('default');
        return {
          get label() { return value.get(); },
          set label(next: string) { value.set(next); },
          changed,
        };
      },
      inputs: [{ publicName: 'label', member: 'label' }],
      outputs: [{ publicName: 'changed', member: 'changed' }],
      render: (instance, runtime) => runtime.element('GtkLabel', { label: runtime.bind(() => instance.label) }, undefined),
    });
    const received: string[] = [];
    const runtime = createGtplRenderRuntime(host, undefined, undefined, new Injector(), registry);
    const row = runtime.element('GefSettingsRow', {
      label: runtime.bind(() => label.get()),
      changed: (value: string) => received.push(value),
    }, undefined) as FakeWidget;

    expect(row.properties.label).toBe('initial');
    label.set('updated');
    expect(row.properties.label).toBe('updated');
    changed.emit('first');
    host.destroy(row);
    changed.emit('after-destroy');
    label.set('ignored');
    expect(row.properties.label).toBe('updated');
    expect(received).toEqual(['first']);
  });

  it('rejects unknown widget selectors', () => {
    const host = createGtkRenderHost(createGtk());
    expect(() => host.element('Unknown', {}, undefined)).toThrow(/Unknown GTK component/);
  });
});
