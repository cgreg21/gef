import { ComponentRegistry } from '../../../runtime/src/components/component-registry.js';
import type { GtplRenderRuntime } from '../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import { GefButton } from '../components/button/button.component.js';
import { GefLabel } from '../components/label/label.component.js';

export function createStUiRegistry(): ComponentRegistry<StActor> {
  const registry = new ComponentRegistry<StActor>();
  registry.registerType(GefButton, {
    create: () => new GefButton(),
    render: (button: GefButton, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StButton',
      {
        disabled: runtime.bind(() => button.disabled),
        clicked: () => button.clicked.emit(undefined),
      },
      runtime.text(runtime.bind(() => button.label)),
    ),
  });
  registry.registerType(GefLabel, {
    create: () => new GefLabel(),
    render: (label: GefLabel, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StLabel',
      { text: runtime.bind(() => label.text) },
    ),
  });
  return registry;
}
