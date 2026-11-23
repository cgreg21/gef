import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefLabel } from './label.component.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefLabel', () => {
  it('declares a text input', () => {
    expect(getComponentMetadata(GefLabel)).toMatchObject({
      selector: 'GefLabel',
      inputs: ['text'],
      outputs: [],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StLabel', 'text'],
    ['GTK4', createGtkUiRegistry, 'GtkLabel', 'label'],
  ])('renders reactive text on %s', (_platform, createRegistry, nativeName, property) => {
    const definition = createRegistry().match('GefLabel', {});
    expect(definition).toBeDefined();
    const label = definition!.create(new Injector()) as GefLabel;
    label.text = 'Hello';
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    definition!.render(label, runtime as never);

    expect(element).toHaveBeenCalledWith(nativeName, {
      [property]: expect.objectContaining({ kind: 'binding' }),
    }, undefined);
    const binding = element.mock.calls[0]![1][property] as { get(): string };
    let rendered = '';
    const stop = effect(() => { rendered = binding.get(); });
    expect(rendered).toBe('Hello');
    label.text = 'Welcome';
    expect(rendered).toBe('Welcome');
    stop();
  });
});
