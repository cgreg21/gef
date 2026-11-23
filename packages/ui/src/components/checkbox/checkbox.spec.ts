import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefCheckbox } from './checkbox.component.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefCheckbox', () => {
  it('declares a checked input and checkedChange output', () => {
    expect(getComponentMetadata(GefCheckbox)).toMatchObject({
      selector: 'GefCheckbox',
      inputs: ['checked'],
      outputs: ['checkedChange'],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StCheckBox', 'checked'],
    ['GTK4', createGtkUiRegistry, 'GtkCheckButton', 'active'],
  ])('keeps the native checkbox synchronized on %s', (_platform, createRegistry, nativeName, property) => {
    const definition = createRegistry().match('GefCheckbox', {});
    expect(definition).toBeDefined();
    const checkbox = definition!.create(new Injector()) as GefCheckbox;
    checkbox.checked = true;
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    checkbox.checkedChange.subscribe(changed);

    definition!.render(checkbox, runtime as never);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      [property]: expect.objectContaining({ kind: 'binding' }),
      [property + 'Change']: expect.any(Function),
    }), undefined);
    const attributes = element.mock.calls[0]![1];
    const binding = attributes[property] as { get(): boolean };
    let rendered = false;
    const stop = effect(() => { rendered = binding.get(); });
    expect(rendered).toBe(true);

    checkbox.checked = false;
    expect(rendered).toBe(false);
    (attributes[property + 'Change'] as (value: boolean) => void)(true);
    expect(checkbox.checked).toBe(true);
    expect(rendered).toBe(true);
    expect(changed).toHaveBeenCalledWith(true);
    stop();
  });
});
