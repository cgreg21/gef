import { isGtplBinding, type GtplBinding, type GtplRenderHost, type GtplRepeatItem, type GtplRepeatState } from '../../rendering/gtpl-runtime.js';
import { effect } from '../../reactivity/signal.js';
import { ResourceScope } from '../../resources/resource-scope.js';
import { classNames, styleDeclarations, styleText } from '../gtpl-bindings.js';

export interface GtkActor {
  append?(child: GtkActor): void;
  add?(child: GtkActor): void;
  add_suffix?(child: GtkActor): void;
  pack_start?(child: GtkActor): void;
  packStart?(child: GtkActor): void;
  attach?(child: GtkActor, column: number, row: number, width: number, height: number): void;
  remove_suffix?(child: GtkActor): void;
  remove?(child: GtkActor): void;
  set_child?(child: GtkActor | null): void;
  set_property?(name: string, value: unknown): void;
  get_property?(name: string): unknown;
  get_style_context?(): GtkStyleContext;
  set_range?(lower: number, upper: number): void;
  set_increments?(step: number, page: number): void;
  set_text?(text: string): void;
  setText?(text: string): void;
  connect?(signal: string, callback: (actor: GtkActor, ...args: unknown[]) => unknown): number;
  disconnect?(id: number): void;
  on?(signal: string, callback: (...args: unknown[]) => unknown): void;
  off?(signal: string, callback: (...args: unknown[]) => unknown): void;
  get_parent?(): GtkActor | null;
  getParent?(): GtkActor | null;
  add_css_class?(name: string): void;
  remove_css_class?(name: string): void;
  setChild?(child: GtkActor | null): void;
  addSuffix?(child: GtkActor): void;
  removeSuffix?(child: GtkActor): void;
  addCssClass?(name: string): void;
  removeCssClass?(name: string): void;
}

export type GtkWidgetConstructor = new (properties?: Record<string, unknown>) => GtkActor;

export interface GtkTextBuffer extends GtkActor {
  set_text?(text: string, length?: number): void;
  setText?(text: string, length?: number): void;
  get_bounds?(): unknown[];
  getBounds?(): unknown[];
  get_text?(start: unknown, end: unknown, includeHiddenChars: boolean): string;
  getText?(start: unknown, end: unknown, includeHiddenChars: boolean): string;
}

export interface GtkStringList extends GtkActor {
  get_item?(position: number): { get_string?(): string; getString?(): string } | null;
  getItem?(position: number): { get_string?(): string; getString?(): string } | null;
  get_string?(position: number): string | null;
  getString?(position: number): string | null;
}

export interface GtkStringListNamespace {
  readonly new: (strings: string[]) => GtkStringList;
}

export interface GtkStyleContext {
  add_provider(provider: GtkInlineCssProvider, priority: number): void;
  remove_provider(provider: GtkInlineCssProvider): void;
}

export interface GtkInlineCssProvider {
  load_from_data(data: string): void;
}

export interface GtkNamespace {
  readonly CssProvider?: new () => GtkInlineCssProvider;
  readonly STYLE_PROVIDER_PRIORITY_APPLICATION?: number;
  readonly Box: GtkWidgetConstructor;
  readonly Label: GtkWidgetConstructor;
  readonly Button: GtkWidgetConstructor;
  readonly Entry: GtkWidgetConstructor;
  readonly Image: GtkWidgetConstructor;
  readonly ScrolledWindow: GtkWidgetConstructor;
  readonly HeaderBar?: GtkWidgetConstructor;
  readonly Switch?: GtkWidgetConstructor;
  readonly CheckButton?: GtkWidgetConstructor;
  readonly DropDown?: GtkWidgetConstructor;
  readonly StringList?: GtkStringListNamespace;
  readonly SpinButton?: GtkWidgetConstructor;
  readonly ProgressBar?: GtkWidgetConstructor;
  readonly Separator?: GtkWidgetConstructor;
  readonly ListBox?: GtkWidgetConstructor;
  readonly ListBoxRow?: GtkWidgetConstructor;
  readonly Grid?: GtkWidgetConstructor;
  readonly Stack?: GtkWidgetConstructor;
  readonly Revealer?: GtkWidgetConstructor;
  readonly TextView?: GtkWidgetConstructor;
  readonly PasswordEntry?: GtkWidgetConstructor;
  readonly SearchEntry?: GtkWidgetConstructor;
  readonly Scale?: GtkWidgetConstructor;
}

