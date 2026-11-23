import { ComponentRegistry } from '../../../runtime/src/components/component-registry.js';
import type { GtplRenderRuntime } from '../../../runtime/src/rendering/gtpl-runtime.js';
import type { GtkActor } from '../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefButton } from '../components/button/button.component.js';

export function createGtkUiRegistry(): ComponentRegistry<GtkActor> {
  const registry = new ComponentRegistry<GtkActor>();
  registry.registerType(GefButton, {
    create: () => new GefButton(),
    render: (button: GefButton, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkButton',
      {
        sensitive: !button.disabled,
        clicked: () => button.clicked.emit(undefined),
      },
      runtime.text(button.label),
    ),
  });
  return registry;
}
