import type { ComponentDefinition } from './component-ref.js';

export class ComponentRegistry<Node> {
  readonly #entries: Array<{ selector: string; definition: ComponentDefinition<object, Node> }> = [];

  register<Instance>(selector: string, definition: ComponentDefinition<Instance, Node>): this {
    if (!selector.trim()) throw new TypeError('A component selector cannot be empty.');
    if (this.#entries.some((entry) => entry.selector === selector)) {
      throw new TypeError(`Duplicate component selector "${selector}".`);
    }
    this.#entries.push({ selector, definition: definition as ComponentDefinition<object, Node> });
    return this;
  }

  match(element: string, attributes: Readonly<Record<string, unknown>>): ComponentDefinition<object, Node> | undefined {
    const entry = this.#entries.find(({ selector }) => {
      if (selector === element) return true;
      const attribute = /^\[([\w-]+)\]$/.exec(selector);
      return Boolean(attribute && attribute[1]! in attributes);
    });
    return entry?.definition;
  }
}
