import { describe, expect, it } from 'vitest';
import { getComponentMetadata } from '../../../../shared/src/components/metadata.js';
import { Injector } from '../../../../runtime/src/di/injector.js';
import type { GtplRenderRuntime } from '../../../../runtime/src/rendering/gtpl-runtime.js';
import type { StActor } from '../../../../runtime/src/renderers/gnome-shell/st-render-host.js';
import type { GtkActor } from '../../../../runtime/src/renderers/gtk/gtk-render-host.js';
import { createStUiRegistry } from '../../platform/gnome-shell.js';
import { createGtkUiRegistry } from '../../platform/gtk.js';
import { GefIcon } from './icon.component.js';

function createRuntime<Node>() {
  const element = (name: string, attributes: Readonly<Record<string, unknown>>, child: Node | undefined) => {
    calls.push({ name, attributes, child });
    return {} as Node;
  };
  const calls: Array<{ name: string; attributes: Readonly<Record<string, unknown>>; child: Node | undefined }> = [];
  const bind = <T>(get: () => T) => ({ kind: 'binding' as const, get });
  return {
    runtime: { element, bind } as unknown as GtplRenderRuntime<Node>,
    calls,
  };
}

describe('GefIcon', () => {
  it('declares a reactive iconName input', () => {
    expect(getComponentMetadata(GefIcon)).toMatchObject({
      selector: 'GefIcon',
      inputs: ['iconName'],
      outputs: [],
    });
  });

  it('renders a reactive icon name as a native St icon', () => {
    const definition = createStUiRegistry().match('GefIcon', {});
    expect(definition).toBeDefined();
    const icon = definition!.create(new Injector()) as GefIcon;
    icon.iconName = 'document-save-symbolic';
    const { runtime, calls } = createRuntime<StActor>();

    definition!.render(icon, runtime);

    expect(calls[0]).toMatchObject({ name: 'StIcon', child: undefined });
    const binding = calls[0]!.attributes['icon-name'] as { get(): string };
    expect(binding.get()).toBe('document-save-symbolic');
    icon.iconName = 'document-open-symbolic';
    expect(binding.get()).toBe('document-open-symbolic');
  });

  it('renders a reactive icon name as a native GTK image', () => {
    const definition = createGtkUiRegistry().match('GefIcon', {});
    expect(definition).toBeDefined();
    const icon = definition!.create(new Injector()) as GefIcon;
    icon.iconName = 'document-save-symbolic';
    const { runtime, calls } = createRuntime<GtkActor>();

    definition!.render(icon, runtime);

    expect(calls[0]).toMatchObject({ name: 'GtkImage', child: undefined });
    const binding = calls[0]!.attributes['icon-name'] as { get(): string };
    expect(binding.get()).toBe('document-save-symbolic');
    icon.iconName = 'document-open-symbolic';
    expect(binding.get()).toBe('document-open-symbolic');
  });
});
