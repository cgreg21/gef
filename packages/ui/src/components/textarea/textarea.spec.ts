import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefTextArea } from './textarea.component.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefTextArea', () => {
  it('declares value input and valueChange output', () => {
    expect(getComponentMetadata(GefTextArea)).toMatchObject({
      selector: 'GefTextArea',
      inputs: ['value'],
      outputs: ['valueChange'],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StTextArea'],
    ['GTK4', createGtkUiRegistry, 'GtkTextView'],
  ])('binds native multiline editing on %s', (_platform, createRegistry, nativeName) => {
    const definition = createRegistry().match('GefTextArea', {});
    expect(definition).toBeDefined();
    const area = definition!.create(new Injector()) as GefTextArea;
    area.value = 'first\nsecond';
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    area.valueChange.subscribe(changed);

    definition!.render(area, runtime as never);

    if (nativeName === 'GtkTextView') {
      expect(element).toHaveBeenNthCalledWith(1, 'GtkTextView', expect.objectContaining({
        text: expect.objectContaining({ kind: 'binding' }),
        textChange: expect.any(Function),
      }), undefined);
      expect(element).toHaveBeenNthCalledWith(2, 'GtkScrolledWindow', { hexpand: true, vexpand: true }, expect.anything());
    } else {
      expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
        text: expect.objectContaining({ kind: 'binding' }),
        textChange: expect.any(Function),
      }), undefined);
    }
    const attributes = element.mock.calls[0]![1];
    expect((attributes.text as { get(): string }).get()).toBe('first\nsecond');
    (attributes.textChange as (value: string) => void)('updated');
    expect(area.value).toBe('updated');
    expect(changed).toHaveBeenCalledWith('updated');
  });
});
