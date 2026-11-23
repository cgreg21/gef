import { ComponentRegistry } from '../../../runtime/src/components/component-registry.js';
import type { GtplRenderRuntime } from '../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import { GefCheckbox } from '../components/checkbox/checkbox.component.js';
import { GefSwitch } from '../components/switch/switch.component.js';
import { GefButton } from '../components/button/button.component.js';
import { GefIcon } from '../components/icon/icon.component.js';
import { GefInput } from '../components/input/input.component.js';
import { GefLabel } from '../components/label/label.component.js';
import { GefProgressBar } from '../components/progress-bar/progress-bar.component.js';
import { GefSelect } from '../components/select/select.component.js';
import { GefTextArea } from '../components/textarea/textarea.component.js';

function progressText(fraction: number): string {
  const value = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const filled = Math.round(value * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

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
      undefined,
    ),
  });
  registry.registerType(GefIcon, {
    create: () => new GefIcon(),
    render: (icon: GefIcon, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StIcon',
      { 'icon-name': runtime.bind(() => icon.iconName) },
      undefined,
    ),
  });
  registry.registerType(GefInput, {
    create: () => new GefInput(),
    render: (input: GefInput, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StEntry',
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
    render: (area: GefTextArea, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StTextArea',
      {
        text: runtime.bind(() => area.value),
        textChange: (value: string) => {
          area.value = value;
          area.valueChange.emit(value);
        },
      },
      undefined,
    ),
  });
  registry.registerType(GefProgressBar, {
    create: () => new GefProgressBar(),
    render: (progress: GefProgressBar, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StLabel',
      { text: runtime.bind(() => progressText(progress.fraction)) },
      undefined,
    ),
  });
  registry.registerType(GefCheckbox, {
    create: () => new GefCheckbox(),
    render: (checkbox: GefCheckbox, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StCheckBox',
      {
        checked: runtime.bind(() => checkbox.checked),
        checkedChange: (value: boolean) => {
          checkbox.checked = value;
          checkbox.checkedChange.emit(value);
        },
      },
      undefined,
    ),
  });
  registry.registerType(GefSelect, {
    create: () => new GefSelect(),
    render: (select: GefSelect, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StSelect',
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
    render: (toggle: GefSwitch, runtime: GtplRenderRuntime<StActor>) => runtime.element(
      'StSwitch',
      {
        state: runtime.bind(() => toggle.active),
        stateChange: (value: boolean) => {
          toggle.active = value;
          toggle.activeChange.emit(value);
        },
      },
      undefined,
    ),
  });
  return registry;
}
