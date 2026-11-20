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

export type AttributeKind =
  | 'static'
  | 'property'
  | 'event'
  | 'two-way'
  | 'structural'
  | 'reference';

export interface GtplAttribute {
  readonly name: string;
  readonly value: string;
  readonly kind: AttributeKind;
  readonly span: SourceSpan;
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

export type GtplNode = ElementNode | TextNode;

export interface GtplParseResult {
  readonly nodes: readonly GtplNode[];
  readonly diagnostics: readonly Diagnostic[];
}
