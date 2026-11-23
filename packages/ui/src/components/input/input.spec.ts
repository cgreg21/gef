import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefInput } from './input.component.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefInput', () => {
  it('declares a value input and valueChange output', () => {
    expect(getComponentMetadata(GefInput)).toMatchObject({
      selector: 'GefInput',
      inputs: ['value'],
      outputs: ['valueChange'],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StEntry', 'text'],
    ['GTK4', createGtkUiRegistry, 'GtkEntry', 'text'],
  ])('renders a reactive native input on %s', (_platform, createRegistry, nativeName, property) => {
    const definition = createRegistry().match('GefInput', {});
    expect(definition).toBeDefined();
    const input = definition!.create(new Injector()) as GefInput;
    input.value = 'initial';
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    input.valueChange.subscribe(changed);

    definition!.render(input, runtime);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      [property]: expect.objectContaining({ kind: 'binding' }),
      textChange: expect.any(Function),
    }), undefined);
    const attributes = element.mock.calls[0]![1];
    const binding = attributes[property] as { get(): string };
    expect(binding.get()).toBe('initial');
    input.value = 'updated';
    expect(binding.get()).toBe('updated');
    (attributes.textChange as (value: string) => void)('typed');
    expect(input.value).toBe('typed');
    expect(changed).toHaveBeenCalledWith('typed');
  });
});
