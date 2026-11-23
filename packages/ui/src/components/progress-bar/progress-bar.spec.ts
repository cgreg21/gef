import { describe, expect, it } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefProgressBar } from './progress-bar.component.js';

function createRuntime<Node>() {
  const calls: Array<{ name: string; attributes: Readonly<Record<string, unknown>> }> = [];
  const element = (name: string, attributes: Readonly<Record<string, unknown>>) => {
    calls.push({ name, attributes });
    return {} as Node;
  };
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, calls };
}

describe('GefProgressBar', () => {
  it('declares a fraction input', () => {
    expect(getComponentMetadata(GefProgressBar)).toMatchObject({
      selector: 'GefProgressBar',
      inputs: ['fraction'],
      outputs: [],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StProgressBar'],
    ['GTK4', createGtkUiRegistry, 'GtkProgressBar'],
  ])('renders a reactive native progress bar on %s', (_platform, createRegistry, nativeName) => {
    const definition = createRegistry().match('GefProgressBar', {});
    expect(definition).toBeDefined();
    const progress = definition!.create(new Injector()) as GefProgressBar;
    progress.fraction = 0.25;
    const { runtime, calls } = createRuntime<StActor | GtkActor>();

    definition!.render(progress, runtime as never);

    expect(calls[0]?.name).toBe(nativeName);
    const binding = calls[0]!.attributes.fraction as { get(): number };
    expect(binding.get()).toBe(0.25);
    progress.fraction = 0.75;
    expect(binding.get()).toBe(0.75);
  });
});
