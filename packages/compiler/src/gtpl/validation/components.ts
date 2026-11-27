import type { ElementNode, GtplNode } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/diagnostic.js';

export interface GtplComponentDefinition {
  readonly selector: string;
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
}

export interface GtplComponentValidationOptions {
  readonly components: readonly GtplComponentDefinition[];
  /** Explicit native element names accepted alongside registered components. */
  readonly nativeElements?: readonly string[];
  /** Unknown elements are allowed by default for native St actors. */
  readonly strict?: boolean;
}

export function validateGtplComponents(nodes: readonly GtplNode[], options: GtplComponentValidationOptions): readonly Diagnostic[] {
  const registry = new Map(options.components.map((component) => [component.selector, component]));
  const nativeElements = new Set(options.nativeElements ?? []);
  const diagnostics: Diagnostic[] = [];
  const visit = (node: GtplNode): void => {
    if (node.kind === 'element') {
      validateElement(node, registry, nativeElements, options.strict ?? false, diagnostics);
      node.children.forEach(visit);
    } else if (node.kind === 'if-block') {
      node.branches.forEach((branch) => branch.children.forEach(visit));
    } else if (node.kind === 'for-block') {
      node.children.forEach(visit);
      node.empty.forEach(visit);
    } else if (node.kind === 'switch-block') {
      node.cases.forEach((branch) => branch.children.forEach(visit));
      node.defaultCase?.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return diagnostics;
}

function validateElement(
  node: ElementNode,
  registry: ReadonlyMap<string, GtplComponentDefinition>,
  nativeElements: ReadonlySet<string>,
  strict: boolean,
  diagnostics: Diagnostic[],
): void {
  const component = registry.get(node.name);
  if (!component) {
    if (strict && !nativeElements.has(node.name)) diagnostics.push({ code: 'GTPL4101', message: `Unknown component selector "${node.name}".`, span: node.span });
    return;
  }
  const inputs = new Set(component.inputs ?? []);
  const outputs = new Set(component.outputs ?? []);
  for (const attribute of node.attributes) {
    if (attribute.kind === 'property' && !inputs.has(attribute.name)) {
      diagnostics.push({ code: 'GTPL4102', message: `Component "${node.name}" has no input named "${attribute.name}".`, span: attribute.span });
    } else if (attribute.kind === 'event' && !outputs.has(attribute.name)) {
      diagnostics.push({ code: 'GTPL4103', message: `Component "${node.name}" has no output named "${attribute.name}".`, span: attribute.span });
    } else if (attribute.kind === 'two-way') {
      if (!inputs.has(attribute.name)) diagnostics.push({ code: 'GTPL4102', message: `Component "${node.name}" has no input named "${attribute.name}".`, span: attribute.span });
      if (!outputs.has(`${attribute.name}Change`)) diagnostics.push({ code: 'GTPL4103', message: `Component "${node.name}" has no output named "${attribute.name}Change".`, span: attribute.span });
    }
  }
}
