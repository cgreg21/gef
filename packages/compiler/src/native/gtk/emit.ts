import type { ExpressionNode } from '../../gtpl/ast/expression.js';
import type { UiElement, UiNode } from '../../ir/ui.js';

export interface GtkCOptions {
  /** Maps TypeScript handler method names to externally implemented C callback symbols. */
  readonly callbacks?: Readonly<Record<string, string>>;
}

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

type StaticValue = string | number | boolean | null;

function evaluateStaticExpression(expression: ExpressionNode): StaticValue | undefined {
  if (expression.kind === 'literal') {
    return typeof expression.value === 'number' && !Number.isFinite(expression.value)
      ? undefined
      : expression.value;
  }
  if (expression.kind === 'unary') {
    const value = evaluateStaticExpression(expression.argument);
    if (expression.operator === '!' && typeof value === 'boolean') return !value;
    if (expression.operator === '+' && typeof value === 'number') return value;
    if (expression.operator === '-' && typeof value === 'number') {
      const result = -value;
      return Number.isFinite(result) ? result : undefined;
    }
    return undefined;
  }
  if (expression.kind === 'conditional') {
    const test = evaluateStaticExpression(expression.test);
    if (typeof test !== 'boolean') return undefined;
    return evaluateStaticExpression(test ? expression.consequent : expression.alternate);
  }
  if (expression.kind !== 'binary') return undefined;
  const left = evaluateStaticExpression(expression.left);
  const right = evaluateStaticExpression(expression.right);
  if (left === undefined || right === undefined) return undefined;
  const operator = expression.operator;
  if (operator === '&&' || operator === '||' || operator === '??') {
    if (operator === '??') return left ?? right;
    if (typeof left !== 'boolean' || typeof right !== 'boolean') return undefined;
    return operator === '&&' ? left && right : left || right;
  }
  if (operator === '===' || operator === '!==') {
    const equal = typeof left === typeof right && left === right;
    return operator === '===' ? equal : !equal;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    switch (operator) {
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      default: {
        let result: number;
        switch (operator) {
          case '+': result = left + right; break;
          case '-': result = left - right; break;
          case '*': result = left * right; break;
          case '/': if (right === 0) return undefined; result = left / right; break;
          case '%': if (right === 0) return undefined; result = left % right; break;
          case '**': result = left ** right; break;
          default: return undefined;
        }
        return Number.isFinite(result) ? result : undefined;
      }
    }
  }
  if (operator === '+' && typeof left === 'string' && typeof right === 'string') return left + right;
  return undefined;
}

