import { describe, expect, it } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
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

  it('renders a GNOME Shell progress indicator without removed St.ProgressBar', () => {
    const definition = createStUiRegistry().match('GefProgressBar', {});
    expect(definition).toBeDefined();
    const progress = definition!.create(new Injector()) as GefProgressBar;
    progress.fraction = 0.5;
    const { runtime, calls } = createRuntime<StActor>();
    definition!.render(progress, runtime);
    expect(calls[0]?.name).toBe('StLabel');
    const binding = calls[0]!.attributes.text as { get(): string };
    let rendered = '';
    const stop = effect(() => { rendered = binding.get(); });
    expect(rendered).toBe('█████░░░░░');
    progress.fraction = 0.8;
    expect(rendered).toBe('████████░░');
    progress.fraction = 2;
    expect(rendered).toBe('██████████');
    progress.fraction = -1;
    expect(rendered).toBe('░░░░░░░░░░');
    stop();
  });

  it('renders a reactive native GTK progress bar', () => {
    const definition = createGtkUiRegistry().match('GefProgressBar', {});
    expect(definition).toBeDefined();
    const progress = definition!.create(new Injector()) as GefProgressBar;
    progress.fraction = 0.25;
    const { runtime, calls } = createRuntime<GtkActor>();
    definition!.render(progress, runtime);
    expect(calls[0]?.name).toBe('GtkProgressBar');
    const binding = calls[0]!.attributes.fraction as { get(): number };
    let rendered = 0;
    const stop = effect(() => { rendered = binding.get(); });
    expect(rendered).toBe(0.25);
    progress.fraction = 0.75;
    expect(rendered).toBe(0.75);
    stop();
  });
});
