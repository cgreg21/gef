import { Injector, type Provider } from '../di/injector.js';
import { ResourceScope } from '../resources/resource-scope.js';
import { effect, type ReadonlySignal } from '../reactivity/signal.js';

export interface DirectiveHost<Node> {
  setProperty(node: Node, property: string, value: unknown): void;
  listen(node: Node, event: string, handler: (...args: unknown[]) => unknown): () => void;
}

export interface DirectiveHostBinding {
  readonly member: string;
  readonly property: string;
}

export interface DirectiveHostListener {
  readonly member: string;
  readonly event: string;
  readonly args?: readonly string[];
}

export interface DirectiveDefinition<Instance, Node> {
  readonly create: (injector: Injector) => Instance;
  readonly hostBindings?: readonly DirectiveHostBinding[];
  readonly hostListeners?: readonly DirectiveHostListener[];
  readonly providers?: readonly Provider[];
  readonly dispose?: (instance: Instance) => void;
}

export interface DirectiveRef<Instance> {
  readonly instance: Instance;
  readonly injector: Injector;
  destroy(): void;
}

function readMember(instance: object, member: string): unknown {
  return (instance as Record<string, unknown>)[member];
}

function resolveListenerArgument(argument: string, event: unknown): unknown {
  if (argument === '$event') return event;
  if (argument === '$event.target') {
    return typeof event === 'object' && event !== null && 'target' in event
      ? event.target : undefined;
  }
  return undefined;
}

/** Instantiates a directive against a native actor and owns all host behavior. */
export function mountDirective<Instance extends object, Node>(
  definition: DirectiveDefinition<Instance, Node>,
  parentInjector: Injector,
  host: DirectiveHost<Node>,
  node: Node,
  inputs: Readonly<Record<string, unknown>> = {},
): DirectiveRef<Instance> {
  const injector = parentInjector.createChild(definition.providers ?? []);
  const resources = new ResourceScope();
  resources.add(() => injector.destroy());

  try {
    const instance = definition.create(injector);
    if (definition.dispose) resources.add(() => definition.dispose?.(instance));
    for (const [name, value] of Object.entries(inputs)) {
      (instance as Record<string, unknown>)[name] = value;
    }

    for (const binding of definition.hostBindings ?? []) {
      const read = () => readMember(instance, binding.member);
      const value = read();
      if (isReadonlySignal(value)) {
        resources.add(effect(() => host.setProperty(node, binding.property, value.get())));
        resources.add(() => value.dispose?.());
      } else if (typeof value === 'function') {
        resources.add(effect(() => host.setProperty(node, binding.property, (value as () => unknown).call(instance))));
      } else {
        host.setProperty(node, binding.property, value);
      }
    }

    for (const listener of definition.hostListeners ?? []) {
      const callback = readMember(instance, listener.member);
      if (typeof callback !== 'function') throw new TypeError(`Host listener "${listener.member}" is not a function.`);
      resources.add(host.listen(node, listener.event, (...events) => {
        const event = events.length <= 1 ? events[0] : events;
        const args = (listener.args ?? ['$event']).map((argument) => resolveListenerArgument(argument, event));
        return callback.apply(instance, args);
      }));
    }

    return { instance, injector, destroy: () => resources.dispose() };
  } catch (error) {
    try { resources.dispose(); } catch { /* Keep construction failure primary. */ }
    throw error;
  }
}

function isReadonlySignal(value: unknown): value is ReadonlySignal<unknown> & { dispose?: () => void } {
  return typeof value === 'object' && value !== null
    && 'get' in value && typeof value.get === 'function'
    && 'subscribe' in value && typeof value.subscribe === 'function';
}
