import { Injector, type Provider } from '../di/injector.js';
import { mountGtplTemplate, type GtplRenderFunction, type GtplRenderHost, type GtplRenderView } from '../rendering/gtpl-runtime.js';
import { ResourceScope } from '../resources/resource-scope.js';

export interface ComponentDefinition<Instance, Node> {
  readonly create: (injector: Injector) => Instance;
  readonly render: GtplRenderFunction<Instance, Node>;
  readonly providers?: readonly Provider[];
  readonly dispose?: (instance: Instance) => void;
}

export interface ComponentRef<Instance, Node> {
  readonly instance: Instance;
  readonly injector: Injector;
  readonly view: GtplRenderView<Node>;
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
): ComponentRef<Instance, Node> {
  const injector = parentInjector.createChild(definition.providers ?? []);
  const resources = new ResourceScope();
  resources.add(() => injector.destroy());

  try {
    const instance = definition.create(injector);
    if (definition.dispose) resources.add(() => definition.dispose?.(instance));
    const view = mountGtplTemplate(instance, definition.render, host);
    resources.add(() => view.dispose());
    return {
      instance,
      injector,
      view,
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