export interface AdwNamespace {
  readonly PreferencesPage?: GtkWidgetConstructor;
  readonly PreferencesGroup?: GtkWidgetConstructor;
  readonly ActionRow?: GtkWidgetConstructor;
  readonly SwitchRow?: GtkWidgetConstructor;
  readonly EntryRow?: GtkWidgetConstructor;
  readonly PasswordEntryRow?: GtkWidgetConstructor;
  readonly ExpanderRow?: GtkWidgetConstructor;
  readonly ComboRow?: GtkWidgetConstructor;
  readonly SpinRow?: GtkWidgetConstructor;
  readonly Banner?: GtkWidgetConstructor;
  readonly HeaderBar?: GtkWidgetConstructor;
  readonly ToolbarView?: GtkWidgetConstructor;
}

export interface GtkRenderHostOptions {
  readonly components?: Readonly<Record<string, GtkWidgetConstructor>>;
  readonly adw?: AdwNamespace;
  readonly orientation?: unknown;
  readonly spacing?: number;
  readonly api?: 'gjs' | 'node-gtk';
}

function twoWayProperty(event: string): string | undefined {
  return event.endsWith('Change') && event.length > 6 ? event.slice(0, -6) : undefined;
}

function notifySignal(property: string): string {
  return `notify::${property.replace(/([A-Z])/g, '-$1').replace(/_/g, '-').toLowerCase()}`;
}

function propertyName(name: string, api: 'gjs' | 'node-gtk' = 'gjs'): string {
  if (name === 'class' || name === 'className') return api === 'node-gtk' ? 'cssClasses' : 'css_classes';
  const camelCase = name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return api === 'node-gtk'
    ? camelCase
    : camelCase.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
}


