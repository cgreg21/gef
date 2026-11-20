export interface GtplRepeatItem<Node> {
  readonly key: unknown;
  readonly index: number;
  readonly node: Node;
}

export interface GtplRenderHost<Node> {
  element(name: string, attributes: Readonly<Record<string, unknown>>, children: Node): Node;
  text(value: string): Node;
  fragment(children: readonly Node[]): Node;
  repeat(items: readonly GtplRepeatItem<Node>[]): Node;
}

export interface GtplSwitchCase<Node> {
  readonly values: readonly unknown[];
  readonly render: () => Node;
}

/** Runtime surface targeted by JavaScript emitted by emitGtplTemplate. */
export interface GtplRenderRuntime<Node> {
  element(name: string, attributes: Readonly<Record<string, unknown>>, children: Node): Node;
  text(value: string): Node;
  fragment(children: readonly Node[]): Node;
  if<T>(condition: T, render: (value: T) => Node, fallback?: () => Node): Node;
  for<T>(
    collection: Iterable<T> | null | undefined,
    renderItem: (item: T, index: number, count: number) => Node,
    trackBy: (item: T, index: number, count: number) => unknown,
    renderEmpty: () => Node,
  ): Node;
  switch(
    value: unknown,
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
    element: (name, attributes, children) => host.element(name, attributes, children),
    text: (value) => host.text(value),
    fragment: (children) => host.fragment(children),
    if: (condition, render, fallback) => condition ? render(condition) : fallback?.() ?? host.fragment([]),
    for: (collection, renderItem, trackBy, renderEmpty) => {
      if (collection == null) return renderEmpty();
      const values = Array.from(collection);
      if (values.length === 0) return renderEmpty();
      const count = values.length;
      const items = values.map((item, index) => ({
        key: trackBy(item, index, count),
        index,
        node: renderItem(item, index, count),
      }));
      return host.repeat(items);
    },
    switch: (value, cases, renderDefault) => {
      for (const branch of cases) {
        if (branch.values.some((candidate) => Object.is(candidate, value))) return branch.render();
      }
      return renderDefault?.() ?? host.fragment([]);
    },
  };
}
