import type { GtplRenderHost, GtplRepeatItem } from '../../rendering/gtpl-runtime.js';

export interface StActor {
  add_child?(child: StActor): void;
  set_child?(child: StActor | null): void;
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
  const signalIds = new WeakMap<StActor, number[]>();
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
      for (const [attribute, value] of Object.entries(attributes)) {
        if (typeof value === 'function') events.push([attribute, value as (...args: unknown[]) => unknown]);
        else properties[propertyName(attribute)] = value;
      }

      const actor = new Constructor(properties);
      try {
        const ids = events.map(([signal, handler]) => actor.connect(signal, (_source, ...args) => {
          const event = args.length <= 1 ? args[0] : args;
          return handler(event);
        }));
        if (ids.length > 0) signalIds.set(actor, ids);
        appendChildren(actor, [children]);
        return actor;
      } catch (error) {
        actor.destroy();
        throw error;
      }
    },
    text(value) {
      return new St.Label({ text: value });
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
      for (const id of signalIds.get(actor) ?? []) actor.disconnect(id);
      signalIds.delete(actor);
      actor.destroy();
    },
  };
}
