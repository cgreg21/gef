import type { UiElement, UiNode } from '../../ir/ui.js';

export interface GtkCResult {
  readonly success: boolean;
  readonly source: string;
  readonly diagnostics: readonly string[];
}

const alignments = ['fill', 'start', 'end', 'center', 'baseline'] as const;
const margins = ['marginTop', 'marginBottom', 'marginStart', 'marginEnd'] as const;
const booleanValues = ['true', 'false'];

function cString(value: string): string {
  return JSON.stringify(value).replace(/\\u2028/g, '\\u2028').replace(/\\u2029/g, '\\u2029');
}

function staticProperty(element: UiElement, name: string): string | undefined {
  const property = element.properties.find((item) => item.name === name);
  if (!property) return undefined;
  if (property.value.kind === 'static') return property.value.value;
  const expression = property.value.expression;
  if (expression.kind === 'literal' && expression.value !== null) return String(expression.value);
  return undefined;
}

function emitCommonProperties(element: UiElement, id: string, lines: string[], report: (message: string) => void): void {
  for (const name of margins) {
    const value = staticProperty(element, name);
    if (value === undefined) continue;
    if (!/^[0-9]+$/.test(value)) {
      report(`${element.component} ${name} must be a non-negative integer; received "${value}".`);
      continue;
    }
    const setter = name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    lines.push(`gtk_widget_set_${setter}(${id}, ${value});`);
  }

  for (const name of ['halign', 'valign'] as const) {
    const value = staticProperty(element, name);
    if (value === undefined) continue;
    if (!(alignments as readonly string[]).includes(value)) {
      report(`${element.component} ${name} must be one of: ${alignments.join(', ')}; received "${value}".`);
      continue;
    }
    lines.push(`gtk_widget_set_${name}(${id}, GTK_ALIGN_${value.toUpperCase()});`);
  }

  const visible = staticProperty(element, 'visible');
  if (visible !== undefined) {
    if (!['true', 'false'].includes(visible)) {
      report(`${element.component} visible must be "true" or "false"; received "${visible}".`);
    } else {
      lines.push(`gtk_widget_set_visible(${id}, ${visible});`);
    }
  }
}

