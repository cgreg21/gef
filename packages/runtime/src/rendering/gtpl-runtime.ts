import { PipeRegistry } from '../pipes/pipe-registry.js';
import { ResourceScope } from '../resources/resource-scope.js';
import { Injector } from '../di/injector.js';
import { mountDirective } from '../directives/directive-ref.js';
import { DirectiveRegistry } from '../directives/directive-registry.js';
import { mountComponent } from '../components/component-ref.js';
import { ComponentRegistry } from '../components/component-registry.js';
import { signal, type Signal } from '../reactivity/signal.js';

export interface GtplRepeatItem<Node> {
  readonly key: unknown;
  readonly index: number;
  readonly value?: unknown;
  readonly node?: Node;
  readonly render?: () => Node;
  readonly update?: (value: unknown, index: number, count: number) => void;
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
  /** Applies component-host class/style attributes to its single native root node. */
  setHostAttributes?(node: Node, attributes: Readonly<Record<string, unknown>>): void;
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
    renderItem: (item: T, index: number, count: number, registerUpdate: (update: (item: T, index: number, count: number) => void) => void) => Node,
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
  onNodeCreated?: (node: Node) => void,
): GtplRenderRuntime<Node> {
  const track = (node: Node): Node => {
    createdNodes?.push(node);
    onNodeCreated?.(node);
    return node;
  };
  const activeContexts: Signal<number>[] = [];
  const captureContexts = (): Signal<number>[] => [...activeContexts];
  const withContexts = <T>(contexts: readonly Signal<number>[], callback: () => T): T => {
    activeContexts.push(...contexts);
    try { return callback(); }
    finally { activeContexts.length -= contexts.length; }
  };
  const bind = <T>(get: () => T): GtplBinding<T> => {
    const contexts = captureContexts();
    return {
      kind: 'binding',
      get: () => withContexts(contexts, () => {
        for (const context of contexts) context.get();
        return get();
      }),
    };
  };
  return {
    pipe: (name, value, ...args) => pipes.transform(name, value, ...args),
    bind,
    element: (name, attributes, children) => {
      const component = components.match(name, attributes);
      if (component) {
        const ref = mountComponent(component, injector, host, attributes);
        const hostAttributes = Object.fromEntries(Object.entries(attributes).filter(([name]) =>
          name === 'class' || name === 'className' || name === 'classBinding' || name.startsWith('class.')
          || name === 'style' || name === 'styleBinding' || name.startsWith('style.')));
        try {
          if (Object.keys(hostAttributes).length > 0) {
            if (!host.setHostAttributes) throw new Error('The renderer host does not support component host class/style attributes.');
            host.setHostAttributes(ref.view.node, hostAttributes);
          }
        } catch (error) {
          ref.destroy();
          throw error;
        }
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
      if (matches.length === 0) return track(node);
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
      return track(node);
    },
    text: (value) => track(host.text(value)),
    fragment: (children) => track(host.fragment(children)),
    if: (condition, render, fallback) => {
      const contexts = captureContexts();
      const renderBranch = (value: unknown): Node => withContexts(contexts, () => render(value as never));
      const renderFallback = (): Node => withContexts(contexts, () => fallback?.() ?? track(host.fragment([])));
      return isGtplBinding(condition)
        ? track(host.conditional(condition, renderBranch, renderFallback))
        : condition ? renderBranch(condition) : renderFallback();
    },
    for: (collection, renderItem, trackBy, renderEmpty) => {
      const contexts = captureContexts();
      const getCollection = isGtplBinding(collection) ? collection.get : () => collection;
      return track(host.repeat(bind(() => {
        const values = Array.from(withContexts(contexts, getCollection) ?? []);
        const count = values.length;
        const keys = new Set<unknown>();
        const entries = values.map((value, index) => {
          const key = withContexts(contexts, () => trackBy(value, index, count));
          if (keys.has(key)) throw new Error('Duplicate GTPL @for track key.');
          keys.add(key);
          return { key, value, index };
        });
        if (entries.length === 0) return { items: [], empty: withContexts(contexts, renderEmpty) };
        return {
          items: entries.map(({ key, value, index }) => {
            let rowRevision: Signal<number> | undefined;
            let updateRow: ((item: T, index: number, count: number) => void) | undefined;
            let currentValue = value;
            let currentIndex = index;
            let currentCount = count;
            return {
              key,
              index,
              value,
              render: () => withContexts(contexts, () => {
                const revision = signal(0);
                rowRevision = revision;
                activeContexts.push(revision);
                try {
                  return renderItem(value, index, count, (update) => { updateRow = update; });
                } finally {
                  activeContexts.pop();
                }
              }),
              update: (nextValue: unknown, nextIndex: number, nextCount: number) => {
                if (!rowRevision || (Object.is(currentValue, nextValue)
                  && currentIndex === nextIndex && currentCount === nextCount)) return;
                currentValue = nextValue as T;
                currentIndex = nextIndex;
                currentCount = nextCount;
                withContexts([...contexts, rowRevision], () => {
                  updateRow?.(currentValue as T, currentIndex, currentCount);
                  rowRevision!.update((revision) => revision + 1);
                });
              },
            };
          }),
        };
      })));
    },
    switch: (value, cases, renderDefault) => {
      const contexts = captureContexts();
      const scopedCases = cases.map((branch) => ({
        values: branch.values,
        render: () => withContexts(contexts, branch.render),
      }));
      const scopedDefault = renderDefault ? () => withContexts(contexts, renderDefault) : undefined;
      const render = (current: unknown): Node => {
        for (const branch of scopedCases) {
          if (branch.values.some((candidate) => Object.is(candidate, current))) return branch.render();
        }
        return scopedDefault?.() ?? track(host.fragment([]));
      };
      return isGtplBinding(value)
        ? track(host.switch(value, scopedCases, scopedDefault))
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
  let createdNodes: Node[] | undefined = [];
  let node: Node;
  try {
    node = render(context, createGtplRenderRuntime(
      host, pipes, directives, ownedInjector, components, undefined,
      (created) => createdNodes?.push(created),
    ));
  } catch (error) {
    const failedNodes = createdNodes ?? [];
    createdNodes = undefined;
    for (const created of failedNodes) {
      try { host.destroy(created); } catch { /* Preserve the render failure. */ }
    }
    if (!injector) {
      try { ownedInjector.destroy(); } catch { /* Preserve the render failure. */ }
    }
    throw error;
  }
  // Only initial rendering needs rollback tracking; dynamic updates are host-owned.
  createdNodes = undefined;
  const resources = new ResourceScope();
  if (!injector) resources.add(() => ownedInjector.destroy());
  resources.add(() => host.destroy(node));
  return { node, dispose: () => resources.dispose() };
}
