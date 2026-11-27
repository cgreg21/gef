import type { GtplNode } from './ast/types.js';
import type { Diagnostic } from './diagnostics/diagnostic.js';
import { analyzeGtpl, type GtplSemanticOptions } from './analysis/semantic.js';
import { parseGtpl } from './parser/parser.js';
import { validateGtplExpressionTypes } from './analysis/types.js';
import { lowerGtplStructuralDirectives } from './lowering/structural.js';
import {
  validateGtplComponents,
  type GtplComponentDefinition,
} from './validation/components.js';

export interface GtplCheckOptions extends GtplSemanticOptions {
  readonly components?: readonly GtplComponentDefinition[];
  /** Report unknown element selectors as errors. Defaults to false for native St actors. */
  readonly strictComponents?: boolean;
  /** Native element names accepted by strict component validation. */
  readonly nativeElements?: readonly string[];
  /** Optional TypeScript type literal used to check component template expressions. */
  readonly contextType?: string;
}

export interface GtplCheckResult {
  readonly nodes: readonly GtplNode[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Parses and lowers a template, then runs lexical and component-contract validation.
 * This is a validation pipeline; it does not generate or execute runtime code.
 */
export function checkGtpl(source: string, options: GtplCheckOptions = {}): GtplCheckResult {
  const parsed = parseGtpl(source);
  const lowered = lowerGtplStructuralDirectives(parsed.nodes);
  const semantic = analyzeGtpl(lowered.nodes, { ...options, source });
  const components = validateGtplComponents(lowered.nodes, {
    components: options.components ?? [],
    strict: options.strictComponents ?? false,
    nativeElements: options.nativeElements,
  });

  const types = options.contextType
    ? validateGtplExpressionTypes(lowered.nodes, options.contextType)
    : [];

  return {
    nodes: lowered.nodes,
    diagnostics: [...parsed.diagnostics, ...lowered.diagnostics, ...semantic.diagnostics, ...components, ...types],
  };
}
