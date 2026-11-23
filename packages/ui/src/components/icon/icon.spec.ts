import { describe, expect, it } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import { effect } from '../../../../runtime/src/reactivity/signal.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefIcon } from './icon.component.js';

function createRuntime<Node>() {
  const calls: Array<{ name: string; attributes: Readonly<Record<string, unknown>>; child: Node | undefined }> = [];
  const element = (name: string, attributes: Readonly<Record<string, unknown>>, child: Node | undefined) => {
    calls.push({ name, attributes, child });
    return {} as Node;
  };
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return { runtime: { element, bind } as unknown as GtplRenderRuntime<Node>, calls };
}

describe('GefIcon', () => {
  it('declares a reactive iconName input', () => {
    expect(getComponentMetadata(GefIcon)).toMatchObject({
      selector: 'GefIcon',
      inputs: ['iconName'],
      outputs: [],
    });
  });

  it.each([
    ['GNOME Shell', createStUiRegistry, 'StIcon', 'icon-name'],
    ['GTK4', createGtkUiRegistry, 'GtkImage', 'icon-name'],
  ])('renders a reactive native icon on %s', (_platform, createRegistry, nativeName, property) => {
    const definition = createRegistry().match('GefIcon', {});
    expect(definition).toBeDefined();
    const icon = definition!.create(new Injector()) as GefIcon;
    icon.iconName = 'document-save-symbolic';
    const { runtime, calls } = createRuntime<StActor | GtkActor>();
    definition!.render(icon, runtime as never);

    expect(calls[0]).toMatchObject({ name: nativeName, child: undefined });
    const binding = calls[0]!.attributes[property] as { get(): string };
    let rendered = '';
    const stop = effect(() => { rendered = binding.get(); });
    expect(rendered).toBe('document-save-symbolic');
    icon.iconName = 'document-open-symbolic';
    expect(rendered).toBe('document-open-symbolic');
    stop();
  });
});
