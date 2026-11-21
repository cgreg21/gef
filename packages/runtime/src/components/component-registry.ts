import { getComponentMetadata } from '../../../shared/src/components/metadata.js';
import type { ComponentDefinition, ComponentInput, ComponentOutput } from './component-ref.js';

export class ComponentRegistry<Node> {
  readonly #entries: Array<{ selector: string; definition: ComponentDefinition<object, Node> }> = [];

  register<Instance>(selector: string, definition: ComponentDefinition<Instance, Node>): this {
    if (!selector.trim()) throw new TypeError('A component selector cannot be empty.');
    if (this.#entries.some((entry) => entry.selector === selector)) {
      throw new TypeError(`Duplicate component selector "${selector}".`);
    }
    this.#entries.push({ selector, definition: definition as unknown as ComponentDefinition<object, Node> });
    return this;
  }

  registerType<Instance>(
    type: Function,
    definition: Omit<ComponentDefinition<Instance, Node>, 'inputs' | 'outputs'>,
  ): this {
    const metadata = getComponentMetadata(type);
    if (!metadata) throw new TypeError('Cannot register a component without @Component metadata.');
    return this.registerMetadata(metadata, definition);
  }

  registerMetadata<Instance>(
    metadata: { readonly selector: string; readonly inputBindings: readonly ComponentInput[]; readonly outputBindings: readonly ComponentOutput[] },
    definition: Omit<ComponentDefinition<Instance, Node>, 'inputs' | 'outputs'>,
  ): this {
    return this.register(metadata.selector, { ...definition, inputs: metadata.inputBindings, outputs: metadata.outputBindings });
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
