import { checkGtpl } from '../gtpl/check.js';
import type { GtplNode } from '../gtpl/ast/types.js';
import type { Diagnostic } from '../gtpl/diagnostics/diagnostic.js';
import { emitGtplTemplate } from '../gtpl/codegen/template.js';
import type { GtplComponentDefinition } from '../gtpl/validation/components.js';
import { getComponentMetadata, type ComponentMetadata } from './api.js';

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
  const checked = checkGtpl(templateSource ?? metadata.template, options);
  return {
    metadata,
    nodes: checked.nodes,
    diagnostics: checked.diagnostics,
    ...(checked.diagnostics.length === 0
      ? { renderSource: emitGtplTemplate(checked.nodes, options) }
      : {}),
  };
}
