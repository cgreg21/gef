import { ResourceScope } from '../resources/resource-scope.js';

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
  element(name: string, attributes: Readonly<Record<string, unknown>>, children: Node): Node;
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
  bind<T>(get: () => T): GtplBinding<T>;
  element(name: string, attributes: Readonly<Record<string, unknown>>, children: Node): Node;
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
export function createGtplRenderRuntime<Node>(host: GtplRenderHost<Node>): GtplRenderRuntime<Node> {
  return {
    bind: (get) => ({ kind: 'binding', get }),
    element: (name, attributes, children) => host.element(name, attributes, children),
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
          const items = values.map((item, index) => {
            const key = trackBy(item, index, count);
            if (keys.has(key)) throw new Error('Duplicate GTPL @for track key.');
            keys.add(key);
            return { key, index, node: renderItem(item, index, count) };
          });
          return { items };
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
): GtplRenderView<Node> {
  const node = render(context, createGtplRenderRuntime(host));
  const resources = new ResourceScope();
  resources.add(() => host.destroy(node));
  return { node, dispose: () => resources.dispose() };
}
