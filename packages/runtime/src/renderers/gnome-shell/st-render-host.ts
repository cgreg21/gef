import { isGtplBinding, type GtplBinding, type GtplRenderHost, type GtplRepeatItem, type GtplRepeatState } from '../../rendering/gtpl-runtime.js';
import { effect } from '../../reactivity/signal.js';
import { ResourceScope } from '../../resources/resource-scope.js';
import { classNames, mergeStyleDeclarations, styleDeclarations, styleText } from '../gtpl-bindings.js';

export interface StActor {
  add_child?(child: StActor): void;
  remove_child?(child: StActor): void;
  set_child?(child: StActor | null): void;
  set_property(name: string, value: unknown): void;
  set_style?(style: string): void;
  get_property?(name: string): unknown;
  get_layout_manager?(): { set_homogeneous?(value: boolean): void };
  connect(signal: string, callback: (actor: StActor, ...args: unknown[]) => unknown): number;
  disconnect(id: number): void;
  destroy(): void;
}

export type StWidgetConstructor = new (properties?: Record<string, unknown>) => StActor;

export interface StNamespace {
  readonly BoxLayout: StWidgetConstructor;
  readonly Label: StWidgetConstructor;
  readonly Icon: StWidgetConstructor;
  readonly Button: StWidgetConstructor;
  readonly Bin: StWidgetConstructor;
  readonly Widget: StWidgetConstructor;
  readonly Entry?: StWidgetConstructor;
  readonly PasswordEntry?: StWidgetConstructor;
  readonly ScrollView?: StWidgetConstructor;
  readonly Viewport?: StWidgetConstructor;
  readonly Frame?: StWidgetConstructor;
  readonly Switch?: StWidgetConstructor;
  readonly Slider?: StWidgetConstructor;
  readonly Spinner?: StWidgetConstructor;
  readonly ProgressBar?: StWidgetConstructor;
  readonly CheckBox?: StWidgetConstructor;
  readonly ComboBox?: StWidgetConstructor;
}

export interface StPopupMenu {
  readonly actor: StActor;
  addMenuItem(item: StActor): void;
  removeAll?(): void;
  open(options?: { animate?: boolean }): void;
  close(options?: { animate?: boolean }): void;
}

export interface StPopupMenuManager {
  addMenu(menu: StPopupMenu): void;
  removeMenu?(menu: StPopupMenu): void;
}

export interface StPopupMenuNamespace {
  readonly PopupMenu: new (source: StActor, alignment: number, side: number) => StPopupMenu;
  readonly PopupMenuItem: new (label: string) => StActor;
  readonly PopupMenuManager: new (source: StActor) => StPopupMenuManager;
  readonly uiGroup: StActor;
  readonly sideTop: number;
}

export interface StClutterNamespace {
  readonly Text: StWidgetConstructor;
}

export interface StRenderHostOptions {
  readonly components?: Readonly<Record<string, StWidgetConstructor>>;
  readonly popupMenu?: StPopupMenuNamespace;
  readonly clutter?: StClutterNamespace;
  /** Optional Clutter.Orientation value for fragment and repeat containers. */
  readonly fragmentOrientation?: unknown;
}

function twoWayProperty(event: string): string | undefined {
  return event.endsWith('Change') && event.length > 6 ? event.slice(0, -6) : undefined;
}

function notifySignal(property: string): string {
  return `notify::${property.replace(/([A-Z])/g, '-$1').replace(/_/g, '-').toLowerCase()}`;
}

