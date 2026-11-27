import type { ExpressionNode } from '../gtpl/ast/expression.js';
import type {
  ElementNode,
  ForContextAlias,
  GtplNode,
  IfBlockNode,
  SourceSpan,
  SwitchBlockNode,
  TextNode,
} from '../gtpl/ast/types.js';
import type { Diagnostic } from '../gtpl/diagnostics/diagnostic.js';
import { checkGtpl, type GtplCheckOptions } from '../gtpl/check.js';

export type UiValue =
  | { readonly kind: 'static'; readonly value: string }
  | { readonly kind: 'binding'; readonly expression: ExpressionNode };

export interface UiProperty {
  readonly name: string;
  readonly value: UiValue;
}

export interface UiEvent {
  readonly name: string;
  readonly handler: ExpressionNode;
}

export interface UiText {
  readonly kind: 'text';
  readonly parts: readonly (
    | { readonly kind: 'text'; readonly value: string }
    | { readonly kind: 'expression'; readonly expression: ExpressionNode }
  )[];
  readonly span: SourceSpan;
}

export interface UiElement {
  readonly kind: 'element';
  readonly component: string;
  readonly properties: readonly UiProperty[];
  readonly events: readonly UiEvent[];
  readonly references: readonly string[];
  readonly children: readonly UiNode[];
  readonly span: SourceSpan;
}

export interface UiIf {
  readonly kind: 'if';
  readonly branches: readonly {
    readonly condition?: ExpressionNode;
    readonly alias?: string;
    readonly children: readonly UiNode[];
    readonly span: SourceSpan;
  }[];
  readonly span: SourceSpan;
}

export interface UiFor {
  readonly kind: 'for';
  readonly item: string;
  readonly collection: ExpressionNode;
  readonly trackBy: ExpressionNode;
  readonly aliases: readonly ForContextAlias[];
  readonly children: readonly UiNode[];
  readonly empty: readonly UiNode[];
  readonly span: SourceSpan;
}

export interface UiSwitch {
  readonly kind: 'switch';
  readonly expression: ExpressionNode;
  readonly cases: readonly {
    readonly expressions: readonly ExpressionNode[];
    readonly children: readonly UiNode[];
    readonly span: SourceSpan;
  }[];
  readonly defaultCase?: {
    readonly exhaustive: boolean;
    readonly children: readonly UiNode[];
    readonly span: SourceSpan;
  };
  readonly span: SourceSpan;
}

export interface UiLet {
  readonly kind: 'let';
  readonly name: string;
  readonly expression: ExpressionNode;
  readonly span: SourceSpan;
}

export type UiNode = UiText | UiElement | UiIf | UiFor | UiSwitch | UiLet;

export interface GtplUiIrResult {
  readonly success: boolean;
  readonly nodes: readonly UiNode[];
  readonly diagnostics: readonly Diagnostic[];
}

function requiredExpression(expression: ExpressionNode | undefined, context: string): ExpressionNode {
  if (!expression) throw new Error(`Cannot lower GTPL to UI IR: missing expression for ${context}.`);
  return expression;
}

function lowerText(node: TextNode): UiText {
  return {
    kind: 'text',
    parts: node.parts.map((part) => part.kind === 'text'
      ? { kind: 'text', value: part.value }
      : { kind: 'expression', expression: requiredExpression(part.parsedExpression, 'text interpolation') }),
    span: node.span,
  };
}

function lowerElement(node: ElementNode): UiElement {
  const properties: UiProperty[] = [];
  const events: UiEvent[] = [];
  const references: string[] = [];
  for (const attribute of node.attributes) {
    if (attribute.kind === 'static') {
      properties.push({ name: attribute.name, value: { kind: 'static', value: attribute.value } });
    } else if (attribute.kind === 'property') {
      properties.push({
        name: attribute.name,
        value: { kind: 'binding', expression: requiredExpression(attribute.parsedExpression, attribute.name) },
      });
    } else if (attribute.kind === 'event') {
      events.push({ name: attribute.name, handler: requiredExpression(attribute.parsedExpression, attribute.name) });
    } else if (attribute.kind === 'reference') {
      references.push(attribute.name);
    } else {
      throw new Error(`Cannot lower GTPL to UI IR: "${attribute.kind}" attribute "${attribute.name}" was not lowered.`);
    }
  }
  return {
    kind: 'element',
    component: node.name,
    properties,
    events,
    references,
    children: lowerNodes(node.children),
    span: node.span,
  };
}

function lowerIf(node: IfBlockNode): UiIf {
  return {
    kind: 'if',
    branches: node.branches.map((branch) => ({
      ...(branch.parsedCondition ? { condition: branch.parsedCondition } : {}),
      ...(branch.alias ? { alias: branch.alias } : {}),
      children: lowerNodes(branch.children),
      span: branch.span,
    })),
    span: node.span,
  };
}

function lowerFor(node: Extract<GtplNode, { kind: 'for-block' }>): UiFor {
  return {
    kind: 'for',
    item: node.item,
    collection: requiredExpression(node.parsedCollection, 'for collection'),
    trackBy: requiredExpression(node.parsedTrack, 'for track expression'),
    aliases: node.aliases,
    children: lowerNodes(node.children),
    empty: lowerNodes(node.empty),
    span: node.span,
  };
}

function lowerSwitch(node: SwitchBlockNode): UiSwitch {
  return {
    kind: 'switch',
    expression: requiredExpression(node.parsedExpression, 'switch expression'),
    cases: node.cases.map((branch) => ({
      expressions: branch.parsedExpressions,
      children: lowerNodes(branch.children),
      span: branch.span,
    })),
    ...(node.defaultCase ? {
      defaultCase: {
        exhaustive: node.defaultCase.exhaustive,
        children: lowerNodes(node.defaultCase.children),
        span: node.defaultCase.span,
      },
    } : {}),
    span: node.span,
  };
}

function lowerNodes(nodes: readonly GtplNode[]): UiNode[] {
  return nodes.map((node): UiNode => {
    switch (node.kind) {
      case 'text': return lowerText(node);
      case 'element': return lowerElement(node);
      case 'if-block': return lowerIf(node);
      case 'for-block': return lowerFor(node);
      case 'switch-block': return lowerSwitch(node);
      case 'let-declaration':
        return {
          kind: 'let',
          name: node.name,
          expression: requiredExpression(node.parsedExpression, 'let declaration'),
          span: node.span,
        };
    }
  });
}

/**
 * Compiles a GTPL view into a renderer-neutral UI tree.
 * Expressions remain AST nodes so a backend can choose its own code generation.
 */
export function compileGtplToUiIr(source: string, options: GtplCheckOptions = {}): GtplUiIrResult {
  const checked = checkGtpl(source, options);
  if (checked.diagnostics.length > 0) {
    return { success: false, nodes: [], diagnostics: checked.diagnostics };
  }
  return { success: true, nodes: lowerNodes(checked.nodes), diagnostics: [] };
}
