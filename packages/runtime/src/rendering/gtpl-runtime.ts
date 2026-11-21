import { PipeRegistry } from '../pipes/pipe-registry.js';
import { ResourceScope } from '../resources/resource-scope.js';
import { Injector } from '../di/injector.js';
import { mountDirective } from '../directives/directive-ref.js';
import { DirectiveRegistry } from '../directives/directive-registry.js';
import { mountComponent } from '../components/component-ref.js';
import { ComponentRegistry } from '../components/component-registry.js';

export interface GtplRepeatItem<Node> {
  readonly key: unknown;
  readonly index: number;
  readonly node: Node;
}

export interface GtplBinding<T> {
  readonly kind: 'binding';
  readonly get: () => T;
}

export function isGtplBinding(value: unknown): value is GtplBinding<unknown> {
  return typeof value === 'object' && value !== null
    && 'kind' in value && value.kind === 'binding'
    && 'get' in value && typeof value.get === 'function';
}

export interface GtplRepeatState<Node> {
  readonly items: readonly GtplRepeatItem<Node>[];
  readonly empty?: Node;
}

export interface GtplRenderHost<Node> {
  destroy(node: Node): void;
  setProperty?(node: Node, property: string, value: unknown): void;
  listen?(node: Node, event: string, handler: (...args: unknown[]) => unknown): () => void;
  onDestroy?(node: Node, callback: () => void): void;
  element(name: string, attributes: Readonly<Record<string, unknown>>, children: Node | undefined): Node;
  text(value: string | GtplBinding<string>): Node;
  fragment(children: readonly Node[]): Node;
  repeat(state: GtplBinding<GtplRepeatState<Node>>): Node;
  conditional<T>(condition: GtplBinding<T>, render: (value: T) => Node, fallback: () => Node): Node;
  switch(value: GtplBinding<unknown>, cases: readonly GtplSwitchCase<Node>[], renderDefault?: (() => Node) | undefined): Node;
}

export interface GtplRenderView<Node> {
  readonly node: Node;
  dispose(): void;
}

export type GtplRenderFunction<Context, Node> = (context: Context, runtime: GtplRenderRuntime<Node>) => Node;

export interface GtplSwitchCase<Node> {
  readonly values: readonly unknown[];
  readonly render: () => Node;
}

/** Runtime surface targeted by JavaScript emitted by emitGtplTemplate. */
export interface GtplRenderRuntime<Node> {
  pipe(name: string, value: unknown, ...args: unknown[]): unknown;
  bind<T>(get: () => T): GtplBinding<T>;
  element(name: string, attributes: Readonly<Record<string, unknown>>, children: Node | undefined): Node;
  text(value: string | GtplBinding<string>): Node;
  fragment(children: readonly Node[]): Node;
  if<T>(condition: T | GtplBinding<T>, render: (value: T) => Node, fallback?: () => Node): Node;
  for<T>(
    collection: Iterable<T> | GtplBinding<Iterable<T> | null | undefined> | null | undefined,
    renderItem: (item: T, index: number, count: number) => Node,
    trackBy: (item: T, index: number, count: number) => unknown,
    renderEmpty: () => Node,
  ): Node;
  switch(
    value: unknown | GtplBinding<unknown>,
    cases: readonly GtplSwitchCase<Node>[],
    renderDefault?: (() => Node) | undefined,
  ): Node;
}

/**
 * Creates the renderer-independent runtime used by generated GTPL functions.
 * A platform host owns native widget creation and keyed-list reconciliation.
 */