function booleanValue(attribute: string, value: unknown): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${attribute} must be "true" or "false".`);
}

function alignValue(value: unknown): number {
  const alignments: Record<string, number> = { fill: 0, start: 1, center: 2, end: 3 };
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
  if (name !== 'Flex' || !['direction', 'gap', 'homogeneous'].includes(attribute)) return [attribute, value];
  const property = attribute === 'direction' ? 'orientation' : attribute === 'gap' ? 'spacing' : 'homogeneous';
  if (isGtplBinding(value)) {
    return [property, { kind: 'binding', get: () => flexValue(attribute, value.get()) } satisfies GtplBinding<unknown>];
  }
  return [property, flexValue(attribute, value)];
}

function setFlexHomogeneous(actor: StActor, value: boolean): void {
  const layout = actor.get_layout_manager?.();
  if (!layout?.set_homogeneous) throw new Error('This St Flex widget does not support homogeneous sizing.');
  layout.set_homogeneous(value);
}

function readProperty(actor: StActor, property: string): unknown {
  const target = actor as unknown as Record<string, unknown>;
  if (property in target) return target[property];
  const name = propertyName(property);
  return target[name] ?? actor.get_property?.(name);
}

function propertyName(name: string): string {
  if (name === 'class' || name === 'className') return 'style_class';
  return name
    .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    .replace(/^_/, '');
}

function appendChildren(parent: StActor, children: readonly StActor[]): void {
  if (typeof parent.set_child === 'function') {
    if (children.length > 1) throw new Error('This St container accepts only one child.');
    parent.set_child(children[0] ?? null);
    return;
  }
  if (typeof parent.add_child !== 'function' && children.length > 0) {
    throw new Error('This St widget cannot contain child actors.');
  }
  for (const child of children) parent.add_child?.(child);
}

/** Creates a native GNOME Shell 51 St host without importing GI modules itself. */
export function createStRenderHost(
  St: StNamespace,
  options: StRenderHostOptions = {},
): GtplRenderHost<StActor> {
  const constructors: Readonly<Record<string, StWidgetConstructor>> = {
    StBox: St.BoxLayout,
    StBoxLayout: St.BoxLayout,
    Flex: St.BoxLayout,
    Grid: St.BoxLayout,
    HeaderBar: St.BoxLayout,
    Sidebar: St.BoxLayout,
    StLabel: St.Label,
    StIcon: St.Icon,
    StButton: St.Button,
    StBin: St.Bin,
    StWidget: St.Widget,
    ...(St.Entry ? { StEntry: St.Entry } : {}),
    ...(St.PasswordEntry ? { StPasswordEntry: St.PasswordEntry } : {}),
    ...(St.ScrollView ? { StScrollView: St.ScrollView } : {}),
    ...(St.Viewport ? { StViewport: St.Viewport } : {}),
    ...(St.Frame ? { StFrame: St.Frame } : {}),
    ...(St.Switch ? { StSwitch: St.Switch } : {}),
    ...(St.Slider ? { StSlider: St.Slider } : {}),
    ...(St.Spinner ? { StSpinner: St.Spinner } : {}),
    ...(St.ProgressBar ? { StProgressBar: St.ProgressBar } : {}),
    ...(St.CheckBox ? { StCheckBox: St.CheckBox } : {}),
    ...(St.ComboBox ? { StComboBox: St.ComboBox } : {}),
    ...options.components,
  };
  const destroyed = new WeakSet<StActor>();
  const actorResources = new WeakMap<StActor, ResourceScope>();
  const fragmentChildren = new WeakMap<StActor, readonly StActor[]>();
  const destroyActor = (actor: StActor): void => {
    if (destroyed.has(actor)) return;
    destroyed.add(actor);
    actor.destroy();
  };

  const makeContainer = (children: readonly StActor[]): StActor => {
    const properties = options.fragmentOrientation === undefined
      ? {}
      : { orientation: options.fragmentOrientation };
    const actor = new St.BoxLayout(properties);
    actor.connect('destroy', () => destroyed.add(actor));
    try {
      appendChildren(actor, children);
      return actor;
    } catch (error) {
      for (const child of children) destroyActor(child);
      destroyActor(actor);
      throw error;
    }
  };

  return {
    setProperty: (actor, property, value) => actor.set_property(propertyName(property), value),
    setHostAttributes(actor, attributes) {
      const scope = actorResources.get(actor);
      if (!scope) throw new Error('Component host attributes require a single managed GNOME Shell root actor.');
      const classes = classNames(attributes.class ?? attributes.className);
      const classBindings: Array<{ name?: string; binding: GtplBinding<unknown> }> = [];
      for (const [name, value] of Object.entries(attributes)) {
        if (name === 'classBinding') {
          if (isGtplBinding(value)) classBindings.push({ binding: value });
          else classes.push(...classNames(value));
        } else if (name.startsWith('class.')) {
          if (isGtplBinding(value)) classBindings.push({ name: name.slice(6), binding: value });
          else if (value) classes.push(name.slice(6));
        }
      }
      const activeClasses = new Set<string>();
      const syncClasses = (): void => {
        const next = new Set(classes);
        for (const item of classBindings) {
          const value = item.binding.get();
          for (const name of (item.name ? (value ? [item.name] : []) : classNames(value))) next.add(name);
        }
        for (const name of activeClasses) if (!next.has(name)) actor.set_property('style_class', classNames(readProperty(actor, 'style-class') ?? '').filter((item) => item !== name).join(' '));
        for (const name of next) if (!activeClasses.has(name)) {
          const current = classNames(readProperty(actor, 'style-class') ?? '');
          if (!current.includes(name)) current.push(name);
          actor.set_property('style_class', current.join(' '));
        }
        activeClasses.clear();
        for (const name of next) activeClasses.add(name);
      };
      if (classBindings.length > 0) scope.add(effect(syncClasses));
      else syncClasses();

      const styleValue = attributes.style;
      const styleBindingValue = attributes.styleBinding;
      const styleBindings: Array<{ name: string; unit?: string | undefined; binding: GtplBinding<unknown> }> = [];
      for (const [attribute, value] of Object.entries(attributes)) {
        if (!attribute.startsWith('style.')) continue;
        const parts = attribute.slice(6).split('.');
        const unit = parts.length > 1 ? parts.pop() : undefined;
        const name = (parts[0] ?? '').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        if (!name) throw new Error('GTPL style binding requires a CSS property name.');
        if (isGtplBinding(value)) styleBindings.push({ name, unit, binding: value });
        else if (value !== null && value !== undefined) styleBindings.push({ name, unit, binding: { kind: 'binding', get: () => value } });
      }
      if (styleValue !== undefined || styleBindingValue !== undefined || styleBindings.length > 0) {
        if (!actor.set_style) throw new Error('This GNOME Shell component root does not support inline styles.');
        let previousCss: string | undefined;
        const syncStyle = (): void => {
          const declarations = styleDeclarations(isGtplBinding(styleValue) ? styleValue.get() : styleValue);
          mergeStyleDeclarations(declarations, isGtplBinding(styleBindingValue) ? styleBindingValue.get() : styleBindingValue);
          for (const item of styleBindings) {
            const value = item.binding.get();
            if (value === null || value === undefined) declarations.delete(item.name);
            else declarations.set(item.name, `${value}${item.unit ?? ''}`);
          }
          const css = styleText(declarations);
          if (/[{}]/.test(css)) throw new Error('GTPL style must contain CSS declarations only (without braces).');
          if (css === previousCss) return;
          actor.set_style!(css);
          previousCss = css;
        };
        const hasReactiveStyle = [styleValue, styleBindingValue, ...styleBindings.map((item) => item.binding)]
          .some(isGtplBinding);
        if (hasReactiveStyle) scope.add(effect(syncStyle));
        else syncStyle();
      }
    },
    listen: (actor, event, handler) => {
      const id = actor.connect(event, (_source, ...args) => handler(...args));
      return () => actor.disconnect(id);
    },
    onDestroy: (actor, callback) => {
      actor.connect('destroy', () => {
        destroyed.add(actor);
        callback();
      });
    },
    element(name, attributes, children) {
      const Constructor = name === 'StSelect' ? St.Button : name === 'StTextArea' ? St.ScrollView : constructors[name];
      if (!Constructor) throw new Error(`Unknown GNOME Shell component "${name}". Register a St widget constructor.`);
      const properties: Record<string, unknown> = {};
      const events: Array<[string, (...args: unknown[]) => unknown]> = [];
      const bindings: Array<[string, GtplBinding<unknown>]> = [];
      let styleValue: unknown;
      let styleBindingValue: unknown;
      const classes: string[] = [];
      const classBindings: Array<{ name?: string; binding: GtplBinding<unknown> }> = [];
      const styleBindings: Array<{ name: string; unit?: string | undefined; binding: GtplBinding<unknown> }> = [];
      let flexHomogeneous: boolean | undefined;
      let gridColumns = 2;
      let gridGap = 0;
      const selectOptions = name === 'StSelect' ? attributes.options : undefined;
      const selectValue = name === 'StSelect' ? attributes.value : undefined;
      const selectChange = name === 'StSelect' ? attributes.valueChange : undefined;
      const textValue = name === 'StTextArea' ? attributes.text : undefined;
      const textChange = name === 'StTextArea' ? attributes.textChange : undefined;
      const passwordValue = name === 'StPasswordEntry' ? attributes.text : undefined;
      const passwordChange = name === 'StPasswordEntry' ? attributes.textChange : undefined;
      for (const [attribute, value] of Object.entries(attributes)) {
        if (attribute === 'grow') {
          throw new Error('GTPL grow weights are not supported by native widgets; use expand="true" for boolean expansion.');
        }
        if (name === 'Flex' && attribute === 'wrap') {
          throw new Error('GTPL Flex wrap is not supported by native box widgets; use Grid or the FlexLayout calculator.');
        }
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
        if (name === 'StSelect' && ['options', 'value', 'valueChange'].includes(attribute)) continue;
        if (name === 'StTextArea' && ['text', 'textChange'].includes(attribute)) continue;
        if (name === 'StPasswordEntry' && ['text', 'textChange'].includes(attribute)) continue;
        if (name === 'Grid' && attribute === 'columns') {
          gridColumns = typeof value === 'number' ? value : Number(value);
          if (!Number.isInteger(gridColumns) || gridColumns < 1) throw new Error('Grid columns must be a positive integer.');
          continue;
        }
        if (name === 'Grid' && attribute === 'gap') {
          gridGap = typeof value === 'number' ? value : Number(value);
          if (!Number.isFinite(gridGap) || gridGap < 0) throw new Error('Grid gap must be a non-negative number.');
          continue;
        }
        if (name === 'Flex' && attribute === 'homogeneous') {
          if (isGtplBinding(value)) bindings.push(['homogeneous', {
            kind: 'binding',
            get: () => flexValue(attribute, value.get()),
          } satisfies GtplBinding<unknown>]);
          else flexHomogeneous = flexValue(attribute, value) as boolean;
          continue;
        }
        if (name === 'Flex' && attribute === 'align') {
          for (const property of ['x_align', 'y_align']) {
            if (isGtplBinding(value)) bindings.push([property, {
              kind: 'binding', get: () => alignValue(value.get()),
            } satisfies GtplBinding<unknown>]);
            else properties[property] = alignValue(value);
          }
          continue;
        }
        if (attribute === 'expand') {
          for (const property of ['x_expand', 'y_expand']) {
            if (isGtplBinding(value)) bindings.push([property, {
              kind: 'binding', get: () => booleanValue('expand', value.get()),
            } satisfies GtplBinding<unknown>]);
            else properties[property] = booleanValue('expand', value);
          }
          continue;
        }
        const [property, normalized] = layoutAttribute(name, attribute, value);
        if (isGtplBinding(normalized)) bindings.push([propertyName(property), normalized]);
        else if (typeof normalized === 'function') events.push([property, normalized as (...args: unknown[]) => unknown]);
        else properties[propertyName(property)] = normalized;
      }

      if (name === 'Flex') properties.orientation ??= 0;
      if (name === 'Grid') { properties.orientation = 1; properties.spacing = gridGap; }
      if (name === 'HeaderBar') properties.orientation ??= 0;
      if (name === 'Sidebar') properties.orientation ??= 1;
      if (name === 'StSelect' && !options.popupMenu) throw new Error('StSelect requires GNOME Shell PopupMenu and Main.uiGroup dependencies.');
      if (name === 'StTextArea' && (!St.ScrollView || !St.Viewport || !options.clutter?.Text)) {
        throw new Error('StTextArea requires St.ScrollView, St.Viewport and Clutter.Text for native multiline editing.');
      }
      const actor = new Constructor(properties);
      const resources = new ResourceScope();
      actorResources.set(actor, resources);
      actor.connect('destroy', () => { destroyed.add(actor); resources.dispose(); });
      try {
        if (styleValue !== undefined || styleBindingValue !== undefined || styleBindings.length) {
          if (!actor.set_style) throw new Error('This St widget does not support inline styles.');
          let previousCss: string | undefined;
          const syncStyle = (): void => {
            const declarations = styleDeclarations(isGtplBinding(styleValue) ? styleValue.get() : styleValue);
            const boundStyles = isGtplBinding(styleBindingValue) ? styleBindingValue.get() : styleBindingValue;
            mergeStyleDeclarations(declarations, boundStyles);
            for (const item of styleBindings) {
              const value = item.binding.get();
              if (value === null || value === undefined) declarations.delete(item.name);
              else declarations.set(item.name, `${value}${item.unit ?? ''}`);
            }
            const css = styleText(declarations);
            if (/[{}]/.test(css)) throw new Error('GTPL style must contain CSS declarations only (without braces).');
            if (css === previousCss) return;
            actor.set_style!(css);
            previousCss = css;
          };
        const hasReactiveStyle = Object.entries(attributes).some(([name, value]) =>
          (name === 'style' || name === 'styleBinding' || name.startsWith('style.')) && isGtplBinding(value));
        if (hasReactiveStyle) resources.add(effect(syncStyle));
        else syncStyle();
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
          for (const name of activeClasses) if (!next.has(name)) actor.set_property('style_class', classNames(readProperty(actor, 'style-class') ?? '').filter((item) => item !== name).join(' '));
          for (const name of next) if (!activeClasses.has(name)) {
            const current = classNames(readProperty(actor, 'style-class') ?? '');
            if (!current.includes(name)) current.push(name);
            actor.set_property('style_class', current.join(' '));
          }
          activeClasses.clear();
          for (const name of next) activeClasses.add(name);
        };
        if (classBindings.length > 0) resources.add(effect(syncClasses));
        else syncClasses();
        if (name === 'StPasswordEntry') {
          const textActor = (actor as StActor & { get_clutter_text?: () => StActor }).get_clutter_text?.()
            ?? readProperty(actor, 'clutter-text') as StActor | undefined;
          if (!textActor) throw new Error('StPasswordEntry requires its native Clutter.Text actor.');
          let updating = false;
          const readText = (): string => {
            const value = readProperty(actor, 'text');
            return typeof value === 'string' ? value : '';
          };
          const syncText = (): void => {
            const value = isGtplBinding(passwordValue) ? passwordValue.get() : passwordValue ?? '';
            if (typeof value !== 'string') throw new Error('StPasswordEntry text must be a string.');
            updating = true;
            try { actor.set_property('text', value); }
            finally { updating = false; }
          };
          if (isGtplBinding(passwordValue)) resources.add(effect(syncText));
          else syncText();
          if (typeof passwordChange === 'function') {
            const changed = textActor.connect('text-changed', () => {
              if (!updating) passwordChange(readText());
            });
            resources.add(() => textActor.disconnect(changed));
          }
        }
        if (name === 'StTextArea') {
          if (!actor.set_child) throw new Error('StTextArea requires St.ScrollView child management.');
          const viewport = new St.Viewport!({ x_expand: true, y_expand: true });
          const textActor = new options.clutter!.Text({
            editable: true,
            activatable: false,
            single_line_mode: false,
            line_wrap: true,
            reactive: true,
            text: typeof textValue === 'string' ? textValue : '',
          });
          if (!viewport.add_child) throw new Error('StTextArea requires St.Viewport child management.');
          viewport.add_child(textActor);
          actor.set_child(viewport);
          let updating = false;
          const readText = (): string => {
            const value = readProperty(textActor, 'text');
            return typeof value === 'string' ? value : '';
          };
          const syncText = (): void => {
            const value = isGtplBinding(textValue) ? textValue.get() : textValue ?? '';
            if (typeof value !== 'string') throw new Error('StTextArea text must be a string.');
            updating = true;
            try { textActor.set_property('text', value); }
            finally { updating = false; }
          };
          if (isGtplBinding(textValue)) resources.add(effect(syncText));
          else syncText();
          if (typeof textChange === 'function') {
            const changed = textActor.connect('text-changed', () => {
              if (!updating) textChange(readText());
            });
            resources.add(() => textActor.disconnect(changed));
          }
        }
        if (name === 'StSelect') {
          const popup = options.popupMenu!;
          const menu = new popup.PopupMenu(actor, 0.0, popup.sideTop);
          const manager = new popup.PopupMenuManager(actor);
          if (!actor.add_child || !popup.uiGroup.add_child || !popup.uiGroup.remove_child) {
            throw new Error('StSelect requires St actor child management and Main.uiGroup attachment.');
          }
          popup.uiGroup.add_child(menu.actor);
          manager.addMenu(menu);
          const readOptions = (): string[] => {
            const value = isGtplBinding(selectOptions) ? selectOptions.get() : selectOptions;
            if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('StSelect options must be an array of strings.');
            return value;
          };
          let menuItemCleanups: Array<() => void> = [];
          const syncValue = (): void => {
            const value = isGtplBinding(selectValue) ? selectValue.get() : selectValue;
            actor.set_property('label', typeof value === 'string' ? value : '');
          };
          const rebuildMenu = (): void => {
            for (const cleanup of menuItemCleanups) cleanup();
            menuItemCleanups = [];
            if (!menu.removeAll) throw new Error('The GNOME Shell PopupMenu implementation must support removeAll().');
            menu.removeAll();
            for (const option of readOptions()) {
              const item = new popup.PopupMenuItem(option);
              const id = item.connect('activate', () => {
                actor.set_property('label', option);
                menu.close({ animate: false });
                if (typeof selectChange === 'function') selectChange(option);
              });
              menuItemCleanups.push(() => item.disconnect(id));
              menu.addMenuItem(item);
            }
            syncValue();
          };
          if (isGtplBinding(selectOptions)) resources.add(effect(rebuildMenu));
          else rebuildMenu();
          if (isGtplBinding(selectValue)) resources.add(effect(syncValue));
          const clicked = actor.connect('clicked', () => menu.open());
          resources.add(() => actor.disconnect(clicked));
          resources.add(() => {
            for (const cleanup of menuItemCleanups) cleanup();
            menuItemCleanups = [];
            menu.close({ animate: false });
            manager.removeMenu?.(menu);
            popup.uiGroup.remove_child!(menu.actor);
            menu.actor.destroy();
          });
        }
        for (const [signal, handler] of events) {
          const property = twoWayProperty(signal);
          const id = actor.connect(property ? notifySignal(property) : signal, (_source, ...args) => {
            if (property) return handler(readProperty(actor, property));
            const event = args.length <= 1 ? args[0] : args;
            return handler(event);
          });
          resources.add(() => actor.disconnect(id));
        }
        if (flexHomogeneous !== undefined) setFlexHomogeneous(actor, flexHomogeneous);
        for (const [property, binding] of bindings) {
          let previous: unknown;
          let initialized = false;
          resources.add(effect(() => {
            const value = binding.get();
            if (initialized && Object.is(value, previous)) return;
            initialized = true;
            previous = value;
            if (name === 'Flex' && property === 'homogeneous') {
              setFlexHomogeneous(actor, value as boolean);
            } else {
              actor.set_property(property, value);
            }
          }));
        }
        if (name === 'Grid') {
          const nested = children ? fragmentChildren.get(children) : undefined;
          const nodes = children ? (nested ?? [children]) : [];
          if (children && nested) {
            for (const node of nodes) children.remove_child?.(node);
            fragmentChildren.delete(children);
            destroyActor(children);
          }
          for (let index = 0; index < nodes.length; index += gridColumns) {
            const row = new St.BoxLayout({ orientation: 0, spacing: gridGap });
            actor.add_child?.(row);
            appendChildren(row, nodes.slice(index, index + gridColumns));
          }
        } else if (name !== 'StTextArea') {
          appendChildren(actor, children ? [children] : []);
        }
        return actor;
      } catch (error) {
        destroyActor(actor);
        throw error;
      }
    },
    text(value) {
      if (!isGtplBinding(value)) {
        const actor = new St.Label({ text: value });
        actor.connect('destroy', () => destroyed.add(actor));
        return actor;
      }
      const actor = new St.Label({ text: value.get() });
      const resources = new ResourceScope();
      actor.connect('destroy', () => { destroyed.add(actor); resources.dispose(); });
      resources.add(effect(() => actor.set_property('text', value.get())));
      return actor;
    },
    conditional(condition, render, fallback) {
      const actor = new St.Bin({});
      const resources = new ResourceScope();
      let current: StActor | undefined;
      actor.connect('destroy', () => {
        destroyed.add(actor);
        resources.dispose();
      });
      try {
        resources.add(effect(() => {
        const value = condition.get();
        const next = value ? render(value) : fallback();
        if (current) {
          actor.set_child?.(null);
          destroyActor(current);
        }
        actor.set_child?.(next);
        current = next;
        }));
        return actor;
      } catch (error) {
        destroyActor(actor);
        throw error;
      }
    },
    switch(value, cases, renderDefault) {
      const actor = new St.Bin({});
      const resources = new ResourceScope();
      let current: StActor | undefined;
      actor.connect('destroy', () => {
        destroyed.add(actor);
        resources.dispose();
      });
      try {
        resources.add(effect(() => {
        const selected = cases.find((branch) => branch.values.some((candidate) => Object.is(candidate, value.get())));
        const next = selected?.render() ?? renderDefault?.() ?? makeContainer([]);
        if (current) {
          actor.set_child?.(null);
          destroyActor(current);
        }
        actor.set_child?.(next);
        current = next;
        }));
        return actor;
      } catch (error) {
        destroyActor(actor);
        throw error;
      }
    },
    fragment(children) {
      const actor = makeContainer(children);
      fragmentChildren.set(actor, children);
      return actor;
    },
    repeat(state: GtplBinding<GtplRepeatState<StActor>>) {
      const actor = new St.BoxLayout(options.fragmentOrientation === undefined ? {} : { orientation: options.fragmentOrientation });
      const resources = new ResourceScope();
      let previousItems: GtplRepeatItem<StActor>[] = [];
      let previousEmpty: StActor | undefined;
      actor.connect('destroy', () => { destroyed.add(actor); resources.dispose(); });
      try {
        resources.add(effect(() => {
        const nextState = state.get();
        const retained = new Set(previousItems.map((item) => item.node));
        if (previousEmpty) retained.add(previousEmpty);
        const created: StActor[] = [];
        try {
          const oldByKey = new Map(previousItems.map((item) => [item.key, item]));
          const nextItems = nextState.items.map((item) => {
            const previous = oldByKey.get(item.key);
            if (previous) {
              oldByKey.delete(item.key);
              previous.update?.(item.value, item.index, nextState.items.length);
              if (!previous.node) throw new Error('A retained GTPL @for item has no rendered node.');
              return { ...item, node: previous.node, update: previous.update };
            }
            const node = item.node ?? item.render?.();
            if (!node) throw new Error('A new GTPL @for item has no render function.');
            created.push(node);
            return { ...item, node };
          });
          const nextChildren = nextItems.length
            ? nextItems.map((item) => item.node!)
            : nextState.empty ? [nextState.empty] : [];
          const unchanged = previousItems.length === nextItems.length
            && previousItems.every((item, index) => item.node === nextItems[index]?.node);
          if (!unchanged || previousEmpty !== nextState.empty) {
            for (const item of previousItems) if (item.node) actor.remove_child?.(item.node);
            if (previousEmpty) actor.remove_child?.(previousEmpty);
            for (const previous of oldByKey.values()) if (previous.node) destroyActor(previous.node);
            if (previousEmpty && previousEmpty !== nextState.empty) destroyActor(previousEmpty);
            for (const child of nextChildren) actor.add_child?.(child);
          }
          previousItems = nextItems;
          previousEmpty = nextState.empty;
        } catch (error) {
          for (const previous of previousItems) {
            const item = nextState.items.find((candidate) => Object.is(candidate.key, previous.key));
            if (item) previous.update?.(previous.value, previous.index, previousItems.length);
          }
          for (const node of created) destroyActor(node);
          if (nextState.empty && !retained.has(nextState.empty)) destroyActor(nextState.empty);
          throw error;
        }
        }));
        return actor;
      } catch (error) {
        destroyActor(actor);
        throw error;
      }
    },
    destroy(actor) {
      destroyActor(actor);
    },
  };
}
