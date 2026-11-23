import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefSelect } from './select.component.js';

function createRuntime<Node>() {
  const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: Node | undefined) => ({} as Node));
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, element };
}

describe('GefSelect', () => {
  it('declares options and value inputs with a selectedChange output', () => {
    expect(getComponentMetadata(GefSelect)).toMatchObject({
      selector: 'GefSelect',
      inputs: ['options', 'value'],
      outputs: ['selectedChange'],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StSelect'],
    ['GTK4', createGtkUiRegistry, 'GtkDropDown'],
  ])('binds native selection on %s', (_platform, createRegistry, nativeName) => {
    const definition = createRegistry().match('GefSelect', {});
    expect(definition).toBeDefined();
    const select = definition!.create(new Injector()) as GefSelect;
    select.options = ['One', 'Two'];
    select.value = 'Two';
    const { runtime, element } = createRuntime<StActor | GtkActor>();
    const changed = vi.fn();
    select.selectedChange.subscribe(changed);

    definition!.render(select, runtime as never);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      options: expect.objectContaining({ kind: 'binding' }),
      value: expect.objectContaining({ kind: 'binding' }),
      valueChange: expect.any(Function),
    }), undefined);
    const attributes = element.mock.calls[0]![1];
    expect((attributes.options as { get(): string[] }).get()).toEqual(['One', 'Two']);
    expect((attributes.value as { get(): string }).get()).toBe('Two');
    (attributes.valueChange as (value: string) => void)('One');
    expect(select.value).toBe('One');
    expect(changed).toHaveBeenCalledWith('One');
  });
});
