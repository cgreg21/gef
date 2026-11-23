import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { GefSearchInput } from './search-input.component.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefSearchInput', () => {
  it('declares value and placeholder inputs and valueChange output', () => {
    expect(getComponentMetadata(GefSearchInput)).toMatchObject({
      selector: 'GefSearchInput',
      inputs: ['value', 'placeholder'],
      outputs: ['valueChange'],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StEntry', 'hint-text'],
    ['GTK4', createGtkUiRegistry, 'GtkSearchEntry', 'placeholder-text'],
  ])('binds the native search entry on %s', (_platform, createRegistry, nativeName, placeholderProperty) => {
    const definition = createRegistry().match('GefSearchInput', {});
    expect(definition).toBeDefined();
    const input = definition!.create(new Injector()) as GefSearchInput;
    input.value = 'initial';
    input.placeholder = 'Search…';
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    input.valueChange.subscribe(changed);

    definition!.render(input, runtime as never);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      [placeholderProperty]: expect.objectContaining({ kind: 'binding' }),
      text: expect.objectContaining({ kind: 'binding' }),
      textChange: expect.any(Function),
    }), undefined);
    const attributes = element.mock.calls[0]![1];
    const valueBinding = attributes.text as { get(): string };
    const placeholderBinding = attributes[placeholderProperty] as { get(): string };
    let renderedValue = '';
    let renderedPlaceholder = '';
    const stopValue = effect(() => { renderedValue = valueBinding.get(); });
    const stopPlaceholder = effect(() => { renderedPlaceholder = placeholderBinding.get(); });
    expect(renderedValue).toBe('initial');
    expect(renderedPlaceholder).toBe('Search…');

    input.value = 'updated';
    input.placeholder = 'Find…';
    expect(renderedValue).toBe('updated');
    expect(renderedPlaceholder).toBe('Find…');
    (attributes.textChange as (value: string) => void)('typed');
    expect(input.value).toBe('typed');
    expect(changed).toHaveBeenCalledWith('typed');
    stopValue();
    stopPlaceholder();
  });
});
