import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefSwitch } from './switch.component.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefSwitch', () => {
  it('declares an active input and activeChange output', () => {
    expect(getComponentMetadata(GefSwitch)).toMatchObject({
      selector: 'GefSwitch',
      inputs: ['active'],
      outputs: ['activeChange'],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StSwitch', 'state'],
    ['GTK4', createGtkUiRegistry, 'GtkSwitch', 'active'],
  ])('renders a reactive native switch on %s', (_platform, createRegistry, nativeName, property) => {
    const definition = createRegistry().match('GefSwitch', {});
    expect(definition).toBeDefined();
    const toggle = definition!.create(new Injector()) as GefSwitch;
    toggle.active = true;
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    toggle.activeChange.subscribe(changed);

    definition!.render(toggle, runtime as never);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      [property]: expect.objectContaining({ kind: 'binding' }),
      [property + 'Change']: expect.any(Function),
    }), undefined);
    const attributes = element.mock.calls[0]![1];
    const binding = attributes[property] as { get(): boolean };
    const rendered = { active: false };
    const stop = effect(() => { rendered.active = binding.get(); });
    expect(rendered.active).toBe(true);
    toggle.active = false;
    expect(rendered.active).toBe(false);
    stop();
    (attributes[property + 'Change'] as (value: boolean) => void)(true);
    expect(toggle.active).toBe(true);
    expect(changed).toHaveBeenCalledWith(true);
  });
});
