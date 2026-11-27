import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
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
  it('declares value, placeholder and disabled inputs with a valueChange output', () => {
    expect(getComponentMetadata(GefInput)).toMatchObject({
      selector: 'GefInput',
      inputs: ['value', 'placeholder', 'disabled'],
      outputs: ['valueChange'],
    });
  });

  it.each([
    {
      platform: 'GNOME Shell',
      createRegistry: createStUiRegistry,
      nativeName: 'StEntry',
      valueProperty: 'text',
      placeholderProperty: 'hint-text',
      enabledProperties: ['reactive', 'can_focus'],
    },
    {
      platform: 'GTK4',
      createRegistry: createGtkUiRegistry,
      nativeName: 'GtkEntry',
      valueProperty: 'text',
      placeholderProperty: 'placeholder-text',
      enabledProperties: ['sensitive'],
    },
  ])('keeps the native input synchronized on $platform', ({
    createRegistry, nativeName, valueProperty, placeholderProperty, enabledProperties,
  }) => {
    const definition = createRegistry().match('GefInput', {});
    expect(definition).toBeDefined();
    const input = definition!.create(new Injector()) as GefInput;
    input.value = 'initial';
    input.placeholder = 'Type here';
    input.disabled = true;
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    input.valueChange.subscribe(changed);

    definition!.render(input, runtime as never);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      [valueProperty]: expect.objectContaining({ kind: 'binding' }),
      [placeholderProperty]: expect.objectContaining({ kind: 'binding' }),
      ...Object.fromEntries(enabledProperties.map((name) => [name, expect.objectContaining({ kind: 'binding' })])),
      textChange: expect.any(Function),
    }), undefined);

    const attributes = element.mock.calls[0]![1];
    const valueBinding = attributes[valueProperty] as { get(): string };
    const placeholderBinding = attributes[placeholderProperty] as { get(): string };
    let renderedValue = '';
    let renderedPlaceholder = '';
    const renderedEnabled: boolean[] = [];
    const stops = [
      effect(() => { renderedValue = valueBinding.get(); }),
      effect(() => { renderedPlaceholder = placeholderBinding.get(); }),
      ...enabledProperties.map((name) => effect(() => {
        renderedEnabled.push((attributes[name] as { get(): boolean }).get());
      })),
    ];

    expect(renderedValue).toBe('initial');
    expect(renderedPlaceholder).toBe('Type here');
    expect(renderedEnabled).toEqual(enabledProperties.map(() => false));

    input.value = 'updated';
    input.placeholder = 'Updated hint';
    input.disabled = false;
    expect(renderedValue).toBe('updated');
    expect(renderedPlaceholder).toBe('Updated hint');
    expect(renderedEnabled.slice(enabledProperties.length)).toEqual(enabledProperties.map(() => true));

    (attributes.textChange as (value: string) => void)('typed');
    expect(input.value).toBe('typed');
    expect(renderedValue).toBe('typed');
    expect(changed).toHaveBeenCalledWith('typed');
    for (const stop of stops) stop();
  });
});