/** Emit a small, deliberately static GTK4 C application from UI IR. */
export function emitGtkC(nodes: readonly UiNode[]): GtkCResult {
  const diagnostics: string[] = [];
  const lines: string[] = [];
  let nextId = 0;
  const report = (message: string): void => { diagnostics.push(message); };
  const commonProperties = [...margins, 'halign', 'valign', 'visible'];

  function emitElement(element: UiElement, parent?: string): string | undefined {
    if (!['GtkBox', 'GtkLabel', 'GtkButton', 'GtkEntry', 'GtkCheckButton'].includes(element.component)) {
      report(`Unsupported GTK element "${element.component}".`);
      return undefined;
    }
    if (element.events.length || element.references.length) {
      report(`${element.component} events and references are not supported by the static C backend.`);
    }
    for (const property of element.properties) {
      if (property.value.kind === 'binding'
        && (property.value.expression.kind !== 'literal' || property.value.expression.value === null)) {
        report(`Dynamic property "${property.name}" is not supported by the static C backend; only non-null literal bindings are supported.`);
      }
    }

    const id = `widget_${nextId++}`;
    const label = staticProperty(element, 'label');
    const text = staticProperty(element, 'text');
    if (element.component === 'GtkBox') {
      const orientation = staticProperty(element, 'orientation') ?? 'horizontal';
      const spacing = staticProperty(element, 'spacing') ?? '0';
      if (!['horizontal', 'vertical'].includes(orientation)) report(`Invalid GtkBox orientation "${orientation}".`);
      if (!/^-?[0-9]+$/.test(spacing)) report(`GtkBox spacing must be an integer; received "${spacing}".`);
      for (const property of element.properties) {
        if (!['orientation', 'spacing', ...commonProperties].includes(property.name)) {
          report(`Unsupported GtkBox property "${property.name}".`);
        }
      }
      lines.push(`GtkWidget *${id} = gtk_box_new(GTK_ORIENTATION_${orientation.toUpperCase()}, ${/^-?[0-9]+$/.test(spacing) ? spacing : '0'});`);
    } else if (element.component === 'GtkLabel') {
      for (const property of element.properties) {
        if (property.name !== 'label' && !commonProperties.includes(property.name)) report(`Unsupported GtkLabel property "${property.name}".`);
      }
      const childText = element.children.filter((node) => node.kind === 'text')
        .flatMap((node) => node.parts)
        .map((part) => part.kind === 'text' ? part.value : '');
      const hasExpression = element.children.some((node) => node.kind === 'text'
        && node.parts.some((part) => part.kind === 'expression'));
      if (hasExpression) report('GtkLabel interpolation is not supported by the static C backend.');
      if (element.children.some((node) => node.kind !== 'text')) report('GtkLabel element children are not supported by the static C backend.');
      const content = childText.join('');
      if (label !== undefined && content.trim()) report('GtkLabel cannot combine a label property with child text.');
      lines.push(`GtkWidget *${id} = gtk_label_new(${cString(label ?? content)});`);
    } else if (element.component === 'GtkButton' || element.component === 'GtkCheckButton') {
      for (const property of element.properties) {
        if (property.name !== 'label' && !(element.component === 'GtkCheckButton' && property.name === 'active') && !commonProperties.includes(property.name)) report(`Unsupported ${element.component} property "${property.name}".`);
      }
      if (element.children.length) report(`${element.component} child nodes are not supported; use its static label property.`);
      const constructor = element.component === 'GtkButton' ? 'gtk_button_new_with_label' : 'gtk_check_button_new_with_label';
      lines.push(`GtkWidget *${id} = ${constructor}(${cString(label ?? '')});`);
      if (element.component === 'GtkCheckButton') {
        const active = staticProperty(element, 'active');
        if (active !== undefined) {
          if (!booleanValues.includes(active)) report(`GtkCheckButton active must be "true" or "false"; received "${active}".`);
          else lines.push(`gtk_check_button_set_active(GTK_CHECK_BUTTON(${id}), ${active});`);
        }
      }
    } else {
      for (const property of element.properties) {
        if (!['text', 'placeholderText', 'editable', 'visibility'].includes(property.name) && !commonProperties.includes(property.name)) report(`Unsupported GtkEntry property "${property.name}".`);
      }
      if (element.children.length) report('GtkEntry child nodes are not supported.');
      lines.push(`GtkWidget *${id} = gtk_entry_new();`);
      if (text !== undefined) lines.push(`gtk_editable_set_text(GTK_EDITABLE(${id}), ${cString(text)});`);
      const placeholder = staticProperty(element, 'placeholderText');
      if (placeholder !== undefined) lines.push(`gtk_entry_set_placeholder_text(GTK_ENTRY(${id}), ${cString(placeholder)});`);
      for (const name of ['editable', 'visibility'] as const) {
        const value = staticProperty(element, name);
        if (value === undefined) continue;
        if (!booleanValues.includes(value)) report(`GtkEntry ${name} must be "true" or "false"; received "${value}".`);
        else if (name === 'editable') lines.push(`gtk_editable_set_editable(GTK_EDITABLE(${id}), ${value});`);
        else lines.push(`gtk_entry_set_visibility(GTK_ENTRY(${id}), ${value});`);
      }
    }

    emitCommonProperties(element, id, lines, report);
    if (parent) lines.push(`gtk_box_append(GTK_BOX(${parent}), ${id});`);
    if (element.component === 'GtkBox') {
      for (const child of element.children) {
        if (child.kind === 'element') emitElement(child, id);
        else if (child.kind !== 'text' || child.parts.some((part) => part.kind !== 'text' || part.value.trim())) {
          report(`GtkBox child node "${child.kind}" is not supported by the static C backend.`);
        }
      }
    }
    return id;
  }

  const roots = nodes.filter((node) => node.kind !== 'text'
    || node.parts.some((part) => part.kind !== 'text' || part.value.trim()));
  if (roots.length !== 1 || roots[0]?.kind !== 'element') {
    report('The GTK C backend requires exactly one root element.');
  } else {
    const root = emitElement(roots[0]);
    if (root) lines.push(`gtk_window_set_child(GTK_WINDOW(window), ${root});`);
  }

  const source = [
    '#include <gtk/gtk.h>',
    '',
    'static void activate(GtkApplication *app, gpointer user_data) {',
    '  (void) user_data;',
    '  GtkWidget *window = gtk_application_window_new(app);',
    ...lines.map((line) => `  ${line}`),
    '  gtk_window_present(GTK_WINDOW(window));',
    '}',
    '',
    'int main(int argc, char **argv) {',
    '  GtkApplication *app = gtk_application_new("org.gef.generated", G_APPLICATION_DEFAULT_FLAGS);',
    '  g_signal_connect(app, "activate", G_CALLBACK(activate), NULL);',
    '  int status = g_application_run(G_APPLICATION(app), argc, argv);',
    '  g_object_unref(app);',
    '  return status;',
    '}',
    '',
  ].join(String.fromCharCode(10));

  return { success: diagnostics.length === 0, source: diagnostics.length ? '' : source, diagnostics };
}