function staticProperty(element: UiElement, name: string): string | undefined {
  const property = element.properties.find((item) => item.name === name);
  if (!property) return undefined;
  if (property.value.kind === 'static') return property.value.value;
  const value = evaluateStaticExpression(property.value.expression);
  return value === undefined || value === null ? undefined : String(value);
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
export function emitGtkC(nodes: readonly UiNode[], options: GtkCOptions = {}): GtkCResult {
  const diagnostics: string[] = [];
  const lines: string[] = [];
  let nextId = 0;
  const callbackSymbols = new Set<string>();
  const report = (message: string): void => { diagnostics.push(message); };
  const commonProperties = [...margins, 'halign', 'valign', 'visible'];

  function emitElement(element: UiElement, parent?: { id: string; component: string }, position?: { row: number; column: number; rowSpan: number; columnSpan: number }): string | undefined {
    if (!['GtkBox', 'GtkGrid', 'GtkLabel', 'GtkButton', 'GtkEntry', 'GtkCheckButton'].includes(element.component)) {
      report(`Unsupported GTK element "${element.component}".`);
      return undefined;
    }
    if (element.references.length) {
      report(`${element.component} references are not supported by the static C backend.`);
    }
    for (const property of element.properties) {
      if (property.value.kind === 'binding' && staticProperty(element, property.name) === undefined) {
        report(`Property binding "${property.name}" is not a compile-time constant supported by the static C backend.`);
      }
    }

    const id = `widget_${nextId++}`;
    const placementProperties = parent?.component === 'GtkGrid' ? ['row', 'column', 'rowSpan', 'columnSpan'] : [];
    const label = staticProperty(element, 'label');
    const text = staticProperty(element, 'text');
    if (element.component === 'GtkGrid') {
      for (const property of element.properties) {
        if (!commonProperties.includes(property.name)) report(`Unsupported GtkGrid property "${property.name}".`);
      }
      lines.push(`GtkWidget *${id} = gtk_grid_new();`);
    } else if (element.component === 'GtkBox') {
      const orientation = staticProperty(element, 'orientation') ?? 'horizontal';
      const spacing = staticProperty(element, 'spacing') ?? '0';
      if (!['horizontal', 'vertical'].includes(orientation)) report(`Invalid GtkBox orientation "${orientation}".`);
      if (!/^-?[0-9]+$/.test(spacing)) report(`GtkBox spacing must be an integer; received "${spacing}".`);
      for (const property of element.properties) {
        if (!['orientation', 'spacing', ...commonProperties, ...placementProperties].includes(property.name)) {
          report(`Unsupported GtkBox property "${property.name}".`);
        }
      }
      lines.push(`GtkWidget *${id} = gtk_box_new(GTK_ORIENTATION_${orientation.toUpperCase()}, ${/^-?[0-9]+$/.test(spacing) ? spacing : '0'});`);
    } else if (element.component === 'GtkLabel') {
      for (const property of element.properties) {
        if (property.name !== 'label' && ![...commonProperties, ...placementProperties].includes(property.name)) report(`Unsupported GtkLabel property "${property.name}".`);
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
        if (property.name !== 'label' && !(element.component === 'GtkCheckButton' && property.name === 'active') && ![...commonProperties, ...placementProperties].includes(property.name)) report(`Unsupported ${element.component} property "${property.name}".`);
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
        if (!['text', 'placeholderText', 'editable', 'visibility'].includes(property.name) && ![...commonProperties, ...placementProperties].includes(property.name)) report(`Unsupported GtkEntry property "${property.name}".`);
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

    for (const event of element.events) {
      if (element.component !== 'GtkButton' || event.name !== 'clicked'
        || event.handler.kind !== 'call' || event.handler.optional
        || event.handler.arguments.length !== 0 || event.handler.callee.kind !== 'member'
        || event.handler.callee.optional || event.handler.callee.computed
        || event.handler.callee.object.kind !== 'identifier'
        || event.handler.callee.object.name !== 'this'
        || typeof event.handler.callee.property !== 'string') {
        report(`${element.component} event "${event.name}" requires a zero-argument this.method() handler on GtkButton.`);
        continue;
      }
      const method = event.handler.callee.property;
      const symbol = options.callbacks?.[method];
      if (!symbol || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(symbol)) {
        report(`GtkButton event handler "${method}" requires a valid native callback symbol in GtkCOptions.callbacks.`);
        continue;
      }
      callbackSymbols.add(symbol);
      lines.push(`g_signal_connect(${id}, "clicked", G_CALLBACK(${symbol}), NULL);`);
    }

    emitCommonProperties(element, id, lines, report);
    if (parent) {
      if (parent.component === 'GtkGrid' && position) {
        lines.push(`gtk_grid_attach(GTK_GRID(${parent.id}), ${id}, ${position.column}, ${position.row}, ${position.columnSpan}, ${position.rowSpan});`);
      } else if (parent.component === 'GtkBox') {
        lines.push(`gtk_box_append(GTK_BOX(${parent.id}), ${id});`);
      } else {
        report(`${parent.component} cannot contain child widgets.`);
      }
    }
    if (element.component === 'GtkBox' || element.component === 'GtkGrid') {
      let childIndex = 0;
      for (const child of element.children) {
        if (child.kind === 'element') {
          if (element.component === 'GtkGrid') {
            const readCoordinate = (name: string, fallback: number, minimum: number): number => {
              const value = staticProperty(child, name);
              if (value === undefined) return fallback;
              if (!/^[0-9]+$/.test(value) || Number(value) < minimum) {
                report(`GtkGrid child ${name} must be an integer greater than or equal to ${minimum}; received "${value}".`);
                return fallback;
              }
              return Number(value);
            };
            const childPosition = {
              row: readCoordinate('row', 0, 0),
              column: readCoordinate('column', childIndex, 0),
              rowSpan: readCoordinate('rowSpan', 1, 1),
              columnSpan: readCoordinate('columnSpan', 1, 1),
            };
            emitElement(child, { id, component: element.component }, childPosition);
          } else {
            emitElement(child, { id, component: element.component });
          }
          childIndex++;
        }
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
    ...[...callbackSymbols].sort().map((symbol) => `extern void ${symbol}(GtkButton *button, gpointer user_data);`),
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
