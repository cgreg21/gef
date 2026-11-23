import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefLabel } from './label.component.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return {
    runtime: { element, bind } as unknown as GtplRenderRuntime<Node>,
    element,
  };
}

describe('GefLabel', () => {
  it('declares a text input', () => {
    expect(getComponentMetadata(GefLabel)).toMatchObject({
      selector: 'GefLabel',
      inputs: ['text'],
      outputs: [],
    });
  });

  it('renders reactive text as a native St label', () => {
    const definition = createStUiRegistry().match('GefLabel', {});
    expect(definition).toBeDefined();
    const label = definition!.create(new Injector()) as GefLabel;
    label.text = 'Hello';
    const { runtime, element } = createRuntime<StActor>();
    definition!.render(label, runtime);
    expect(element).toHaveBeenCalledWith('StLabel', {
      text: expect.objectContaining({ kind: 'binding' }),
    }, undefined);
    const binding = element.mock.calls[0]![1].text as { get(): string };
    expect(binding.get()).toBe('Hello');
    label.text = 'Welcome';
    expect(binding.get()).toBe('Welcome');
  });

  it('renders reactive text as a native GTK label', () => {
    const definition = createGtkUiRegistry().match('GefLabel', {});
    expect(definition).toBeDefined();
    const label = definition!.create(new Injector()) as GefLabel;
    label.text = 'Hello';
    const { runtime, element } = createRuntime<GtkActor>();
    definition!.render(label, runtime);
    expect(element).toHaveBeenCalledWith('GtkLabel', {
      label: expect.objectContaining({ kind: 'binding' }),
    }, undefined);
    const binding = element.mock.calls[0]![1].label as { get(): string };
    expect(binding.get()).toBe('Hello');
    label.text = 'Welcome';
    expect(binding.get()).toBe('Welcome');
  });
});
