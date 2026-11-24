import { Component, Input } from '../../shared/src/components/metadata.js';
import { ComponentRegistry } from '../../runtime/src/components/component-registry.js';
import type { GtkActor } from '../../runtime/src/renderers/gtk/gtk-render-host.js';
import type { GtplRenderRuntime } from '../../runtime/src/rendering/gtpl-runtime.js';

export class MetricCardComponent {
  title = '';
  value = '';
  detail = '';
}

Input()(MetricCardComponent.prototype, 'title');
Input()(MetricCardComponent.prototype, 'value');
Input()(MetricCardComponent.prototype, 'detail');
Component({
  selector: 'GefMetricCard',
  template: '<GtkLabel />',
})(MetricCardComponent);

export class SectionHeaderComponent {
  title = '';
  description = '';
}

Input()(SectionHeaderComponent.prototype, 'title');
Input()(SectionHeaderComponent.prototype, 'description');
Component({
  selector: 'GefSectionHeader',
  template: '<GtkLabel />',
})(SectionHeaderComponent);

function renderMetricCard(
  component: MetricCardComponent,
  runtime: GtplRenderRuntime<GtkActor>,
): GtkActor {
  return runtime.element('GtkLabel', {
    label: `${component.title}\n${component.value}\n${component.detail}`,
    xalign: 0,
    wrap: true,
  }, undefined);
}

function renderSectionHeader(
  component: SectionHeaderComponent,
  runtime: GtplRenderRuntime<GtkActor>,
): GtkActor {
  return runtime.element('GtkLabel', {
    label: `${component.title}\n${component.description}`,
    xalign: 0,
    wrap: true,
  }, undefined);
}

export function createKitchenSinkComponents(): ComponentRegistry<GtkActor> {
  return new ComponentRegistry<GtkActor>()
    .registerType(MetricCardComponent, {
      create: () => new MetricCardComponent(),
      render: renderMetricCard,
    })
    .registerType(SectionHeaderComponent, {
      create: () => new SectionHeaderComponent(),
      render: renderSectionHeader,
    });
}
