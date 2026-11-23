import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefPasswordInput } from './password-input.component.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefPasswordInput', () => {
  it('declares value, peek icon and valueChange', () => {
    expect(getComponentMetadata(GefPasswordInput)).toMatchObject({
      selector: 'GefPasswordInput',
      inputs: ['value', 'showPeekIcon'],
      outputs: ['valueChange'],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StPasswordEntry'],
    ['GTK4', createGtkUiRegistry, 'GtkPasswordEntry'],
  ])('binds native password entry on %s', (_platform, createRegistry, nativeName) => {
    const definition = createRegistry().match('GefPasswordInput', {});
    expect(definition).toBeDefined();
    const input = definition!.create(new Injector()) as GefPasswordInput;
    input.value = 'secret';
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    input.valueChange.subscribe(changed);

    definition!.render(input, runtime as never);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      text: expect.objectContaining({ kind: 'binding' }),
      textChange: expect.any(Function),
      'show-peek-icon': expect.objectContaining({ kind: 'binding' }),
    }), undefined);
    const attributes = element.mock.calls[0]![1];
    expect((attributes.text as { get(): string }).get()).toBe('secret');
    expect(('show-peek-icon' in attributes ? attributes['show-peek-icon'] as { get(): boolean } : { get: () => false }).get())
      .toBe(true);
    (attributes.textChange as (value: string) => void)('updated');
    expect(input.value).toBe('updated');
    expect(changed).toHaveBeenCalledWith('updated');
  });
});
