import type { DirectiveDefinition, DirectiveInput, DirectiveOutput, DirectiveHostBinding, DirectiveHostListener } from './directive-ref.js';

export interface MatchedDirective<Node> {
  readonly definition: DirectiveDefinition<object, Node>;
  readonly inputs: Readonly<Record<string, unknown>>;
}

/** Small explicit selector registry; supports element, attribute and class selectors. */
export class DirectiveRegistry<Node> {
  readonly #entries: Array<{ selector: string; definition: DirectiveDefinition<object, Node> }> = [];

  register<Instance extends object>(selector: string, definition: DirectiveDefinition<Instance, Node>): this {
    if (!selector.trim()) throw new TypeError('A directive selector cannot be empty.');
    if (this.#entries.some((entry) => entry.selector === selector)) {
      throw new TypeError(`Duplicate directive selector "${selector}".`);
    }
    this.#entries.push({ selector, definition: definition as unknown as DirectiveDefinition<object, Node> });
    return this;
  }

  registerMetadata<Instance extends object>(
    metadata: {
      readonly selector: string;
      readonly inputBindings: readonly DirectiveInput[];
      readonly outputBindings: readonly DirectiveOutput[];
      readonly hostBindings: readonly DirectiveHostBinding[];
      readonly hostListeners: readonly DirectiveHostListener[];
    },
    definition: Omit<DirectiveDefinition<Instance, Node>, 'inputs' | 'outputs' | 'hostBindings' | 'hostListeners'>,
  ): this {
    return this.register(metadata.selector, {
      ...definition,
      inputs: metadata.inputBindings,
      outputs: metadata.outputBindings,
      hostBindings: metadata.hostBindings,
      hostListeners: metadata.hostListeners,
    });
  }

  match(element: string, attributes: Readonly<Record<string, unknown>>): readonly MatchedDirective<Node>[] {
    return this.#entries
      .filter(({ selector }) => matchesSelector(selector, element, attributes))
      .map(({ definition }) => ({ definition, inputs: attributes }));
  }
}

function matchesSelector(
  selector: string,
  element: string,
  attributes: Readonly<Record<string, unknown>>,
): boolean {
  if (selector === element) return true;
  const attribute = /^\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]$/.exec(selector);
  if (attribute) {
    if (!(attribute[1]! in attributes)) return false;
    return attribute[2] === undefined || String(attributes[attribute[1]!]) === attribute[2];
  }
  if (selector.startsWith('.')) {
    const classes = String(attributes.class ?? attributes.className ?? '').split(/\s+/);
    return classes.includes(selector.slice(1));
  }
  const combined = /^([\w-]+)\[([\w-]+)\]$/.exec(selector);
  return Boolean(combined && combined[1] === element && combined[2]! in attributes);
}
