export interface ExpressionSpan {
  readonly start: number;
  readonly end: number;
}

export interface LiteralExpression {
  readonly kind: 'literal';
  readonly value: string | number | boolean | null;
  readonly raw: string;
  readonly span: ExpressionSpan;
}

export interface IdentifierExpression {
  readonly kind: 'identifier';
  readonly name: string;
  readonly span: ExpressionSpan;
}

export interface MemberExpression {
  readonly kind: 'member';
  readonly object: ExpressionNode;
  readonly property: string | ExpressionNode;
  readonly computed: boolean;
  readonly optional: boolean;
  readonly span: ExpressionSpan;
}

export interface CallExpression {
  readonly kind: 'call';
  readonly callee: ExpressionNode;
  readonly arguments: readonly ExpressionNode[];
  readonly optional: boolean;
  readonly span: ExpressionSpan;
}

export interface UnaryExpression {
  readonly kind: 'unary';
  readonly operator: string;
  readonly argument: ExpressionNode;
  readonly span: ExpressionSpan;
}

export interface BinaryExpression {
  readonly kind: 'binary';
  readonly operator: string;
  readonly left: ExpressionNode;
  readonly right: ExpressionNode;
  readonly span: ExpressionSpan;
}

export interface ConditionalExpression {
  readonly kind: 'conditional';
  readonly test: ExpressionNode;
  readonly consequent: ExpressionNode;
  readonly alternate: ExpressionNode;
  readonly span: ExpressionSpan;
}

export interface AssignmentExpression {
  readonly kind: 'assignment';
  readonly target: ExpressionNode;
  readonly value: ExpressionNode;
  readonly span: ExpressionSpan;
}

export interface PipeExpression {
  readonly kind: 'pipe';
  readonly expression: ExpressionNode;
  readonly name: string;
  readonly arguments: readonly ExpressionNode[];
  readonly span: ExpressionSpan;
}

export interface ArrayExpression {
  readonly kind: 'array';
  readonly elements: readonly ExpressionNode[];
  readonly span: ExpressionSpan;
}

export type ExpressionNode =
  | LiteralExpression
  | IdentifierExpression
  | MemberExpression
  | CallExpression
  | UnaryExpression
  | BinaryExpression
  | ConditionalExpression
  | AssignmentExpression
  | PipeExpression
  | ArrayExpression;
