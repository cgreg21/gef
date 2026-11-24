import { Injector, type Provider } from '../di/injector.js';
import { mountGtplTemplate, type GtplRenderFunction, type GtplRenderHost, type GtplRenderView } from '../rendering/gtpl-runtime.js';
import { ResourceScope } from '../resources/resource-scope.js';
import type { PipeRegistry } from '../pipes/pipe-registry.js';
import type { DirectiveRegistry } from '../directives/directive-registry.js';
import type { ComponentRegistry } from './component-registry.js';
import { effect } from '../reactivity/signal.js';
import type { EventEmitter } from '../../../shared/src/events/event-emitter.js';
import { getComponentMetadata } from '../../../shared/src/components/metadata.js';

export interface ComponentLifecycle {
  onInit?(): void;
  onDestroy?(): void;
}

export interface ComponentInput {
  readonly publicName: string;
  readonly member: string;
}

export interface ComponentHostBinding {
  readonly member: string;
  readonly property: string;
}

export interface ComponentOutput {
  readonly publicName: string;
  readonly member: string;
}

export interface ComponentDefinition<Instance, Node> {
  readonly inputs?: readonly ComponentInput[];
  readonly outputs?: readonly ComponentOutput[];
  readonly hostBindings?: readonly ComponentHostBinding[];
  readonly create: (injector: Injector) => Instance;
  readonly render: GtplRenderFunction<Instance, Node>;
  readonly providers?: readonly Provider[];
  readonly pipes?: PipeRegistry;
  readonly directives?: DirectiveRegistry<Node>;
  readonly components?: ComponentRegistry<Node>;
  readonly dispose?: (instance: Instance) => void;
}

export interface ComponentRef<Instance, Node> {
  readonly instance: Instance;
  readonly injector: Injector;
  readonly view: GtplRenderView<Node>;
  readonly outputs: Readonly<Record<string, EventEmitter<unknown>>>;
  onDestroy(callback: () => void): void;
  destroy(): void;
}

/**
 * Creates a component instance in a child injector and owns its view, instance
 * cleanup and injector lifetime in one deterministic scope.
 */
export function mountComponent<Instance, Node>(
  definition: ComponentDefinition<Instance, Node>,
  parentInjector: Injector,
  host: GtplRenderHost<Node>,
  inputs: Readonly<Record<string, unknown>> = {},
): ComponentRef<Instance, Node> {
  const injector = parentInjector.createChild(definition.providers ?? []);
  const resources = new ResourceScope();
  resources.add(() => injector.destroy());

  try {
    const instance = definition.create(injector);
    if (definition.dispose) resources.add(() => definition.dispose?.(instance));
    const outputs: Record<string, EventEmitter<unknown>> = {};
    for (const output of definition.outputs ?? []) {
      const emitter = (instance as Record<string, unknown>)[output.member];
      if (!isEventEmitter(emitter)) throw new TypeError(`Component output "${output.member}" must be an EventEmitter.`);
      outputs[output.publicName] = emitter;
      resources.add(() => emitter.clear());
    }
    for (const input of definition.inputs ?? []) {
      if (!(input.publicName in inputs)) continue;
      const value = inputs[input.publicName];
      if (isBinding(value)) resources.add(effect(() => { (instance as Record<string, unknown>)[input.member] = value.get(); }));
      else (instance as Record<string, unknown>)[input.member] = value;
    }
    if (isComponentLifecycle(instance)) {
      if (typeof instance.onDestroy === 'function') resources.add(() => instance.onDestroy?.());
      if (typeof instance.onInit === 'function') instance.onInit();
    }
    const view = mountGtplTemplate(instance, definition.render, host, definition.pipes, definition.directives, injector, definition.components);
    resources.add(() => view.dispose());
    if ((definition.hostBindings?.length ?? 0) > 0) {
      const hostAttributes: Record<string, unknown> = {};
      for (const binding of definition.hostBindings ?? []) {
        const value = (instance as Record<string, unknown>)[binding.member];
        if (binding.property === 'class' || binding.property === 'style') {
          const attribute = isBinding(value)
            ? binding.property === 'class' ? 'classBinding' : 'styleBinding'
            : binding.property;
          hostAttributes[attribute] = value;
        } else if (binding.property.startsWith('class.') || binding.property.startsWith('style.')) {
          hostAttributes[binding.property] = value;
        } else {
          if (!host.setProperty) throw new Error('The renderer host does not support component host property bindings.');
          if (isBinding(value)) resources.add(effect(() => host.setProperty?.(view.node, binding.property, value.get())));
          else host.setProperty(view.node, binding.property, value);
        }
      }
      if (Object.keys(hostAttributes).length > 0) {
        if (!host.setHostAttributes) throw new Error('The renderer host does not support component host class/style bindings.');
        host.setHostAttributes(view.node, hostAttributes);
      }
    }
    return {
      instance,
      injector,
      view,
      outputs,
      onDestroy: (callback) => { resources.add(callback); },
      destroy: () => resources.dispose(),
    };
  } catch (error) {
    try {
      resources.dispose();
    } catch {
      // Preserve the construction or rendering error as the primary failure.
    }
    throw error;
  }
}

/** Mounts a decorated component without repeating its @Component metadata. */
export function mountDecoratedComponent<Instance, Node>(
  type: new () => Instance,
  render: GtplRenderFunction<Instance, Node>,
  parentInjector: Injector,
  host: GtplRenderHost<Node>,
  inputs: Readonly<Record<string, unknown>> = {},
): ComponentRef<Instance, Node> {
  const metadata = getComponentMetadata(type);
  if (!metadata) throw new TypeError('Cannot mount a component without @Component metadata.');
  return mountComponent({
    inputs: metadata.inputBindings,
    outputs: metadata.outputBindings,
    hostBindings: metadata.hostBindings,
    create: () => new type(),
    render,
  }, parentInjector, host, inputs);
}
function isBinding(value: unknown): value is { get(): unknown } {
  return typeof value === 'object' && value !== null && 'kind' in value
    && value.kind === 'binding' && 'get' in value && typeof value.get === 'function';
}

function isEventEmitter(value: unknown): value is EventEmitter<unknown> {
  return typeof value === 'object' && value !== null
    && 'subscribe' in value && typeof value.subscribe === 'function'
    && 'clear' in value && typeof value.clear === 'function';
}

function isComponentLifecycle(value: unknown): value is ComponentLifecycle {
  return typeof value === 'object' && value !== null
    && (('onInit' in value && typeof value.onInit === 'function')
      || ('onDestroy' in value && typeof value.onDestroy === 'function'));
}
