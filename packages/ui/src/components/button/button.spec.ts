import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefButton } from './button.component.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';

describe('GefButton', () => {
  it('declares its public input and output contract', () => {
    expect(getComponentMetadata(GefButton)).toMatchObject({
      selector: 'GefButton',
      inputs: ['label', 'disabled'],
      outputs: ['clicked'],
    });
  });

  it('renders a native St button and forwards its click output', () => {
    const registry = createStUiRegistry();
    const definition = registry.match('GefButton', {});
    expect(definition).toBeDefined();
    const button = definition!.create(new Injector()) as GefButton;
    button.label = 'Save';
    const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: StActor | undefined) => ({} as StActor));
    const text = vi.fn((_value: string) => ({} as StActor));
    const runtime = { element, text } as unknown as GtplRenderRuntime<StActor>;
    const clicked = vi.fn();
    button.clicked.subscribe(clicked);

    definition!.render(button, runtime);

    expect(element).toHaveBeenCalledWith('StButton', expect.objectContaining({
      disabled: false,
      clicked: expect.any(Function),
    }), expect.anything());
    const attributes = element.mock.calls[0]![1];
    (attributes.clicked as () => void)();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('renders a native GTK button using its sensitive property', () => {
    const registry = createGtkUiRegistry();
    const definition = registry.match('GefButton', {});
    expect(definition).toBeDefined();
    const button = definition!.create(new Injector()) as GefButton;
    button.disabled = true;
    const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: GtkActor | undefined) => ({} as GtkActor));
    const text = vi.fn((_value: string) => ({} as GtkActor));
    const runtime = { element, text } as unknown as GtplRenderRuntime<GtkActor>;

    definition!.render(button, runtime);

    expect(element).toHaveBeenCalledWith('GtkButton', expect.objectContaining({
      sensitive: false,
      clicked: expect.any(Function),
    }), expect.anything());
  });
});
