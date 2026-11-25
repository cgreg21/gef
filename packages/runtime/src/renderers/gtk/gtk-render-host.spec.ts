import { describe, expect, it } from 'vitest';
import { createGtkRenderHost, type GtkActor, type GtkNamespace, type GtkWidgetConstructor } from './gtk-render-host.js';
import { createGtplRenderRuntime } from '../../rendering/gtpl-runtime.js';
import { signal } from '../../reactivity/signal.js';
import { ComponentRegistry } from '../../components/component-registry.js';
import { DirectiveRegistry } from '../../directives/directive-registry.js';
import { Injector } from '../../di/injector.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

class FakeWidget implements GtkActor {
  classUpdateCount = 0;
  readonly propertyUpdateCount = new Map<string, number>();
  readonly styleContext = {
    providers: new Set<FakeCssProvider>(),
    add_provider(provider: FakeCssProvider): void { this.providers.add(provider); },
    remove_provider(provider: FakeCssProvider): void { this.providers.delete(provider); },
  };
  readonly properties: Record<string, unknown>;
  readonly children: GtkActor[] = [];
  insertCount = 0;
  reorderCount = 0;
  removeCount = 0;
  readonly classes = new Set<string>();
  readonly signals = new Map<number, { name: string; callback: (actor: GtkActor, ...args: unknown[]) => unknown }>();
  parent: FakeWidget | null = null;
  private nextSignal = 1;

