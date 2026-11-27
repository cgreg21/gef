import { checkGtpl } from '../gtpl/check.js';
import type { GtplNode } from '../gtpl/ast/types.js';
import type { Diagnostic } from '../gtpl/diagnostics/diagnostic.js';
import { emitGtplTemplateWithSourceMap, type GtplSourceMap } from '../gtpl/codegen/template.js';
import type { GtplComponentDefinition } from '../gtpl/validation/components.js';
import { getComponentMetadata, type ComponentMetadata } from './api.js';
import { compileGtplToUiIr, type GtplUiIrResult } from '../ir/ui.js';

export interface ComponentCompileOptions {
  /** All instance members available to the component template. */
  readonly componentMembers: readonly string[];
  readonly globals?: readonly string[];
  readonly components?: readonly GtplComponentDefinition[];
  readonly strictComponents?: boolean;
  readonly contextType?: string;
}

export interface ComponentCompileResult {
  readonly metadata: ComponentMetadata;
  readonly nodes: readonly GtplNode[];
  readonly diagnostics: readonly Diagnostic[];
  readonly renderSource?: string;
  readonly renderSourceMap?: GtplSourceMap;
}

/** Validates a decorated component template and emits its render-function source. */
export function compileGtplComponent(
  type: Function,
  options: ComponentCompileOptions,
  templateSource?: string,
): ComponentCompileResult {
  const metadata = getComponentMetadata(type);
  if (!metadata) throw new TypeError('Cannot compile a class without @Component metadata.');

  if (metadata.templateUrl && templateSource === undefined) {
    throw new TypeError(`Component "${metadata.selector}" uses templateUrl; provide the loaded template source.`);
  }
  if (!metadata.templateUrl && templateSource !== undefined) {
    throw new TypeError(`Component "${metadata.selector}" declares an inline template, not templateUrl.`);
  }
  const source = templateSource ?? metadata.template;
  const checked = checkGtpl(source, options);
  if (checked.diagnostics.length > 0) {
    return { metadata, nodes: checked.nodes, diagnostics: checked.diagnostics };
  }
  const generated = emitGtplTemplateWithSourceMap(checked.nodes, {
    ...options,
    source: metadata.templateUrl ?? metadata.selector + '.gtpl',
    sourceContent: source,
  });
  return {
    metadata,
    nodes: checked.nodes,
    diagnostics: checked.diagnostics,
    renderSource: generated.code,
    renderSourceMap: generated.map,
  };
}

export interface ComponentUiIrOptions {
  readonly componentMembers?: readonly string[];
  readonly globals?: readonly string[];
  readonly componentTypes?: readonly Function[];
  readonly contextType?: string;
  /** Native element names accepted alongside decorated components. */
  readonly nativeElements?: readonly string[];
}

export interface ComponentUiIrResult extends GtplUiIrResult {
  readonly metadata: ComponentMetadata;
}

/** Compiles a decorated component template and validates child component contracts. */
export function compileGtplComponentToUiIr(
  type: Function,
  options: ComponentUiIrOptions = {},
  templateSource?: string,
): ComponentUiIrResult {
  const metadata = getComponentMetadata(type);
  if (!metadata) throw new TypeError('Cannot compile a class without @Component metadata.');
  if (metadata.templateUrl && templateSource === undefined) {
    throw new TypeError(`Component "${metadata.selector}" uses templateUrl; provide the loaded template source.`);
  }
  if (!metadata.templateUrl && templateSource !== undefined) {
    throw new TypeError(`Component "${metadata.selector}" declares an inline template, not templateUrl.`);
  }

  const definitions = [type, ...(options.componentTypes ?? [])].map((componentType) => {
    const component = getComponentMetadata(componentType);
    if (!component) throw new TypeError('Every component type must have @Component metadata.');
    return { selector: component.selector, inputs: component.inputs, outputs: component.outputs };
  });
  const selectors = new Set<string>();
  for (const component of definitions) {
    if (selectors.has(component.selector)) {
      throw new TypeError(`Duplicate component selector "${component.selector}" in the UI IR component set.`);
    }
    selectors.add(component.selector);
  }

  const result = compileGtplToUiIr(templateSource ?? metadata.template, {
    ...(options.componentMembers ? { componentMembers: options.componentMembers } : {}),
    ...(options.globals ? { globals: options.globals } : {}),
    ...(options.contextType ? { contextType: options.contextType } : {}),
    components: definitions,
    strictComponents: true,
    ...(options.nativeElements ? { nativeElements: options.nativeElements } : {}),
  });
  return { ...result, metadata };
}


export interface ComponentProjectEntry {
  readonly type: Function;
  readonly componentMembers?: readonly string[];
  readonly contextType?: string;
  /** Source for components that declare templateUrl. */
  readonly templateSource?: string;
}

export interface ComponentProjectUiIrOptions {
  readonly components: readonly ComponentProjectEntry[];
  readonly globals?: readonly string[];
  /** Native element names shared by every component template in this project. */
  readonly nativeElements?: readonly string[];
}

export interface ComponentProjectUiIrResult {
  readonly success: boolean;
  readonly components: readonly ComponentUiIrResult[];
}

/**
 * Compiles a set of decorated components against one shared selector registry.
 * Each component is compiled even when another template has diagnostics.
 */
export function compileGtplComponentsToUiIr(
  options: ComponentProjectUiIrOptions,
): ComponentProjectUiIrResult {
  if (options.components.length === 0) {
    throw new TypeError('At least one component is required to compile a UI IR project.');
  }

  const types = options.components.map(({ type }) => type);
  const selectors = new Set<string>();
  for (const type of types) {
    const metadata = getComponentMetadata(type);
    if (!metadata) throw new TypeError('Every project component must have @Component metadata.');
    if (selectors.has(metadata.selector)) {
      throw new TypeError(`Duplicate component selector "${metadata.selector}" in the UI IR project.`);
    }
    selectors.add(metadata.selector);
  }

  const components = options.components.map((entry) => compileGtplComponentToUiIr(
    entry.type,
    {
      ...(entry.componentMembers ? { componentMembers: entry.componentMembers } : {}),
      ...(entry.contextType ? { contextType: entry.contextType } : {}),
      ...(options.globals ? { globals: options.globals } : {}),
      ...(options.nativeElements ? { nativeElements: options.nativeElements } : {}),
      componentTypes: types.filter((type) => type !== entry.type),
    },
    entry.templateSource,
  ));

  return {
    success: components.every((component) => component.success),
    components,
  };
}
