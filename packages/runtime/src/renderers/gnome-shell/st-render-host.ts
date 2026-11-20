import { isGtplBinding, type GtplBinding, type GtplRenderHost, type GtplRepeatItem } from '../../rendering/gtpl-runtime.js';
import { effect } from '../../reactivity/signal.js';
import { ResourceScope } from '../../resources/resource-scope.js';

export interface StActor {
  add_child?(child: StActor): void;
  set_child?(child: StActor | null): void;
  set_property(name: string, value: unknown): void;
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
}

export interface StRenderHostOptions {
  readonly components?: Readonly<Record<string, StWidgetConstructor>>;
  /** Optional Clutter.Orientation value for fragment and repeat containers. */
  readonly fragmentOrientation?: unknown;
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
    StLabel: St.Label,
    StIcon: St.Icon,
    StButton: St.Button,
    StBin: St.Bin,
    StWidget: St.Widget,
    ...options.components,
  };
  const destroyed = new WeakSet<StActor>();

  const makeContainer = (children: readonly StActor[]): StActor => {
    const properties = options.fragmentOrientation === undefined
      ? {}
      : { orientation: options.fragmentOrientation };
    const actor = new St.BoxLayout(properties);
    appendChildren(actor, children);
    return actor;
  };

  return {
    element(name, attributes, children) {
      const Constructor = constructors[name];
      if (!Constructor) throw new Error(`Unknown GNOME Shell component "${name}". Register a St widget constructor.`);
      const properties: Record<string, unknown> = {};
      const events: Array<[string, (...args: unknown[]) => unknown]> = [];
      const bindings: Array<[string, GtplBinding<unknown>]> = [];
      for (const [attribute, value] of Object.entries(attributes)) {
        if (isGtplBinding(value)) bindings.push([propertyName(attribute), value]);
        else if (typeof value === 'function') events.push([attribute, value as (...args: unknown[]) => unknown]);
        else properties[propertyName(attribute)] = value;
      }

      const actor = new Constructor(properties);
      const resources = new ResourceScope();
      actor.connect('destroy', () => resources.dispose());
      try {
        for (const [signal, handler] of events) {
          const id = actor.connect(signal, (_source, ...args) => {
            const event = args.length <= 1 ? args[0] : args;
            return handler(event);
          });
          resources.add(() => actor.disconnect(id));
        }
        for (const [property, binding] of bindings) {
          resources.add(effect(() => actor.set_property(property, binding.get())));
        }
        appendChildren(actor, [children]);
        return actor;
      } catch (error) {
        actor.destroy();
        throw error;
      }
    },
    text(value) {
      if (!isGtplBinding(value)) return new St.Label({ text: value });
      const actor = new St.Label({ text: value.get() });
      const resources = new ResourceScope();
      actor.connect('destroy', () => resources.dispose());
      resources.add(effect(() => actor.set_property('text', value.get())));
      return actor;
    },
    fragment(children) {
      return makeContainer(children);
    },
    repeat(items: readonly GtplRepeatItem<StActor>[]) {
      return makeContainer(items.map((item) => item.node));
    },
    destroy(actor) {
      if (destroyed.has(actor)) return;
      destroyed.add(actor);
      actor.destroy();
    },
  };
}