  constructor(properties: Record<string, unknown> = {}) { this.properties = properties; }
  append(child: GtkActor): void { this.attachChild(child); }
  add(child: GtkActor): void { this.attachChild(child); }
  add_suffix(child: GtkActor): void { this.attachChild(child); }
  remove_suffix(child: GtkActor): void { this.remove(child); }
  remove(child: GtkActor): void {
    this.removeCount += 1;
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    (child as FakeWidget).parent = null;
  }
  insert_child_after(child: GtkActor, sibling: GtkActor | null): void {
    this.insertCount += 1;
    const widget = child as FakeWidget;
    widget.parent?.remove(widget);
    const index = sibling ? this.children.indexOf(sibling) + 1 : 0;
    widget.parent = this;
    this.children.splice(index, 0, child);
  }
  reorder_child_after(child: GtkActor, sibling: GtkActor | null): void {
    this.reorderCount += 1;
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    const target = sibling ? this.children.indexOf(sibling) + 1 : 0;
    this.children.splice(target, 0, child);
  }
  set_property(name: string, value: unknown): void {
    this.propertyUpdateCount.set(name, (this.propertyUpdateCount.get(name) ?? 0) + 1);
    this.properties[name] = value;
  }
  get_property(name: string): unknown { return this.properties[name]; }
  get_style_context(): typeof this.styleContext { return this.styleContext; }
  connect(name: string, callback: (actor: GtkActor, ...args: unknown[]) => unknown): number {
    const id = this.nextSignal++;
    this.signals.set(id, { name, callback });
    return id;
  }
  disconnect(id: number): void { this.signals.delete(id); }
  get_parent(): GtkActor | null { return this.parent; }
  add_css_class(name: string): void { this.classUpdateCount += 1; this.classes.add(name); }
  remove_css_class(name: string): void { this.classUpdateCount += 1; this.classes.delete(name); }
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

class FakeCssProvider {
  data = '';
  loadCount = 0;
  load_from_data(data: string): void { this.loadCount += 1; this.data = data; }
}

class FakeStringList {
  readonly items: string[];
  constructor(items: string[]) { this.items = [...items]; }
  get_item(index: number): { get_string(): string } | null {
    const value = this.items[index];
    return value === undefined ? null : { get_string: () => value };
  }
}

class FakeTextBuffer extends FakeWidget {
  text = '';
  set_text(value: string): void { this.text = value; this.emit('changed'); }
}

class FakeTextView extends FakeWidget {
  readonly buffer = new FakeTextBuffer();
}

class FakePasswordEntry extends FakeWidget {
  text = '';
  get_text(): string { return this.text; }
  set_text(value: string): void { this.text = value; this.emit('changed'); }
}

function constructor(): GtkWidgetConstructor { return FakeWidget; }
function createGtk(): GtkNamespace {
  return {
    CssProvider: FakeCssProvider,
    Box: constructor(),
    Label: constructor(),
    Button: FakeSingleChild,
    Entry: constructor(),
    Image: constructor(),
    ScrolledWindow: FakeSingleChild,
    Switch: FakeWidget,
    CheckButton: FakeWidget,
    DropDown: FakeWidget,
    StringList: { new: (items: string[]) => new FakeStringList(items) },
    SpinButton: FakeWidget,
    ProgressBar: FakeWidget,
    Separator: FakeWidget,
    ListBox: FakeWidget,
    ListBoxRow: FakeWidget,
    Grid: FakeGrid,
    Stack: FakeWidget,
    Revealer: FakeWidget,
    TextView: FakeTextView,
    PasswordEntry: FakePasswordEntry,
    SearchEntry: FakeWidget,
    Scale: FakeWidget,
  };
}

describe('createGtkRenderHost', () => {
  it('skips unchanged native writes and applies changed reactive property values', () => {
    const host = createGtkRenderHost(createGtk());
    const revision = signal(0);
    const label = signal('first');
    const widget = host.element('GtkLabel', {
      label: { kind: 'binding', get: () => { revision.get(); return label.get(); } },
    }, undefined) as FakeWidget;
    expect(widget.propertyUpdateCount.get('label')).toBe(1);
    revision.set(1);
    expect(widget.propertyUpdateCount.get('label')).toBe(1);
    label.set('second');
    expect(widget.properties.label).toBe('second');
    expect(widget.propertyUpdateCount.get('label')).toBe(2);
    revision.set(2);
    expect(widget.propertyUpdateCount.get('label')).toBe(2);
    host.destroy(widget);
  });


  it('registers common GTK4 widgets and optional libadwaita widgets', () => {
    const host = createGtkRenderHost(createGtk(), {
      adw: { PreferencesPage: FakeWidget, PreferencesGroup: FakeWidget, ActionRow: FakeWidget,
        SwitchRow: FakeWidget, EntryRow: FakeWidget, PasswordEntryRow: FakeWidget,
        ExpanderRow: FakeWidget, ComboRow: FakeWidget, SpinRow: FakeWidget,
        Banner: FakeWidget, HeaderBar: FakeWidget, ToolbarView: FakeWidget },
    });
    for (const name of ['GtkCheckButton', 'GtkDropDown', 'GtkSpinButton', 'GtkProgressBar', 'GtkSeparator', 'GtkListBox', 'GtkListBoxRow', 'GtkGrid', 'GtkStack', 'GtkRevealer', 'GtkTextView', 'GtkPasswordEntry', 'GtkSearchEntry', 'GtkScale', 'AdwSwitchRow', 'AdwEntryRow', 'AdwPasswordEntryRow', 'AdwExpanderRow', 'AdwComboRow', 'AdwSpinRow', 'AdwBanner', 'AdwHeaderBar', 'AdwToolbarView', 'HeaderBar', 'Sidebar']) {
      expect(host.element(name, {}, undefined)).toBeInstanceOf(FakeWidget);
    }
  });


  it('applies static and reactive inline styles to GTK widgets and releases providers', () => {
    const host = createGtkRenderHost(createGtk());
    const style = signal('color: red;');
    const revision = signal(0);
    const widget = host.element('GtkLabel', {
      class: 'heading',
      style: { kind: 'binding', get: () => { revision.get(); return style.get(); } },
    }, undefined) as FakeWidget;
    expect([...widget.classes]).toEqual(['heading']);
    const provider = [...widget.styleContext.providers][0];
    expect(provider?.data).toBe('* { color: red; }');
    expect(provider?.loadCount).toBe(1);
    revision.set(1);
    expect(provider?.loadCount).toBe(1);
    style.set('font-weight: bold;');
    expect(provider?.data).toBe('* { font-weight: bold; }');
    expect(provider?.loadCount).toBe(2);
    revision.set(2);
    expect(provider?.loadCount).toBe(2);
    host.destroy(widget);
    expect(widget.styleContext.providers.size).toBe(0);
  });

  it('synchronizes component host classes and styles once initially', () => {
    const host = createGtkRenderHost(createGtk());
    const classes = signal({ active: true });
    const color = signal('red');
    const revision = signal(0);
    let classReads = 0;
    let styleReads = 0;
    const widget = host.element('GtkLabel', {}, undefined) as FakeWidget;
    host.setHostAttributes?.(widget, {
      classBinding: { kind: 'binding', get: () => { classReads += 1; return classes.get(); } },
      styleBinding: { kind: 'binding', get: () => { styleReads += 1; revision.get(); return `color: ${color.get()};`; } },
    });
    const provider = [...widget.styleContext.providers][0];
    expect(widget.classUpdateCount).toBe(1);
    expect(provider?.loadCount).toBe(1);
    expect(classReads).toBe(1);
    expect(styleReads).toBe(1);
    classes.set({ active: false });
    color.set('blue');
    expect(widget.classUpdateCount).toBe(2);
    expect(provider?.loadCount).toBe(2);
    expect(classReads).toBe(2);
    expect(styleReads).toBe(2);
    revision.set(1);
    expect(provider?.loadCount).toBe(2);
    expect(styleReads).toBe(3);
    host.destroy(widget);
  });

  it('combines reactive class maps and individual classes with unit-aware style bindings', () => {
    const host = createGtkRenderHost(createGtk());
    const classes = signal({ active: true, muted: false });
    const active = signal(false);
    const width = signal(120);
    const widget = host.element('GtkLabel', {
      class: 'heading',
      classBinding: { kind: 'binding', get: () => classes.get() },
      'class.selected': { kind: 'binding', get: () => active.get() },
      'style.width.px': { kind: 'binding', get: () => width.get() },
      'style.color': { kind: 'binding', get: () => 'red' },
    }, undefined) as FakeWidget;
    expect([...widget.classes].sort()).toEqual(['active', 'heading']);
    expect(widget.classUpdateCount).toBe(2);
    const provider = [...widget.styleContext.providers][0];
    expect(provider?.data).toContain('width: 120px;');
    expect(provider?.data).toContain('color: red;');
    classes.set({ active: false, muted: true });
    active.set(true);
    width.set(240);
    expect([...widget.classes].sort()).toEqual(['heading', 'muted', 'selected']);
    expect(provider?.data).toContain('width: 240px;');
    host.destroy(widget);
  });

  it('binds GtkScale values and emits native value changes', () => {
    const host = createGtkRenderHost(createGtk());
    const value = signal(0.25);
    const changed: number[] = [];
    const scale = host.element('GtkScale', {
      value: { kind: 'binding', get: () => value.get() },
      valueChange: (next: number) => { changed.push(next); value.set(next); },
    }, undefined) as FakeWidget;

    expect(scale.properties.value).toBe(0.25);
    value.set(0.75);
    expect(scale.properties.value).toBe(0.75);
    scale.properties.value = 0.5;
    scale.emit('value-changed');
    expect(changed).toEqual([0.5]);
    expect(value.get()).toBe(0.5);
    host.destroy(scale);
    scale.emit('value-changed');
    expect(changed).toEqual([0.5]);
  });

  it('binds GtkPasswordEntry through GtkEditable and emits changed text', () => {
    const host = createGtkRenderHost(createGtk());
    const value = signal('secret');
    const changed: string[] = [];
    const entry = host.element('GtkPasswordEntry', {
      text: { kind: 'binding', get: () => value.get() },
      textChange: (text: string) => { changed.push(text); value.set(text); },
    }, undefined) as FakePasswordEntry;

    expect(entry.text).toBe('secret');
    value.set('updated externally');
    expect(entry.text).toBe('updated externally');
    entry.set_text('typed secret');
    expect(changed).toEqual(['typed secret']);
    expect(value.get()).toBe('typed secret');
    host.destroy(entry);
    entry.set_text('ignored');
    expect(changed).toEqual(['typed secret']);
  });

  it('binds GtkTextView text through its native Gtk.TextBuffer', () => {
    const host = createGtkRenderHost(createGtk());
    const value = signal('first line\nsecond line');
    const changed: string[] = [];
    const view = host.element('GtkTextView', {
      text: { kind: 'binding', get: () => value.get() },
      textChange: (text: string) => { changed.push(text); value.set(text); },
    }, undefined) as FakeTextView;

    expect(view.buffer.text).toBe('first line\nsecond line');
    value.set('external update');
    expect(view.buffer.text).toBe('external update');
    view.buffer.set_text('typed\nby user');
    expect(changed).toEqual(['typed\nby user']);
    expect(value.get()).toBe('typed\nby user');
    host.destroy(view);
    view.buffer.set_text('ignored');
    expect(changed).toEqual(['typed\nby user']);
  });

  it('backs GtkDropDown with a reactive Gtk.StringList and emits the selected string', () => {
    const host = createGtkRenderHost(createGtk());
    const options = signal(['Red', 'Green', 'Blue']);
    const value = signal('Green');
    const changed: string[] = [];
    const dropdown = host.element('GtkDropDown', {
      options: { kind: 'binding', get: () => options.get() },
      value: { kind: 'binding', get: () => value.get() },
      valueChange: (selected: string) => changed.push(selected),
    }, undefined) as FakeWidget;

    expect((dropdown.properties.model as FakeStringList).items).toEqual(['Red', 'Green', 'Blue']);
    expect(dropdown.properties.selected).toBe(1);
    options.set(['Blue', 'Green']);
    expect((dropdown.properties.model as FakeStringList).items).toEqual(['Blue', 'Green']);
    expect(dropdown.properties.selected).toBe(1);
    value.set('Blue');
    expect(dropdown.properties.selected).toBe(0);

    dropdown.properties.selected = 1;
    dropdown.emit('notify::selected');
    expect(changed).toEqual(['Green']);
    host.destroy(dropdown);
    options.set(['One']);
    expect((dropdown.properties.model as FakeStringList).items).toEqual(['Blue', 'Green']);
  });

  it('requires Gtk.StringList instead of silently creating a non-functional dropdown', () => {
    const Gtk = createGtk();
    const { StringList: _StringList, ...withoutStringList } = Gtk;
    expect(() => createGtkRenderHost(withoutStringList).element('GtkDropDown', { options: [], value: '' }, undefined))
      .toThrow(/requires Gtk.StringList/);
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

  it('maps GTPL Flex direction, gap and homogeneous to native GTK box properties', () => {
    const host = createGtkRenderHost(createGtk());
    const direction = signal('row');
    const homogeneous = signal('false');
    const flex = host.element('Flex', {
      direction: { kind: 'binding', get: () => direction.get() },
      gap: '12',
      homogeneous: { kind: 'binding', get: () => homogeneous.get() },
    }, undefined) as FakeWidget;

    expect(flex.properties).toMatchObject({ orientation: 0, spacing: 12, homogeneous: false });
    direction.set('column');
    homogeneous.set('true');
    expect(flex.properties.orientation).toBe(1);
    expect(flex.properties.homogeneous).toBe(true);
    host.destroy(flex);
    expect(() => host.element('Flex', { direction: 'diagonal' }, undefined)).toThrow(/Flex direction/);
    expect(() => host.element('Flex', { homogeneous: 'yes' }, undefined)).toThrow(/Flex homogeneous/);
  });

  it('rejects native Flex options that GTK Box cannot implement', () => {
    const host = createGtkRenderHost(createGtk());
    expect(() => host.element('Flex', { wrap: true }, undefined)).toThrow(/Flex wrap is not supported/);
    expect(() => host.element('GtkButton', { grow: 2 }, undefined)).toThrow(/grow weights are not supported/);
  });
  it('maps static and reactive GTPL Flex alignment to GTK alignment properties', () => {
    const host = createGtkRenderHost(createGtk());
    const aligned = host.element('Flex', { align: 'center' }, undefined) as FakeWidget;
    expect(aligned.properties).toMatchObject({ halign: 3, valign: 3 });

    const value = signal('start');
    const reactive = host.element('Flex', {
      align: { kind: 'binding', get: () => value.get() },
    }, undefined) as FakeWidget;
    expect(reactive.properties).toMatchObject({ halign: 1, valign: 1 });
    value.set('end');
    expect(reactive.properties).toMatchObject({ halign: 2, valign: 2 });
    host.destroy(reactive);
    expect(() => host.element('Flex', { align: 'middle' }, undefined)).toThrow(/Flex align/);
  });

  it('maps static and reactive GTPL expand to both GTK expansion axes', () => {
    const host = createGtkRenderHost(createGtk());
    const expanded = host.element('GtkButton', { expand: 'true' }, undefined) as FakeWidget;
    expect(expanded.properties).toMatchObject({ hexpand: true, vexpand: true });

    const value = signal('false');
    const reactive = host.element('GtkButton', {
      expand: { kind: 'binding', get: () => value.get() },
    }, undefined) as FakeWidget;
    expect(reactive.properties).toMatchObject({ hexpand: false, vexpand: false });
    value.set('true');
    expect(reactive.properties).toMatchObject({ hexpand: true, vexpand: true });
    host.destroy(reactive);
    expect(() => host.element('GtkButton', { expand: 'yes' }, undefined)).toThrow(/expand must/);
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

  it('normalizes string-valued GTK numeric and boolean properties', () => {
    const host = createGtkRenderHost(createGtk());
    const spacing = signal('12');
    const fraction = signal('0.25');
    const active = signal('false');
    const box = host.element('GtkBox', {
      spacing: { kind: 'binding', get: () => spacing.get() },
      'margin-top': '20',
    }, undefined) as FakeWidget;
    const progress = host.element('GtkProgressBar', {
      fraction: { kind: 'binding', get: () => fraction.get() },
      'show-text': 'true',
    }, undefined) as FakeWidget;
    const toggle = host.element('GtkCheckButton', {
      active: { kind: 'binding', get: () => active.get() },
    }, undefined) as FakeWidget;
    const spin = host.element('GtkSpinButton', { value: '3' }, undefined) as FakeWidget;

    expect(box.properties).toMatchObject({ spacing: 12, margin_top: 20 });
    expect(progress.properties).toMatchObject({ fraction: 0.25, show_text: true });
    expect(toggle.properties.active).toBe(false);
    expect(spin.properties.value).toBe(3);

    spacing.set('16');
    fraction.set('0.75');
    active.set('true');
    expect(box.properties.spacing).toBe(16);
    expect(progress.properties.fraction).toBe(0.75);
    expect(toggle.properties.active).toBe(true);

    host.destroy(box);
    host.destroy(progress);
    host.destroy(toggle);
    host.destroy(spin);
    expect(() => host.element('GtkBox', { spacing: '1.5' }, undefined))
      .toThrow('GTK spacing must be an integer.');
    expect(() => host.element('GtkCheckButton', { active: 'yes' }, undefined))
      .toThrow('active must be "true" or "false".');
  });

  it('converts GTK orientation strings to native enum values', () => {
    const Gtk = { ...createGtk(), Orientation: { HORIZONTAL: 10, VERTICAL: 20 } };
    const host = createGtkRenderHost(Gtk);
    const separator = host.element('GtkSeparator', { orientation: 'horizontal' }, undefined) as FakeWidget;
    expect(separator.properties.orientation).toBe(10);

    const direction = signal('vertical');
    const reactive = host.element('GtkSeparator', {
      orientation: { kind: 'binding', get: () => direction.get() },
    }, undefined) as FakeWidget;
    expect(reactive.properties.orientation).toBe(20);
    direction.set('horizontal');
    expect(reactive.properties.orientation).toBe(10);
    expect(() => host.element('GtkSeparator', { orientation: 'diagonal' }, undefined))
      .toThrow('GTK orientation must be "horizontal" or "vertical".');
    host.destroy(separator);
    host.destroy(reactive);
  });

  it('normalizes static and reactive GtkScale values from GTPL strings', () => {
    const host = createGtkRenderHost(createGtk());
    const value = signal('0.4');
    const slider = host.element('GtkScale', { value: '0.4' }, undefined) as FakeWidget;
    const reactive = host.element('GtkScale', {
      value: { kind: 'binding', get: () => value.get() },
    }, undefined) as FakeWidget;

    expect(slider.properties.value).toBe(0.4);
    expect(reactive.properties.value).toBe(0.4);
    value.set('0.75');
    expect(reactive.properties.value).toBe(0.75);

    host.destroy(slider);
    host.destroy(reactive);
    expect(() => host.element('GtkScale', { value: 'invalid' }, undefined))
      .toThrow('GTK value must be a finite number.');
  });

  it('converts GTK float properties from GTPL string attributes', () => {
    const host = createGtkRenderHost(createGtk());
    const label = host.element('GtkLabel', { xalign: '0', yalign: '1' }, undefined) as FakeWidget;
    expect(label.properties).toMatchObject({ xalign: 0, yalign: 1 });

    const alignment = signal('0.25');
    const reactive = host.element('GtkLabel', {
      xalign: { kind: 'binding', get: () => alignment.get() },
    }, undefined) as FakeWidget;
    expect(reactive.properties.xalign).toBe(0.25);
    alignment.set('0.75');
    expect(reactive.properties.xalign).toBe(0.75);
    expect(() => host.element('GtkLabel', { xalign: 'invalid' }, undefined)).toThrow('GTK xalign must be a finite number.');
    host.destroy(label);
    host.destroy(reactive);
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

  it('updates retained GTK rows when their keyed item and index change', () => {
    const host = createGtkRenderHost(createGtk());
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
        return host.element('GtkLabel', {
          label: runtime.bind(() => `${current.label}:${currentIndex}/${currentCount}`),
        }, undefined);
      },
      (item) => item.id,
      () => host.text('empty'),
    ) as FakeWidget;
    const originalA = list.children[0] as FakeWidget;
    const originalB = list.children[1] as FakeWidget;
    expect(originalA.properties.label).toBe('A:0/2');
    expect(originalB.properties.label).toBe('B:1/2');
    values.set([{ id: 'b', label: 'B2' }, { id: 'a', label: 'A2' }]);
    expect(list.children).toEqual([originalB, originalA]);
    expect(originalB.properties.label).toBe('B2:0/2');
    expect(originalA.properties.label).toBe('A2:1/2');
    expect(renders).toBe(2);
    host.destroy(list);
  });
  it('updates nested GTK branches and loops when a parent row changes', () => {
    const host = createGtkRenderHost(createGtk());
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
          () => host.element('GtkLabel', { label: runtime.bind(() => current.label) }, undefined),
          () => host.text('hidden'),
        );
        const switched = runtime.switch(
          runtime.bind(() => current.mode),
          [{ values: ['ready'], render: () => host.element('GtkLabel', { label: runtime.bind(() => current.label + '-switch') }, undefined) }],
          () => host.text('idle'),
        );
        const nested = runtime.for(
          runtime.bind(() => current.children),
          (child, _childIndex, _childCount, registerChildUpdate) => {
            let currentChild = child;
            registerChildUpdate((nextChild) => { currentChild = nextChild; });
            return host.element('GtkLabel', { label: runtime.bind(() => currentChild.label) }, undefined);
          },
          (child) => child.id,
          () => host.text('empty child'),
        );
        return host.element('GtkBox', {}, host.fragment([conditional, switched, nested]));
      },
      (item) => item.id,
      () => host.text('empty parent'),
    ) as FakeWidget;
    const row = list.children[0] as FakeWidget;
    const content = row.children[0] as FakeWidget;
    const conditional = content.children[0] as FakeWidget;
    const switched = content.children[1] as FakeWidget;
    const nested = content.children[2] as FakeWidget;
    const originalChild = nested.children[0] as FakeWidget;
    expect((conditional.children[0] as FakeWidget).properties.label).toBe('Before');
    expect((switched.children[0] as FakeWidget).properties.label).toBe('idle');
    expect(originalChild.properties.label).toBe('Child');
    values.set([{
      id: 'parent',
      label: 'After',
      show: true,
      mode: 'ready',
      children: [{ id: 'child', label: 'Child 2' }, { id: 'new', label: 'New child' }],
    }]);
    expect(list.children[0]).toBe(row);
    expect((conditional.children[0] as FakeWidget).properties.label).toBe('After');
    expect((switched.children[0] as FakeWidget).properties.label).toBe('After-switch');
    expect(nested.children[0]).toBe(originalChild);
    expect(nested.children.map((child) => (child as FakeWidget).properties.label)).toEqual(['Child 2', 'New child']);
    host.destroy(list);
  });
  it('moves only the GTK row that changes position', () => {
    const host = createGtkRenderHost(createGtk());
    const state = signal({ items: [
      { key: 'a', index: 0, node: host.text('a') as FakeWidget },
      { key: 'b', index: 1, node: host.text('b') as FakeWidget },
      { key: 'c', index: 2, node: host.text('c') as FakeWidget },
    ] });
    const list = host.repeat({ kind: 'binding', get: () => state.get() }) as FakeWidget;
    const [a, b, c] = [...list.children] as FakeWidget[];
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
