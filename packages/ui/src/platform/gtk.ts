import { ComponentRegistry } from '../../../runtime/src/components/component-registry.js';
import type { GtplRenderRuntime } from '../../../runtime/src/rendering/gtpl-runtime.js';
import type { GtkActor } from '../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefCheckbox } from '../components/checkbox/checkbox.component.js';
import { GefSwitch } from '../components/switch/switch.component.js';
import { GefButton } from '../components/button/button.component.js';
import { GefIcon } from '../components/icon/icon.component.js';
import { GefInput } from '../components/input/input.component.js';
import { GefLabel } from '../components/label/label.component.js';
import { GefProgressBar } from '../components/progress-bar/progress-bar.component.js';
import { GefSelect } from '../components/select/select.component.js';
import { GefTextArea } from '../components/textarea/textarea.component.js';

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
  registry.registerType(GefInput, {
    create: () => new GefInput(),
    render: (input: GefInput, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkEntry',
      {
        text: runtime.bind(() => input.value),
        textChange: (value: string) => {
          input.value = value;
          input.valueChange.emit(value);
        },
      },
      undefined,
    ),
  });
  registry.registerType(GefTextArea, {
    create: () => new GefTextArea(),
    render: (area: GefTextArea, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkScrolledWindow',
      { hexpand: true, vexpand: true },
      runtime.element(
        'GtkTextView',
        {
          'wrap-mode': 3,
          text: runtime.bind(() => area.value),
          textChange: (value: string) => {
            area.value = value;
            area.valueChange.emit(value);
          },
        },
        undefined,
      ),
    ),
  });
  registry.registerType(GefProgressBar, {
    create: () => new GefProgressBar(),
    render: (progress: GefProgressBar, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkProgressBar',
      { fraction: runtime.bind(() => progress.fraction) },
      undefined,
    ),
  });
  registry.registerType(GefCheckbox, {
    create: () => new GefCheckbox(),
    render: (checkbox: GefCheckbox, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkCheckButton',
      {
        active: runtime.bind(() => checkbox.checked),
        activeChange: (value: boolean) => {
          checkbox.checked = value;
          checkbox.checkedChange.emit(value);
        },
      },
      undefined,
    ),
  });
  registry.registerType(GefSelect, {
    create: () => new GefSelect(),
    render: (select: GefSelect, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkDropDown',
      {
        options: runtime.bind(() => select.options),
        value: runtime.bind(() => select.value),
        valueChange: (value: string) => {
          select.value = value;
          select.selectedChange.emit(value);
        },
      },
      undefined,
    ),
  });
  registry.registerType(GefSwitch, {
    create: () => new GefSwitch(),
    render: (toggle: GefSwitch, runtime: GtplRenderRuntime<GtkActor>) => runtime.element(
      'GtkSwitch',
      {
        active: runtime.bind(() => toggle.active),
        activeChange: (value: boolean) => {
          toggle.active = value;
          toggle.activeChange.emit(value);
        },
      },
      undefined,
    ),
  });
  return registry;
}
