import { ComponentRegistry } from '../../../runtime/src/components/component-registry.js';
import type { GtplRenderRuntime } from '../../../runtime/src/rendering/gtpl-runtime.js';
import type { GtkActor } from '../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefButton } from '../components/button/button.component.js';
import { GefIcon } from '../components/icon/icon.component.js';
import { GefLabel } from '../components/label/label.component.js';

export function createGtkUiRegistry(): ComponentRegistry<GtkActor> {
  const registry = new ComponentRegistry<GtkActor>();
  registry.registerType(GefButton, {
    create: () => new GefButton(),
    render: (button: GefButton, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkButton',
      {
        sensitive: runtime.bind(() => !button.disabled),
        clicked: () => button.clicked.emit(undefined),
      },
      runtime.text(runtime.bind(() => button.label)),
    ),
  });
  registry.registerType(GefLabel, {
    create: () => new GefLabel(),
    render: (label: GefLabel, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkLabel',
      { label: runtime.bind(() => label.text) },
      undefined,
    ),
  });
  registry.registerType(GefIcon, {
    create: () => new GefIcon(),
    render: (icon: GefIcon, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkImage',
      { 'icon-name': runtime.bind(() => icon.iconName) },
      undefined,
    ),
  });
  return registry;
}