export function createGtplRenderRuntime<Node>(
  host: GtplRenderHost<Node>,
  pipes: PipeRegistry = new PipeRegistry(),
  directives: DirectiveRegistry<Node> = new DirectiveRegistry<Node>(),
  injector: Injector = new Injector(),
  components: ComponentRegistry<Node> = new ComponentRegistry<Node>(),
  createdNodes?: Node[],
): GtplRenderRuntime<Node> {
  const track = (node: Node): Node => { createdNodes?.push(node); return node; };
  return {
    pipe: (name, value, ...args) => pipes.transform(name, value, ...args),
    bind: (get) => ({ kind: 'binding', get }),
    element: (name, attributes, children) => {
      const component = components.match(name, attributes);
      if (component) {
        const ref = mountComponent(component, injector, host, attributes);
        for (const [output, emitter] of Object.entries(ref.outputs)) {
          const handler = attributes[output];
          if (typeof handler === 'function') {
            const subscription = emitter.subscribe(handler as (value: unknown) => void);
            ref.onDestroy(() => subscription.unsubscribe());
          }
        }
        if (!host.onDestroy) {
          ref.destroy();
          throw new Error('The renderer host does not support component lifecycle cleanup.');
        }
        host.onDestroy(ref.view.node, () => ref.destroy());
        return track(ref.view.node);
      }
      const node = host.element(name, attributes, children);
      const matches = directives.match(name, attributes);
      if (matches.length === 0) return node;
      if (!host.setProperty || !host.listen || !host.onDestroy) {
        host.destroy(node);
        throw new Error('The renderer host does not support directive host bindings and listeners.');
      }
      try {
        for (const match of matches) {
          const ref = mountDirective(match.definition, injector, {
          setProperty: host.setProperty.bind(host),
          listen: host.listen.bind(host),
          }, node, match.inputs);
          for (const [output, emitter] of Object.entries(ref.outputs)) {
            const handler = attributes[output];
            if (typeof handler === 'function') {
              const subscription = emitter.subscribe(handler as (value: unknown) => void);
              ref.onDestroy(() => subscription.unsubscribe());
            }
          }
          host.onDestroy(node, () => ref.destroy());
        }
      } catch (error) {
        host.destroy(node);
        throw error;
      }
      return node;
    },
    text: (value) => host.text(value),
    fragment: (children) => host.fragment(children),
    if: (condition, render, fallback) => {
      const renderFallback = fallback ?? (() => host.fragment([]));
      return isGtplBinding(condition)
        ? host.conditional(condition, render, renderFallback)
        : condition ? render(condition) : renderFallback();
    },
    for: (collection, renderItem, trackBy, renderEmpty) => {
      const getCollection = isGtplBinding(collection) ? collection.get : () => collection;
      return host.repeat({
        kind: 'binding',
        get: () => {
          const values = Array.from(getCollection() ?? []);
          if (values.length === 0) return { items: [], empty: renderEmpty() };
          const count = values.length;
          const keys = new Set<unknown>();
          const items: GtplRepeatItem<Node>[] = [];
          try {
            values.forEach((item, index) => {
              const key = trackBy(item, index, count);
              if (keys.has(key)) throw new Error('Duplicate GTPL @for track key.');
              keys.add(key);
              items.push({ key, index, node: renderItem(item, index, count) });
            });
            return { items };
          } catch (error) {
            for (const item of items) host.destroy(item.node);
            throw error;
          }
        },
      });
    },
    switch: (value, cases, renderDefault) => {
      const render = (current: unknown): Node => {
        for (const branch of cases) {
          if (branch.values.some((candidate) => Object.is(candidate, current))) return branch.render();
        }
        return renderDefault?.() ?? host.fragment([]);
      };
      return isGtplBinding(value)
        ? host.switch(value, cases, renderDefault)
        : render(value);
    },
  };
}

/** Renders a generated template and returns an idempotently disposable view. */
export function mountGtplTemplate<Context, Node>(
  context: Context,
  render: GtplRenderFunction<Context, Node>,
  host: GtplRenderHost<Node>,
  pipes?: PipeRegistry,
  directives?: DirectiveRegistry<Node>,
  injector?: Injector,
  components?: ComponentRegistry<Node>,
): GtplRenderView<Node> {
  const ownedInjector = injector ?? new Injector();
  const createdNodes: Node[] = [];
  let node: Node;
  try {
    node = render(context, createGtplRenderRuntime(host, pipes, directives, ownedInjector, components, createdNodes));
  } catch (error) {
    for (const created of createdNodes) {
      try { host.destroy(created); } catch { /* Preserve the render failure. */ }
    }
    if (!injector) {
      try { ownedInjector.destroy(); } catch { /* Preserve the render failure. */ }
    }
    throw error;
  }
  const resources = new ResourceScope();
  if (!injector) resources.add(() => ownedInjector.destroy());
  resources.add(() => host.destroy(node));
  return { node, dispose: () => resources.dispose() };
}
