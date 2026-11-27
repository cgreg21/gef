import type { UiElement, UiNode } from '../../ir/ui.js';

export interface GtkCResult {
  readonly success: boolean;
  readonly source: string;
  readonly diagnostics: readonly string[];
}

function cString(value: string): string {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function staticProperty(element: UiElement, name: string): string | undefined {
  const property = element.properties.find((item) => item.name === name);
  if (!property) return undefined;
  if (property.value.kind !== 'static') return undefined;
  return property.value.value;
}

/** Emit a small, deliberately static GTK4 C application from UI IR. */
export function emitGtkC(nodes: readonly UiNode[]): GtkCResult {
  const diagnostics: string[] = [];
  const lines: string[] = [];
  let nextId = 0;

  const report = (message: string): void => { diagnostics.push(message); };

  function emitElement(element: UiElement, parent?: string): string | undefined {
    if (!['GtkBox', 'GtkLabel', 'GtkButton'].includes(element.component)) {
      report(`Unsupported GTK element "${element.component}".`);
      return undefined;
    }
    if (element.events.length || element.references.length) {
      report(`${element.component} events and references are not supported by the static C backend.`);
    }
    for (const property of element.properties) {
      if (property.value.kind !== 'static') {
        report(`Dynamic property "${property.name}" is not supported by the static C backend.`);
      }
    }

    const id = `widget_${nextId++}`;
    const label = staticProperty(element, 'label');
    if (element.component === 'GtkBox') {
      const orientation = staticProperty(element, 'orientation') ?? 'horizontal';
      const spacing = staticProperty(element, 'spacing') ?? '0';
      if (!['horizontal', 'vertical'].includes(orientation)) report(`Invalid GtkBox orientation "${orientation}".`);
      if (!/^-?[0-9]+$/.test(spacing)) report(`GtkBox spacing must be an integer; received "${spacing}".`);
      for (const property of element.properties) {
        if (!['orientation', 'spacing'].includes(property.name)) report(`Unsupported GtkBox property "${property.name}".`);
      }
      lines.push(`GtkWidget *${id} = gtk_box_new(GTK_ORIENTATION_${orientation.toUpperCase()}, ${/^-?[0-9]+$/.test(spacing) ? spacing : '0'});`);
    } else {
      for (const property of element.properties) {
        if (property.name !== 'label') report(`Unsupported ${element.component} property "${property.name}".`);
      }
      if (element.component === 'GtkLabel') {
        const text = element.children.filter((node) => node.kind === 'text')
          .flatMap((node) => node.parts)
          .map((part) => part.kind === 'text' ? part.value : '');
        const hasExpression = element.children.some((node) => node.kind === 'text'
          && node.parts.some((part) => part.kind === 'expression'));
        if (hasExpression) report('GtkLabel interpolation is not supported by the static C backend.');
        if (element.children.some((node) => node.kind !== 'text')) report('GtkLabel element children are not supported by the static C backend.');
        const content = text.join('');
        if (label !== undefined && content.trim()) report('GtkLabel cannot combine a label property with child text.');
        lines.push(`GtkWidget *${id} = gtk_label_new(${cString(label ?? content)});`);
      } else {
        if (element.children.length) report('GtkButton child nodes are not supported; use its static label property.');
        lines.push(`GtkWidget *${id} = gtk_button_new_with_label(${cString(label ?? '')});`);
      }
    }

    if (parent) {
      const parentElement = parent;
      lines.push(`gtk_box_append(GTK_BOX(${parentElement}), ${id});`);
    }
    if (element.component === 'GtkBox') {
      for (const child of element.children) {
        if (child.kind === 'element') emitElement(child, id);
        else if (child.kind !== 'text' || child.parts.some((part) => part.kind !== 'text' || part.value.trim())) {
          report(`GtkBox child node "${child.kind}" is not supported by the static C backend.`);
        }
      }
    } else if (element.component !== 'GtkLabel') {
      // Child validation is handled above for buttons.
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
