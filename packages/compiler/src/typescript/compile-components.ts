import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type * as ts from 'typescript';
import type { Diagnostic } from '../gtpl/diagnostics/diagnostic.js';
import { compileGtplToUiIr, type UiNode } from '../ir/ui.js';
import type { TypeScriptComponentDescriptor } from './components.js';
import { discoverTypeScriptComponents, type TypeScriptComponentDiscoveryOptions } from './components.js';

export interface TypeScriptComponentProjectOptions extends TypeScriptComponentDiscoveryOptions {
  /** External templates keyed by their resolved path relative to the declaring TypeScript file. */
  readonly templateSources?: Readonly<Record<string, string>>;
  readonly globals?: readonly string[];
  readonly nativeElements?: readonly string[];
  readonly contextType?: string;
}

export interface TypeScriptComponentUiIr {
  readonly component: TypeScriptComponentDescriptor;
  readonly nodes: readonly UiNode[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface TypeScriptComponentProjectUiIrResult {
  readonly success: boolean;
  readonly components: readonly TypeScriptComponentUiIr[];
  readonly discoveryDiagnostics: readonly ts.Diagnostic[];
}

/** Discovers and compiles project components without importing application modules. */
export function compileTypeScriptComponentsToUiIr(
  options: TypeScriptComponentProjectOptions = {},
): TypeScriptComponentProjectUiIrResult {
  const discovered = discoverTypeScriptComponents(options);
  if (!discovered.success) {
    return { success: false, components: [], discoveryDiagnostics: discovered.diagnostics };
  }
  if (discovered.components.length === 0) {
    throw new TypeError('No @Component classes were found in the TypeScript project.');
  }

  const selectors = new Set<string>();
  for (const component of discovered.components) {
    if (selectors.has(component.selector)) {
      throw new TypeError(`Duplicate component selector "${component.selector}" in the TypeScript project.`);
    }
    selectors.add(component.selector);
  }

  const definitions = discovered.components.map((component) => ({
    selector: component.selector,
    inputs: component.inputs,
    outputs: component.outputs,
  }));

  const components = discovered.components.map((component): TypeScriptComponentUiIr => {
    let source = component.template ?? '';
    if (component.templateUrl) {
      const templatePath = resolve(dirname(component.fileName), component.templateUrl);
      source = options.templateSources?.[templatePath];
      if (source === undefined) {
        try {
          source = readFileSync(templatePath, 'utf8');
        } catch {
          throw new TypeError(`Cannot read template for component "${component.selector}" at "${templatePath}".`);
        }
      }
    }
    const result = compileGtplToUiIr(source, {
      componentMembers: component.componentMembers,
      components: definitions,
      strictComponents: true,
      ...(options.globals ? { globals: options.globals } : {}),
      ...(options.nativeElements ? { nativeElements: options.nativeElements } : {}),
      ...(options.contextType ? { contextType: options.contextType } : {}),
    });
    return { component, nodes: result.nodes, diagnostics: result.diagnostics };
  });

  return {
    success: components.every((component) => component.diagnostics.length === 0),
    components,
    discoveryDiagnostics: discovered.diagnostics,
  };
}
