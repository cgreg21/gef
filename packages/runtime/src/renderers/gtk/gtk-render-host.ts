import { isGtplBinding, type GtplBinding, type GtplRenderHost, type GtplRepeatItem, type GtplRepeatState } from '../../rendering/gtpl-runtime.js';
import { effect } from '../../reactivity/signal.js';
import { ResourceScope } from '../../resources/resource-scope.js';

export interface GtkActor {
  append?(child: GtkActor): void;
  add?(child: GtkActor): void;
  add_suffix?(child: GtkActor): void;
  remove_suffix?(child: GtkActor): void;
  remove?(child: GtkActor): void;
  set_child?(child: GtkActor | null): void;
  set_property(name: string, value: unknown): void;
  get_property?(name: string): unknown;
  connect(signal: string, callback: (actor: GtkActor, ...args: unknown[]) => unknown): number;
  disconnect(id: number): void;
  get_parent?(): GtkActor | null;
  add_css_class?(name: string): void;
  remove_css_class?(name: string): void;
}

export type GtkWidgetConstructor = new (properties?: Record<string, unknown>) => GtkActor;

export interface GtkNamespace {
  readonly Box: GtkWidgetConstructor;
  readonly Label: GtkWidgetConstructor;
  readonly Button: GtkWidgetConstructor;
  readonly Entry: GtkWidgetConstructor;
  readonly Image: GtkWidgetConstructor;
  readonly ScrolledWindow: GtkWidgetConstructor;
  readonly Switch?: GtkWidgetConstructor;
  readonly CheckButton?: GtkWidgetConstructor;
  readonly DropDown?: GtkWidgetConstructor;
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
}

function twoWayProperty(event: string): string | undefined {
  return event.endsWith('Change') && event.length > 6 ? event.slice(0, -6) : undefined;
}

function notifySignal(property: string): string {
  return `notify::${property.replace(/([A-Z])/g, '-$1').replace(/_/g, '-').toLowerCase()}`;
}

function readProperty(actor: GtkActor, property: string): unknown {
  const target = actor as unknown as Record<string, unknown>;
  if (property in target) return target[property];
  return target[propertyName(property)];
}

function propertyName(name: string): string {
  if (name === 'class' || name === 'className') return 'css_classes';
  return name
    .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    .replace(/^_/, '');
}

function classNames(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return [];
}

function addChild(parent: GtkActor, child: GtkActor): void {
  if (typeof parent.set_child === 'function') parent.set_child(child);
  else if (typeof parent.append === 'function') parent.append(child);
  else if (typeof parent.add_suffix === 'function') parent.add_suffix(child);
  else if (typeof parent.add === 'function') parent.add(child);
  else throw new Error('This GTK widget cannot contain child widgets.');
}

function removeChild(parent: GtkActor, child: GtkActor): void {
  if (typeof parent.remove_suffix === 'function') parent.remove_suffix(child);
  else if (typeof parent.remove === 'function') parent.remove(child);
  else if (typeof parent.set_child === 'function') parent.set_child(null);
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

  const own = (actor: GtkActor, scope: ResourceScope): void => {
    resources.set(actor, scope);
    // GTK4 widgets do not expose GTK3's destroy signal; explicit view disposal owns cleanup.
  };

  const disposeWidget = (actor: GtkActor): void => {
    if (disposed.has(actor)) return;
    disposed.add(actor);
    for (const child of children.get(actor) ?? []) disposeWidget(child);
    resources.get(actor)?.dispose();
    const parent = actor.get_parent?.();
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
    setProperty: (actor, property, value) => actor.set_property(propertyName(property), value),
    listen: (actor, event, handler) => {
      const id = actor.connect(event, (_source, ...args) => handler(...args));
      return () => actor.disconnect(id);
    },
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
      const classBindings: GtplBinding<unknown>[] = [];
      for (const [attribute, value] of Object.entries(attributes)) {
        if (attribute === 'class' || attribute === 'className') {
          if (isGtplBinding(value)) classBindings.push(value);
          else classes.push(...classNames(value));
        } else if (isGtplBinding(value)) bindings.push([propertyName(attribute), value]);
        else if (typeof value === 'function') events.push([attribute, value as (...args: unknown[]) => unknown]);
        else properties[propertyName(attribute)] = value;
      }

      const actor = new Constructor(properties);
      const scope = new ResourceScope();
      own(actor, scope);
      try {
        for (const name of classes) actor.add_css_class?.(name);
        for (const [signal, handler] of events) {
          const property = twoWayProperty(signal);
          const id = actor.connect(property ? notifySignal(property) : signal, (_source, ...args) =>
            property ? handler(readProperty(actor, property)) : handler(args.length <= 1 ? args[0] : args));
          scope.add(() => actor.disconnect(id));
        }
        for (const [property, binding] of bindings) {
          scope.add(effect(() => actor.set_property(property, binding.get())));
        }
        for (const binding of classBindings) {
          let previousDynamicClasses: string[] = [];
          scope.add(effect(() => {
            const nextClasses = classNames(binding.get());
            for (const name of previousDynamicClasses) if (!nextClasses.includes(name)) actor.remove_css_class?.(name);
            for (const name of nextClasses) if (!previousDynamicClasses.includes(name)) actor.add_css_class?.(name);
            previousDynamicClasses = nextClasses;
          }));
        }
        if (child) {
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
      if (isGtplBinding(value)) scope.add(effect(() => actor.set_property('label', value.get())));
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
