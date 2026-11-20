import type { ExpressionNode } from '../expression/parser.js';

export interface SourceSpan {
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
}

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly span: SourceSpan;
}

export type AttributeKind = 'static' | 'property' | 'event' | 'two-way' | 'structural' | 'reference';

export interface GtplAttribute {
  readonly name: string;
  readonly value: string;
  readonly kind: AttributeKind;
  readonly span: SourceSpan;
  /** Exact source range occupied by the attribute value (excluding quotes). */
  readonly valueSpan: SourceSpan;
  /** Parsed expression for expression-bearing bindings; absent for static/reference values and *gefFor microsyntax. */
  readonly parsedExpression?: ExpressionNode;
}

export interface TextPart {
  readonly kind: 'text';
  readonly value: string;
  readonly span: SourceSpan;
}

export interface InterpolationPart {
  readonly kind: 'interpolation';
  readonly expression: string;
  readonly span: SourceSpan;
  readonly expressionSpan: SourceSpan;
  readonly parsedExpression?: ExpressionNode;
}

export type TextPartNode = TextPart | InterpolationPart;

export interface TextNode {
  readonly kind: 'text';
  readonly parts: readonly TextPartNode[];
  readonly span: SourceSpan;
}

export interface ElementNode {
  readonly kind: 'element';
  readonly name: string;
  readonly attributes: readonly GtplAttribute[];
  readonly children: readonly GtplNode[];
  readonly span: SourceSpan;
}

export interface IfBranch {
  readonly condition?: string;
  readonly alias?: string;
  readonly parsedCondition?: ExpressionNode;
  readonly span: SourceSpan;
  readonly children: readonly GtplNode[];
}
export interface IfBlockNode {
  readonly kind: 'if-block';
  readonly branches: readonly IfBranch[];
  readonly span: SourceSpan;
}
export interface ForContextAlias {
  readonly name: string;
  readonly context: '$count' | '$index' | '$first' | '$last' | '$even' | '$odd';
}
export interface ForBlockNode {
  readonly kind: 'for-block';
  readonly item: string;
  readonly collection: string;
  readonly parsedCollection?: ExpressionNode;
  readonly track: string;
  readonly parsedTrack?: ExpressionNode;
  readonly aliases: readonly ForContextAlias[];
  readonly empty: readonly GtplNode[];
  readonly children: readonly GtplNode[];
  readonly span: SourceSpan;
}
export interface SwitchCaseNode {
  readonly expressions: readonly string[];
  readonly parsedExpressions: readonly ExpressionNode[];
  readonly span: SourceSpan;
  readonly children: readonly GtplNode[];
}
export interface SwitchDefaultNode {
  readonly exhaustive: boolean;
  readonly neverExpression?: string;
  readonly parsedNeverExpression?: ExpressionNode;
  readonly span: SourceSpan;
  readonly children: readonly GtplNode[];
}
export interface SwitchBlockNode {
  readonly kind: 'switch-block';
  readonly expression: string;
  readonly parsedExpression?: ExpressionNode;
  readonly cases: readonly SwitchCaseNode[];
  readonly defaultCase?: SwitchDefaultNode;
  readonly span: SourceSpan;
}
export interface LetDeclarationNode {
  readonly kind: 'let-declaration';
  readonly name: string;
  readonly expression: string;
  readonly parsedExpression?: ExpressionNode;
  readonly span: SourceSpan;
}
export type GtplNode = ElementNode | TextNode | IfBlockNode | ForBlockNode | SwitchBlockNode | LetDeclarationNode;

export interface GtplParseResult {
  readonly nodes: readonly GtplNode[];
  readonly diagnostics: readonly Diagnostic[];
}
