import type { GtplComponentDefinition } from './gtpl/components.js';

export interface ComponentOptions {
  readonly selector: string;
  readonly template: string;
  readonly styles?: readonly string[];
}
export interface ComponentMetadata extends GtplComponentDefinition {
  readonly template: string;
  readonly styles: readonly string[];
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
}
interface MemberMetadata { readonly kind: 'input' | 'output'; readonly publicName: string; }
const membersByPrototype = new WeakMap<object, MemberMetadata[]>();
const components = new WeakMap<Function, ComponentMetadata>();

function member(kind: MemberMetadata['kind'], publicName?: string): PropertyDecorator {
  return (prototype, propertyKey) => {
    if (typeof propertyKey !== 'string') throw new TypeError('GEF component members must use string property names.');
    const members = membersByPrototype.get(prototype) ?? [];
    members.push({ kind, publicName: publicName ?? propertyKey });
    membersByPrototype.set(prototype, members);
  };
}
/** Declares a template input. Use as @Input() or @Input('publicName'). */
export function Input(publicName?: string): PropertyDecorator { return member('input', publicName); }
/** Declares a template output. Use as @Output() or @Output('publicName'). */
export function Output(publicName?: string): PropertyDecorator { return member('output', publicName); }

/** Registers a GEF component and its template contract. */
export function Component(options: ComponentOptions): ClassDecorator {
  return (target) => {
    if (!options.selector.trim()) throw new TypeError('A component selector cannot be empty.');
    if (!options.template.trim()) throw new TypeError(`Component "${options.selector}" must declare a template.`);
    const members = membersByPrototype.get(target.prototype) ?? [];
    const inputs = members.filter((item) => item.kind === 'input').map((item) => item.publicName);
    const outputs = members.filter((item) => item.kind === 'output').map((item) => item.publicName);
    assertUnique(inputs, 'input', options.selector);
    assertUnique(outputs, 'output', options.selector);
    components.set(target, Object.freeze({
      selector: options.selector, template: options.template,
      styles: Object.freeze([...(options.styles ?? [])]),
      inputs: Object.freeze(inputs), outputs: Object.freeze(outputs),
    }));
  };
}
function assertUnique(names: readonly string[], kind: string, selector: string): void {
  if (new Set(names).size !== names.length) throw new TypeError(`Component "${selector}" declares a duplicate ${kind}.`);
}
/** Returns immutable metadata registered by @Component, if present. */
export function getComponentMetadata(type: Function): ComponentMetadata | undefined { return components.get(type); }

/** Minimal output emitter with explicitly disposable subscriptions. */
export class EventEmitter<T> {
  readonly #listeners = new Set<(value: T) => void>();
  emit(value: T): void { for (const listener of [...this.#listeners]) listener(value); }
  subscribe(listener: (value: T) => void): { unsubscribe(): void } {
    this.#listeners.add(listener);
    let active = true;
    return { unsubscribe: () => { if (!active) return; active = false; this.#listeners.delete(listener); } };
  }
  clear(): void { this.#listeners.clear(); }
}
