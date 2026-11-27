import { Component, Input } from '../../shared/src/components/metadata.js';
import { ComponentRegistry } from '../../runtime/src/components/component-registry.js';
import type { GtkActor } from '../../runtime/src/renderers/gtk/gtk-render-host.js';
import type { GtplRenderRuntime } from '../../runtime/src/rendering/gtpl-runtime.js';
import { createGtkUiRegistry } from '../../ui/src/platform/gtk.js';

@Component({ selector: 'GefMetricCard', template: '<GtkLabel />' })
export class MetricCardComponent {
  @Input() title = '';
  @Input() value = '';
  @Input() detail = '';
}

@Component({ selector: 'GefSectionHeader', template: '<GtkLabel />' })
export class SectionHeaderComponent {
  @Input() title = '';
  @Input() description = '';
}

function renderMetricCard(
  component: MetricCardComponent,
  runtime: GtplRenderRuntime<GtkActor>,
): GtkActor {
  return runtime.element('GtkLabel', {
    label: `${component.title}\\n${component.value}\\n${component.detail}`,
    xalign: 0,
    wrap: true,
  }, undefined);
}

function renderSectionHeader(
  component: SectionHeaderComponent,
  runtime: GtplRenderRuntime<GtkActor>,
): GtkActor {
  return runtime.element('GtkLabel', {
    label: `${component.title}\\n${component.description}`,
    xalign: 0,
    wrap: true,
  }, undefined);
}

export function createKitchenSinkComponents(): ComponentRegistry<GtkActor> {
  return createGtkUiRegistry()
    .registerType(MetricCardComponent, renderMetricCard)
    .registerType(SectionHeaderComponent, renderSectionHeader);
}
