import { describe, expect, it, vi } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
import { GefSlider } from './slider.component.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';

describe('GefSlider', () => {
  it('declares a bounded value input and valueChange output', () => {
    expect(getComponentMetadata(GefSlider)).toMatchObject({
      selector: 'GefSlider',
      inputs: ['value'],
      outputs: ['valueChange'],
    });
    const slider = new GefSlider();
    slider.value = 2;
    expect(slider.value).toBe(1);
    slider.value = -1;
    expect(slider.value).toBe(0);
    expect(() => { slider.value = Number.NaN; }).toThrow(/finite number/);
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StSlider'],
    ['GTK4', createGtkUiRegistry, 'GtkScale'],
  ])('binds the native slider on %s', (_platform, createRegistry, nativeName) => {
    const definition = createRegistry().match('GefSlider', {});
    expect(definition).toBeDefined();
    const slider = definition!.create(new Injector()) as GefSlider;
    slider.value = 0.25;
    const element = vi.fn((_name: string, _attributes: Readonly<Record<string, unknown>>, _child: StActor | GtkActor | undefined) => ({} as StActor | GtkActor));
    const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
    const runtime = { element, bind } as unknown as GtplRenderRuntime<StActor | GtkActor>;
    const changed = vi.fn();
    slider.valueChange.subscribe(changed);
    definition!.render(slider, runtime);

    expect(element).toHaveBeenCalledWith(nativeName, expect.objectContaining({
      value: expect.objectContaining({ kind: 'binding' }),
      valueChange: expect.any(Function),
    }), undefined);
    const attributes = element.mock.calls[0]![1];
    const binding = attributes.value as { get(): number };
    let rendered = 0;
    const stop = effect(() => { rendered = binding.get(); });
    expect(rendered).toBe(0.25);
    slider.value = 0.8;
    expect(rendered).toBe(0.8);
    (attributes.valueChange as (value: number) => void)(0.6);
    expect(slider.value).toBe(0.6);
    expect(changed).toHaveBeenCalledWith(0.6);
    stop();
  });
});
