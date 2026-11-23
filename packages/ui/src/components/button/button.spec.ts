import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefButton } from './button.component.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const text = vi.fn((_value: string | { readonly kind: 'binding'; readonly get: () => string }) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, text, bind } as unknown as GtplRenderRuntime<Node>, element, text };
}

describe('GefButton', () => {
  it('declares its public input and output contract', () => {
    expect(getComponentMetadata(GefButton)).toMatchObject({
      selector: 'GefButton',
      inputs: ['label', 'disabled'],
      outputs: ['clicked'],
    });
  });

  it('keeps St button state reactive and forwards clicks', () => {
    const definition = createStUiRegistry().match('GefButton', {});
    expect(definition).toBeDefined();
    const button = definition!.create(new Injector()) as GefButton;
    button.label = 'Save';
    const { runtime, element, text } = createRuntime<StActor>();
    const clicked = vi.fn();
    button.clicked.subscribe(clicked);
    definition!.render(button, runtime);

    expect(element).toHaveBeenCalledWith('StButton', expect.objectContaining({
      disabled: expect.objectContaining({ kind: 'binding' }),
      clicked: expect.any(Function),
    }), expect.anything());
    const attributes = element.mock.calls[0]![1];
    const disabled = attributes.disabled as { get(): boolean };
    const label = text.mock.calls[0]![0] as { get(): string };
    let renderedDisabled = true;
    let renderedLabel = '';
    const stop = effect(() => {
      renderedDisabled = disabled.get();
      renderedLabel = label.get();
    });
    expect(renderedDisabled).toBe(false);
    expect(renderedLabel).toBe('Save');

    button.disabled = true;
    button.label = 'Saved';
    expect(renderedDisabled).toBe(true);
    expect(renderedLabel).toBe('Saved');
    (attributes.clicked as () => void)();
    expect(clicked).toHaveBeenCalledOnce();
    stop();
  });

  it('keeps GTK sensitivity and label reactive', () => {
    const definition = createGtkUiRegistry().match('GefButton', {});
    expect(definition).toBeDefined();
    const button = definition!.create(new Injector()) as GefButton;
    button.label = 'Save';
    button.disabled = true;
    const { runtime, element, text } = createRuntime<GtkActor>();
    definition!.render(button, runtime);

    expect(element).toHaveBeenCalledWith('GtkButton', expect.objectContaining({
      sensitive: expect.objectContaining({ kind: 'binding' }),
      clicked: expect.any(Function),
    }), expect.anything());
    const attributes = element.mock.calls[0]![1];
    const sensitive = attributes.sensitive as { get(): boolean };
    const label = text.mock.calls[0]![0] as { get(): string };
    let renderedSensitive = true;
    let renderedLabel = '';
    const stop = effect(() => {
      renderedSensitive = sensitive.get();
      renderedLabel = label.get();
    });
    expect(renderedSensitive).toBe(false);
    expect(renderedLabel).toBe('Save');

    button.disabled = false;
    button.label = 'Saved';
    expect(renderedSensitive).toBe(true);
    expect(renderedLabel).toBe('Saved');
    stop();
  });
});