function booleanValue(attribute: string, value: unknown): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${attribute} must be "true" or "false".`);
}

function alignValue(value: unknown): number {
  const alignments: Record<string, number> = { fill: 0, start: 1, end: 2, center: 3 };
  if (typeof value !== 'string' || !(value in alignments)) {
    throw new Error('Flex align must be "fill", "start", "center" or "end".');
  }
  const alignment = alignments[value];
  if (alignment === undefined) throw new Error('Invalid Flex alignment.');
  return alignment;
}

function flexValue(attribute: string, value: unknown): unknown {
  if (attribute === 'direction') {
    if (value === 'row') return 0;
    if (value === 'column') return 1;
    throw new Error('Flex direction must be "row" or "column".');
  }
  if (attribute === 'gap') {
    const gap = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(gap) || gap < 0) throw new Error('Flex gap must be a non-negative number.');
    return gap;
  }
  if (attribute === 'homogeneous') {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new Error('Flex homogeneous must be "true" or "false".');
  }
  return value;
}

function layoutAttribute(name: string, attribute: string, value: unknown): [string, unknown] {
  if (name === 'Grid' && attribute === 'columns') {
    const columns = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(columns) || columns < 1) throw new Error('Grid columns must be a positive integer.');
    return [attribute, columns];
  }
  if (name === 'Grid' && attribute === 'gap') {
    const gap = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(gap) || gap < 0) throw new Error('Grid gap must be a non-negative number.');
    return ['column-spacing', gap];
  }
  if (name !== 'Flex' || !['direction', 'gap', 'homogeneous'].includes(attribute)) return [attribute, value];
  const property = attribute === 'direction' ? 'orientation' : attribute === 'gap' ? 'spacing' : 'homogeneous';
  if (isGtplBinding(value)) {
    return [property, { kind: 'binding', get: () => flexValue(attribute, value.get()) } satisfies GtplBinding<unknown>];
  }
  return [property, flexValue(attribute, value)];
}

function readProperty(actor: GtkActor, property: string, api: 'gjs' | 'node-gtk'): unknown {
  const target = actor as unknown as Record<string, unknown>;
  const name = propertyName(property, api);
  if (api === 'node-gtk') return target[name];
  if (property in target) return target[property];
  return target[name] ?? actor.get_property?.(name);
}

function setProperty(actor: GtkActor, property: string, value: unknown, api: 'gjs' | 'node-gtk'): void {
  if (api === 'node-gtk') {
    (actor as unknown as Record<string, unknown>)[propertyName(property, api)] = value;
  } else if (actor.set_property) {
    actor.set_property(propertyName(property, api), value);
  } else {
    (actor as unknown as Record<string, unknown>)[propertyName(property, api)] = value;
  }
}

function connectSignal(
  actor: GtkActor,
  signal: string,
  callback: (actor: GtkActor, ...args: unknown[]) => unknown,
): () => void {
  if (actor.on && actor.off) {
    const handler = (...args: unknown[]) => callback(actor, ...args);
    actor.on(signal, handler);
    return () => actor.off?.(signal, handler);
  }
  if (actor.connect && actor.disconnect) {
    const id = actor.connect(signal, callback);
    return () => actor.disconnect?.(id);
  }
  throw new Error('This GTK widget does not support signal connections.');
}

function addChild(parent: GtkActor, child: GtkActor): void {
  if (typeof parent.set_child === 'function') parent.set_child(child);
  else if (typeof parent.setChild === 'function') parent.setChild(child);
  else if (typeof parent.append === 'function') parent.append(child);
  else if (typeof parent.pack_start === 'function') parent.pack_start(child);
  else if (typeof parent.packStart === 'function') parent.packStart(child);
  else if (typeof parent.add_suffix === 'function') parent.add_suffix(child);
  else if (typeof parent.addSuffix === 'function') parent.addSuffix(child);
  else if (typeof parent.add === 'function') parent.add(child);
  else throw new Error('This GTK widget cannot contain child widgets.');
}

function removeChild(parent: GtkActor, child: GtkActor): void {
  if (typeof parent.remove_suffix === 'function') parent.remove_suffix(child);
  else if (typeof parent.removeSuffix === 'function') parent.removeSuffix(child);
  else if (typeof parent.remove === 'function') parent.remove(child);
  else if (typeof parent.set_child === 'function') parent.set_child(null);
  else if (typeof parent.setChild === 'function') parent.setChild(null);
  else throw new Error('This GTK container cannot remove its child widget.');
}

function makeBox(Gtk: GtkNamespace, options: GtkRenderHostOptions): GtkActor {
  const properties: Record<string, unknown> = {};
  if (options.orientation !== undefined) properties.orientation = options.orientation;
  if (options.spacing !== undefined) properties.spacing = options.spacing;
  return new Gtk.Box(properties);
}

/** Creates a GTK4/libadwaita host. Gtk and Adw namespaces are supplied by the preferences process. */
export function createGtkRenderHost(
  Gtk: GtkNamespace,
  options: GtkRenderHostOptions = {},
): GtplRenderHost<GtkActor> {
  const constructors: Readonly<Record<string, GtkWidgetConstructor>> = {
    GtkBox: Gtk.Box,
    Flex: Gtk.Box,
    ...(Gtk.Grid ? { Grid: Gtk.Grid } : {}),
    HeaderBar: options.adw?.HeaderBar ?? Gtk.HeaderBar ?? Gtk.Box,
    Sidebar: Gtk.Box,
    GtkLabel: Gtk.Label,
    GtkButton: Gtk.Button,
    GtkEntry: Gtk.Entry,
    GtkImage: Gtk.Image,
    GtkScrolledWindow: Gtk.ScrolledWindow,
    ...(Gtk.Switch ? { GtkSwitch: Gtk.Switch } : {}),
    ...(Gtk.CheckButton ? { GtkCheckButton: Gtk.CheckButton } : {}),
    ...(Gtk.DropDown ? { GtkDropDown: Gtk.DropDown } : {}),
    ...(Gtk.SpinButton ? { GtkSpinButton: Gtk.SpinButton } : {}),
    ...(Gtk.ProgressBar ? { GtkProgressBar: Gtk.ProgressBar } : {}),
    ...(Gtk.Separator ? { GtkSeparator: Gtk.Separator } : {}),
    ...(Gtk.ListBox ? { GtkListBox: Gtk.ListBox } : {}),
    ...(Gtk.ListBoxRow ? { GtkListBoxRow: Gtk.ListBoxRow } : {}),
    ...(Gtk.Grid ? { GtkGrid: Gtk.Grid } : {}),
    ...(Gtk.Stack ? { GtkStack: Gtk.Stack } : {}),
    ...(Gtk.Revealer ? { GtkRevealer: Gtk.Revealer } : {}),
    ...(Gtk.TextView ? { GtkTextView: Gtk.TextView } : {}),
    ...(Gtk.PasswordEntry ? { GtkPasswordEntry: Gtk.PasswordEntry } : {}),
    ...(Gtk.SearchEntry ? { GtkSearchEntry: Gtk.SearchEntry } : {}),
    ...(Gtk.Scale ? { GtkScale: Gtk.Scale } : {}),
    ...(options.adw?.PreferencesPage ? { AdwPreferencesPage: options.adw.PreferencesPage } : {}),
    ...(options.adw?.PreferencesGroup ? { AdwPreferencesGroup: options.adw.PreferencesGroup } : {}),
    ...(options.adw?.ActionRow ? { AdwActionRow: options.adw.ActionRow } : {}),
    ...(options.adw?.SwitchRow ? { AdwSwitchRow: options.adw.SwitchRow } : {}),
    ...(options.adw?.EntryRow ? { AdwEntryRow: options.adw.EntryRow } : {}),
    ...(options.adw?.PasswordEntryRow ? { AdwPasswordEntryRow: options.adw.PasswordEntryRow } : {}),
    ...(options.adw?.ExpanderRow ? { AdwExpanderRow: options.adw.ExpanderRow } : {}),
    ...(options.adw?.ComboRow ? { AdwComboRow: options.adw.ComboRow } : {}),
    ...(options.adw?.SpinRow ? { AdwSpinRow: options.adw.SpinRow } : {}),
    ...(options.adw?.Banner ? { AdwBanner: options.adw.Banner } : {}),
    ...(options.adw?.HeaderBar ? { AdwHeaderBar: options.adw.HeaderBar } : {}),
    ...(options.adw?.ToolbarView ? { AdwToolbarView: options.adw.ToolbarView } : {}),
    ...options.components,
  };
  const resources = new WeakMap<GtkActor, ResourceScope>();
  const children = new WeakMap<GtkActor, GtkActor[]>();
  const disposed = new WeakSet<GtkActor>();
  const fragments = new WeakSet<GtkActor>();

  const own = (actor: GtkActor, scope: ResourceScope): void => {
    resources.set(actor, scope);
    // GTK4 widgets do not expose GTK3's destroy signal; explicit view disposal owns cleanup.
  };

  const disposeWidget = (actor: GtkActor, detach = true): void => {
    if (disposed.has(actor)) return;
    disposed.add(actor);
    for (const child of children.get(actor) ?? []) disposeWidget(child, false);
    resources.get(actor)?.dispose();
    const parent = detach ? (actor.get_parent ?? actor.getParent)?.call(actor) : null;
    if (parent) removeChild(parent, actor);
    children.delete(actor);
    resources.delete(actor);
  };

  const makeDynamicBox = (update: (box: GtkActor, scope: ResourceScope) => void): GtkActor => {
    const box = makeBox(Gtk, options);
    const scope = new ResourceScope();
    own(box, scope);
    try {
      update(box, scope);
      return box;
    } catch (error) {
      disposeWidget(box);
      throw error;
    }
  };

  return {
    setProperty: (actor, property, value) => setProperty(actor, property, value, options.api ?? 'gjs'),
    listen: (actor, event, handler) => connectSignal(actor, event, (_source, ...args) => handler(...args)),
    onDestroy: (actor, callback) => {
      const scope = resources.get(actor);
      if (!scope) throw new Error('Cannot attach lifecycle cleanup to an unmanaged GTK widget.');
      scope.add(callback);
    },
    element(name, attributes, child) {
      const Constructor = constructors[name];
      if (!Constructor) throw new Error(`Unknown GTK component "${name}". Register a Gtk or Adw widget constructor.`);
      const properties: Record<string, unknown> = {};
      const events: Array<[string, (...args: unknown[]) => unknown]> = [];
      const bindings: Array<[string, GtplBinding<unknown>]> = [];
      const classes: string[] = [];
      const classBindings: Array<{ name?: string; unit?: string; binding: GtplBinding<unknown> }> = [];
      const styleBindings: Array<{ name: string; unit?: string; binding: GtplBinding<unknown> }> = [];
      let styleValue: unknown;
      let styleBindingValue: unknown;
      let gridColumns = 2;
      const isSelect = name === 'GtkDropDown' && Object.prototype.hasOwnProperty.call(attributes, 'options');
      const isTextArea = name === 'GtkTextView' && Object.prototype.hasOwnProperty.call(attributes, 'text');
      const isPasswordInput = name === 'GtkPasswordEntry' && Object.prototype.hasOwnProperty.call(attributes, 'text');
      const isSlider = name === 'GtkScale' && Object.prototype.hasOwnProperty.call(attributes, 'value');
      const sliderValue = isSlider ? attributes.value : undefined;
      const sliderChange = isSlider ? attributes.valueChange : undefined;
      const selectOptions = isSelect ? attributes.options : undefined;
      const passwordValue = isPasswordInput ? attributes.text : undefined;
      const passwordChange = isPasswordInput ? attributes.textChange : undefined;
      const textValue = isTextArea ? attributes.text : undefined;
      const textChange = isTextArea ? attributes.textChange : undefined;
      const selectValue = isSelect ? attributes.value : undefined;
      const selectChange = isSelect ? attributes.valueChange : undefined;
      for (const [attribute, value] of Object.entries(attributes)) {
        if (isSelect && ['options', 'value', 'valueChange'].includes(attribute)) continue;
        if (isTextArea && ['text', 'textChange'].includes(attribute)) continue;
        if (isPasswordInput && ['text', 'textChange'].includes(attribute)) continue;
        if (isSlider && ['value', 'valueChange'].includes(attribute)) continue;
        if (attribute === 'style') { styleValue = value; continue; }
        if (attribute === 'styleBinding') { styleBindingValue = value; continue; }
        if (attribute === 'classBinding') {
          classBindings.push({ binding: value as GtplBinding<unknown> });
          continue;
        }
        if (attribute === 'class' || attribute === 'className') {
          if (isGtplBinding(value)) classBindings.push({ binding: value });
          else classes.push(...classNames(value));
          continue;
        }
        if (attribute.startsWith('class.')) {
          if (isGtplBinding(value)) classBindings.push({ name: attribute.slice(6), binding: value });
          else if (value) classes.push(attribute.slice(6));
          continue;
        }
        if (attribute.startsWith('style.')) {
          const parts = attribute.slice(6).split('.');
          const unit = parts.length > 1 ? parts.pop() : undefined;
          const name = (parts[0] ?? '').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
          if (!name) throw new Error('GTPL style binding requires a CSS property name.');
          if (isGtplBinding(value)) styleBindings.push({ name, unit, binding: value });
          else if (value !== null && value !== undefined) styleBindings.push({ name, unit, binding: { kind: 'binding', get: () => value } });
          continue;
        }
        if (name === 'Flex' && attribute === 'align') {
          for (const property of ['halign', 'valign']) {
            if (isGtplBinding(value)) bindings.push([property, {
              kind: 'binding', get: () => alignValue(value.get()),
            } satisfies GtplBinding<unknown>]);
            else properties[property] = alignValue(value);
          }
          continue;
        }
        if (attribute === 'expand') {
          for (const property of ['hexpand', 'vexpand']) {
            if (isGtplBinding(value)) bindings.push([property, {
              kind: 'binding', get: () => booleanValue('expand', value.get()),
            } satisfies GtplBinding<unknown>]);
            else properties[property] = booleanValue('expand', value);
          }
          continue;
        }
        const [property, normalized] = layoutAttribute(name, attribute, value);
        if (name === 'Grid' && attribute === 'columns') { gridColumns = normalized as number; continue; }
        if (name === 'Grid' && attribute === 'gap') { properties[propertyName('row-spacing', options.api)] = normalized; properties[propertyName('column-spacing', options.api)] = normalized; continue; }
        if (isGtplBinding(normalized)) bindings.push([property, normalized]);
        else if (typeof normalized === 'function') events.push([property, normalized as (...args: unknown[]) => unknown]);
        else properties[propertyName(property, options.api)] = normalized;
      }

      if (name === 'Flex') properties.orientation ??= 0;
      if (name === 'HeaderBar' && Constructor === Gtk.Box) properties.orientation ??= 0;
      if (name === 'Sidebar') properties.orientation ??= 1;
      const actor = new Constructor(properties);
      const scope = new ResourceScope();
      if (isSlider) {
        actor.set_range?.(0, 1);
        actor.set_increments?.(0.01, 0.1);
        let updating = false;
        const syncValue = (): void => {
          const value = isGtplBinding(sliderValue) ? sliderValue.get() : sliderValue;
          if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('GtkScale value must be a finite number.');
          updating = true;
          try { setProperty(actor, 'value', Math.min(1, Math.max(0, value)), options.api ?? 'gjs'); }
          finally { updating = false; }
        };
        if (isGtplBinding(sliderValue)) scope.add(effect(syncValue));
        else syncValue();
        if (typeof sliderChange === 'function') scope.add(connectSignal(actor, 'value-changed', () => {
          if (!updating) sliderChange(readProperty(actor, 'value', options.api ?? 'gjs'));
        }));
      }
      if (isPasswordInput) {
        let updating = false;
        const readText = (): string => {
          const value = readProperty(actor, 'text', options.api ?? 'gjs');
          return typeof value === 'string' ? value : '';
        };
        const syncText = (): void => {
          const value = isGtplBinding(passwordValue) ? passwordValue.get() : passwordValue ?? '';
          if (typeof value !== 'string') throw new Error('GtkPasswordEntry text must be a string.');
          updating = true;
          try {
            if (actor.set_text) actor.set_text(value);
            else if (actor.setText) actor.setText(value);
            else setProperty(actor, 'text', value, options.api ?? 'gjs');
          } finally { updating = false; }
        };
        if (isGtplBinding(passwordValue)) scope.add(effect(syncText));
        else syncText();
        if (typeof passwordChange === 'function') {
          scope.add(connectSignal(actor, 'changed', () => {
            if (!updating) passwordChange(readText());
          }));
        }
      }
      if (isTextArea) {
        const buffer = readProperty(actor, 'buffer', options.api ?? 'gjs') as GtkTextBuffer | undefined;
        if (!buffer) throw new Error('GtkTextView requires its native Gtk.TextBuffer.');
        let updating = false;
        const readText = (): string => {
          const value = readProperty(buffer, 'text', options.api ?? 'gjs');
          if (typeof value === 'string') return value;
          const bounds = buffer.get_bounds?.() ?? buffer.getBounds?.();
          if (Array.isArray(bounds) && bounds.length >= 2) {
            return buffer.get_text?.(bounds[0], bounds[1], true)
              ?? buffer.getText?.(bounds[0], bounds[1], true)
              ?? '';
          }
          return '';
        };
        const syncText = (): void => {
          const value = isGtplBinding(textValue) ? textValue.get() : textValue ?? '';
          if (typeof value !== 'string') throw new Error('GtkTextView text must be a string.');
          updating = true;
          try {
            if (buffer.set_text) buffer.set_text(value, -1);
            else if (buffer.setText) buffer.setText(value, -1);
            else setProperty(buffer, 'text', value, options.api ?? 'gjs');
          } finally {
            updating = false;
          }
        };
        if (isGtplBinding(textValue)) scope.add(effect(syncText));
        else syncText();
        if (typeof textChange === 'function') {
          scope.add(connectSignal(buffer, 'changed', () => {
            if (!updating) textChange(readText());
          }));
        }
      }
      if (isSelect) {
        if (!Gtk.StringList) throw new Error('GtkDropDown requires Gtk.StringList to provide a native options model.');
        const readOptions = (): string[] => {
          const value = isGtplBinding(selectOptions) ? selectOptions.get() : selectOptions;
          if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
            throw new Error('GtkDropDown options must be an array of strings.');
          }
          return value as string[];
        };
        let model = Gtk.StringList.new(readOptions());
        const syncSelection = (): void => {
          const value = isGtplBinding(selectValue) ? selectValue.get() : selectValue;
          const index = readOptions().indexOf(typeof value === 'string' ? value : '');
          setProperty(actor, 'selected', index < 0 ? 0xffffffff : index, options.api ?? 'gjs');
        };
        const setModel = (next: string[]): void => {
          model = Gtk.StringList!.new(next);
          setProperty(actor, 'model', model, options.api ?? 'gjs');
          syncSelection();
        };
        const selectedValue = (): string => {
          const selected = Number(readProperty(actor, 'selected', options.api ?? 'gjs'));
          if (!Number.isInteger(selected) || selected < 0 || selected >= readOptions().length) return '';
          const item = model.get_item?.(selected) ?? model.getItem?.(selected);
          return item?.get_string?.() ?? item?.getString?.() ?? model.get_string?.(selected) ?? model.getString?.(selected) ?? '';
        };
        setProperty(actor, 'model', model, options.api ?? 'gjs');
        if (isGtplBinding(selectOptions)) scope.add(effect(() => setModel(readOptions())));
        if (isGtplBinding(selectValue)) scope.add(effect(syncSelection));
        syncSelection();
        if (typeof selectChange === 'function') scope.add(connectSignal(actor, notifySignal('selected'), () => selectChange(selectedValue())));
      }
      own(actor, scope);
      try {
        if (styleValue !== undefined || styleBindingValue !== undefined || styleBindings.length) {
          const context = actor.get_style_context?.();
          if (!Gtk.CssProvider || !context) throw new Error('GTK style attributes require Gtk.CssProvider and Gtk.Widget.get_style_context().');
          const provider = new Gtk.CssProvider();
          const syncStyle = (): void => {
            const declarations = styleDeclarations(isGtplBinding(styleValue) ? styleValue.get() : styleValue);
            const boundStyles = isGtplBinding(styleBindingValue) ? styleBindingValue.get() : styleBindingValue;
            for (const [name, content] of styleDeclarations(boundStyles)) declarations.set(name, content);
            for (const item of styleBindings) {
              const value = item.binding.get();
              if (value === null || value === undefined) declarations.delete(item.name);
              else declarations.set(item.name, `${value}${item.unit ?? ''}`);
            }
            const css = styleText(declarations);
            if (/[{}]/.test(css)) throw new Error('GTPL style must contain CSS declarations only (without braces).');
            provider.load_from_data(css ? `* { ${css} }` : '* {}');
          };
          context.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION ?? 600);
          scope.add(() => context.remove_provider(provider));
          if (isGtplBinding(styleValue)) scope.add(effect(syncStyle));
          if (isGtplBinding(styleBindingValue)) scope.add(effect(syncStyle));
          for (const _item of styleBindings) scope.add(effect(syncStyle));
          syncStyle();
        }
        const activeClasses = new Set<string>();
        const syncClasses = (): void => {
          const next = new Set(classes);
          for (const item of classBindings) {
            const value = item.binding.get();
            if (item.name ? Boolean(value) : true) {
              for (const name of (item.name ? [item.name] : classNames(value))) next.add(name);
            }
          }
          for (const name of activeClasses) if (!next.has(name)) (actor.remove_css_class ?? actor.removeCssClass)?.call(actor, name);
          for (const name of next) if (!activeClasses.has(name)) (actor.add_css_class ?? actor.addCssClass)?.call(actor, name);
          activeClasses.clear();
          for (const name of next) activeClasses.add(name);
        };
        for (const _item of classBindings) scope.add(effect(syncClasses));
        syncClasses();
        for (const [signal, handler] of events) {
          const property = twoWayProperty(signal);
          scope.add(connectSignal(actor, property ? notifySignal(property) : signal, (_source, ...args) =>
            property ? handler(readProperty(actor, property, options.api ?? 'gjs')) : handler(args.length <= 1 ? args[0] : args)));
        }
        for (const [property, binding] of bindings) {
          scope.add(effect(() => setProperty(actor, property, binding.get(), options.api ?? 'gjs')));
        }
        for (const binding of classBindings) {
          let previousDynamicClasses: string[] = [];
          scope.add(effect(() => {
            const nextClasses = classNames(binding.get());
            for (const name of previousDynamicClasses) if (!nextClasses.includes(name)) (actor.remove_css_class ?? actor.removeCssClass)?.call(actor, name);
            for (const name of nextClasses) if (!previousDynamicClasses.includes(name)) (actor.add_css_class ?? actor.addCssClass)?.call(actor, name);
            previousDynamicClasses = nextClasses;
          }));
        }
        if (name === 'Grid') {
          if (typeof actor.attach !== 'function') throw new Error('This GTK Grid widget does not support child placement.');
          const fragmentNodes = child && fragments.has(child) ? children.get(child) ?? [] : undefined;
          const nodes = child ? (fragmentNodes ?? [child]) : [];
          if (child && fragmentNodes) {
            for (const node of nodes) removeChild(child, node);
            children.set(child, []);
            disposeWidget(child);
          }
          nodes.forEach((node, index) => actor.attach?.(node, index % gridColumns, Math.floor(index / gridColumns), 1, 1));
          children.set(actor, nodes);
        } else if (child) {
          addChild(actor, child);
          children.set(actor, [child]);
        } else {
          children.set(actor, []);
        }
        return actor;
      } catch (error) {
        disposeWidget(actor);
        throw error;
      }
    },
    text(value) {
      const actor = new Gtk.Label({ label: isGtplBinding(value) ? value.get() : value });
      const scope = new ResourceScope();
      own(actor, scope);
      if (isGtplBinding(value)) scope.add(effect(() => setProperty(actor, 'label', value.get(), options.api ?? 'gjs')));
      children.set(actor, []);
      return actor;
    },
    fragment(nodes) {
      const box = makeBox(Gtk, options);
      const added: GtkActor[] = [];
      own(box, new ResourceScope());
      try {
        for (const node of nodes) { addChild(box, node); added.push(node); }
        children.set(box, added);
        fragments.add(box);
        return box;
      } catch (error) {
        children.set(box, added);
        disposeWidget(box);
        throw error;
      }
    },
    repeat(state: GtplBinding<GtplRepeatState<GtkActor>>) {
      const box = makeBox(Gtk, options);
      const scope = new ResourceScope();
      own(box, scope);
      let previousItems: GtplRepeatItem<GtkActor>[] = [];
      let previousEmpty: GtkActor | undefined;
      try {
        scope.add(effect(() => {
          const nextState = state.get();
          const retained = new Set(previousItems.map((item) => item.node));
          if (previousEmpty) retained.add(previousEmpty);

          try {
            const oldByKey = new Map(previousItems.map((item) => [item.key, item]));
            const nextItems = nextState.items.map((item) => {
              const previous = oldByKey.get(item.key);
              if (!previous) return item;
              oldByKey.delete(item.key);
              disposeWidget(item.node);
              return { ...item, node: previous.node };
            });

            for (const item of previousItems) removeChild(box, item.node);
            if (previousEmpty) removeChild(box, previousEmpty);
            for (const previous of oldByKey.values()) disposeWidget(previous.node);
            if (previousEmpty) disposeWidget(previousEmpty);

            const nextChildren = nextItems.length
              ? nextItems.map((item) => item.node)
              : nextState.empty ? [nextState.empty] : [];
            for (const child of nextChildren) addChild(box, child);

            children.set(box, nextChildren);
            previousItems = nextItems;
            previousEmpty = nextState.empty;
          } catch (error) {
            const nextChildren = [
              ...nextState.items.map((item) => item.node),
              ...(nextState.empty ? [nextState.empty] : []),
            ];
            children.set(box, [
              ...new Set([
                ...previousItems.map((item) => item.node),
                ...(previousEmpty ? [previousEmpty] : []),
                ...nextChildren,
              ]),
            ].filter((child) => !disposed.has(child)));
            for (const child of nextChildren) {
              if (!retained.has(child)) disposeWidget(child);
            }
            throw error;
          }
        }));
        return box;
      } catch (error) {
        disposeWidget(box);
        throw error;
      }
    },
    conditional(condition, render, fallback) {
      return makeDynamicBox((box, scope) => {
        let current: GtkActor | undefined;
        scope.add(effect(() => {
          const value = condition.get();
          const next = value ? render(value) : fallback();
          try {
            if (current) {
              removeChild(box, current);
              disposeWidget(current);
            }
            addChild(box, next);
            children.set(box, [next]);
            current = next;
          } catch (error) {
            children.set(box, [current, next].filter((child): child is GtkActor => !!child && !disposed.has(child)));
            if (next !== current) disposeWidget(next);
            throw error;
          }
        }));
      });
    },
    switch(value, cases, renderDefault) {
      return makeDynamicBox((box, scope) => {
        let current: GtkActor | undefined;
        scope.add(effect(() => {
          const selected = cases.find((branch) => branch.values.some((candidate) => Object.is(candidate, value.get())));
          const next = selected?.render() ?? renderDefault?.() ?? makeBox(Gtk, options);
          try {
            if (current) {
              removeChild(box, current);
              disposeWidget(current);
            }
            addChild(box, next);
            children.set(box, [next]);
            current = next;
          } catch (error) {
            children.set(box, [current, next].filter((child): child is GtkActor => !!child && !disposed.has(child)));
            if (next !== current) disposeWidget(next);
            throw error;
          }
        }));
      });
    },
    destroy: disposeWidget,
  };
}
