import type {
  ElementNode,
  ForBlockNode,
  GtplNode,
  IfBlockNode,
  LetDeclarationNode,
  SwitchBlockNode,
  TextNode,
} from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/diagnostic.js';
import type { SourceSpan } from '../source/span.js';
import type { ExpressionNode } from '../ast/expression.js';

export interface GtplSemanticOptions {
  /** Component members visible from the template's root scope. */
  readonly componentMembers?: readonly string[];
  /** Names supplied by the framework and always visible in expressions. */
  readonly globals?: readonly string[];
  /** Original template source, used to report identifier-level locations. */
  readonly source?: string;
}

export interface GtplSemanticResult {
  readonly diagnostics: readonly Diagnostic[];
}

interface SymbolEntry {
  readonly name: string;
  readonly kind: 'let' | 'if-alias' | 'for-item' | 'for-context' | 'for-alias';
  readonly span: SourceSpan;
}

class Scope {
  private readonly symbols = new Map<string, SymbolEntry>();

  constructor(readonly parent: Scope | null) {}

  declare(entry: SymbolEntry): SymbolEntry | undefined {
    const previous = this.symbols.get(entry.name);
    if (previous) return previous;
    this.symbols.set(entry.name, entry);
    return undefined;
  }

  resolve(name: string): SymbolEntry | undefined {
    return this.symbols.get(name) ?? this.parent?.resolve(name);
  }

  hasOwn(name: string): boolean {
    return this.symbols.has(name);
  }
}

const CONTEXT_NAMES = ['$count', '$index', '$first', '$last', '$even', '$odd'] as const;

class GtplSemanticAnalyzer {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly componentMembers: ReadonlySet<string> | null;
  private readonly globals: ReadonlySet<string>;
  private readonly source: string | undefined;

  constructor(options: GtplSemanticOptions) {
    this.componentMembers = options.componentMembers
      ? new Set(options.componentMembers)
      : null;
    this.globals = new Set(options.globals ?? []);
    this.source = options.source;
  }

  analyze(nodes: readonly GtplNode[]): GtplSemanticResult {
    const root = new Scope(null);
    for (const node of nodes) this.visit(node, root);
    return { diagnostics: this.diagnostics };
  }

  private visit(node: GtplNode, scope: Scope): void {
    switch (node.kind) {
      case 'text':
        this.visitText(node, scope);
        return;
      case 'element':
        this.visitElement(node, scope);
        return;
      case 'let-declaration':
        this.visitLet(node, scope);
        return;
      case 'if-block':
        this.visitIf(node, scope);
        return;
      case 'for-block':
        this.visitFor(node, scope);
        return;
      case 'switch-block':
        this.visitSwitch(node, scope);
        return;
    }
  }

  private visitText(node: TextNode, scope: Scope): void {
    for (const part of node.parts) {
      if (part.kind === 'interpolation' && part.parsedExpression) {
        this.checkExpression(part.parsedExpression, scope, part.expressionSpan, true);
      }
    }
  }

  private visitElement(node: ElementNode, scope: Scope): void {
    for (const attribute of node.attributes) {
      if (!attribute.parsedExpression) continue;
      const attributeScope = attribute.kind === 'event' ? new Scope(scope) : scope;
      if (attribute.kind === 'event') this.declare(attributeScope, { name: '$event', kind: 'let', span: attribute.valueSpan });
      this.checkExpression(attribute.parsedExpression, attributeScope, attribute.valueSpan, true);
    }
    for (const child of node.children) this.visit(child, scope);
  }

  private visitLet(node: LetDeclarationNode, scope: Scope): void {
    if (node.parsedExpression) this.checkExpression(node.parsedExpression, scope, node.span);
    if (!this.isValidIdentifier(node.name)) {
      this.report('GTPL4001', `Invalid template variable name "${node.name}".`, node.span);
      return;
    }
    this.declare(scope, {
      name: node.name,
      kind: 'let',
      span: node.span,
    });
  }

  private visitIf(node: IfBlockNode, parent: Scope): void {
    for (const branch of node.branches) {
      if (branch.parsedCondition) this.checkExpression(branch.parsedCondition, parent, branch.span);
      const branchScope = new Scope(parent);
      if (branch.alias) {
        this.declare(branchScope, {
          name: branch.alias,
          kind: 'if-alias',
          span: branch.span,
        });
      }
      for (const child of branch.children) this.visit(child, branchScope);
    }
  }

  private visitFor(node: ForBlockNode, parent: Scope): void {
    if (node.parsedCollection) this.checkExpression(node.parsedCollection, parent, node.span);

    const loopScope = new Scope(parent);
    this.declare(loopScope, { name: node.item, kind: 'for-item', span: node.span });
    for (const contextName of CONTEXT_NAMES) {
      this.declare(loopScope, { name: contextName, kind: 'for-context', span: node.span });
    }
    for (const alias of node.aliases) {
      this.declare(loopScope, { name: alias.name, kind: 'for-alias', span: node.span });
    }
    if (node.parsedTrack) this.checkExpression(node.parsedTrack, loopScope, node.span);
    for (const child of node.children) this.visit(child, loopScope);

    const emptyScope = new Scope(parent);
    for (const child of node.empty) this.visit(child, emptyScope);
  }

  private visitSwitch(node: SwitchBlockNode, parent: Scope): void {
    if (node.parsedExpression) this.checkExpression(node.parsedExpression, parent, node.span);
    for (const branch of node.cases) {
      for (const expression of branch.parsedExpressions) this.checkExpression(expression, parent, branch.span);
      const caseScope = new Scope(parent);
      for (const child of branch.children) this.visit(child, caseScope);
    }
    if (node.defaultCase) {
      if (node.defaultCase.parsedNeverExpression) {
        this.checkExpression(node.defaultCase.parsedNeverExpression, parent, node.defaultCase.span);
      }
      const defaultScope = new Scope(parent);
      for (const child of node.defaultCase.children) this.visit(child, defaultScope);
    }
  }

  private checkExpression(
    expression: ExpressionNode,
    scope: Scope,
    sourceSpan: SourceSpan,
    preciseSpan = false,
  ): void {
    switch (expression.kind) {
      case 'literal':
        return;
      case 'identifier':
        if (!scope.resolve(expression.name)
          && !this.globals.has(expression.name)
          && this.componentMembers
          && !this.componentMembers.has(expression.name)) {
          this.report(
            'GTPL4002',
            `Unknown template identifier "${expression.name}". Add it to the component context or declare it in the template.`,
            preciseSpan ? this.identifierSpan(sourceSpan, expression.span.start, expression.span.end) : sourceSpan,
          );
        }
        return;
      case 'member':
        this.checkExpression(expression.object, scope, sourceSpan, preciseSpan);
        if (expression.computed && typeof expression.property !== 'string') {
          this.checkExpression(expression.property, scope, sourceSpan, preciseSpan);
        }
        return;
      case 'call':
        this.checkExpression(expression.callee, scope, sourceSpan, preciseSpan);
        for (const argument of expression.arguments) this.checkExpression(argument, scope, sourceSpan, preciseSpan);
        return;
      case 'unary':
        this.checkExpression(expression.argument, scope, sourceSpan, preciseSpan);
        return;
      case 'binary':
        this.checkExpression(expression.left, scope, sourceSpan, preciseSpan);
        this.checkExpression(expression.right, scope, sourceSpan, preciseSpan);
        return;
      case 'conditional':
        this.checkExpression(expression.test, scope, sourceSpan, preciseSpan);
        this.checkExpression(expression.consequent, scope, sourceSpan, preciseSpan);
        this.checkExpression(expression.alternate, scope, sourceSpan, preciseSpan);
        return;
      case 'assignment':
        this.checkExpression(expression.target, scope, sourceSpan, preciseSpan);
        this.checkExpression(expression.value, scope, sourceSpan, preciseSpan);
        return;
      case 'pipe':
        this.checkExpression(expression.expression, scope, sourceSpan, preciseSpan);
        for (const argument of expression.arguments) this.checkExpression(argument, scope, sourceSpan, preciseSpan);
        return;
      case 'array':
        for (const element of expression.elements) this.checkExpression(element, scope, sourceSpan);
        return;
    }
  }

  private identifierSpan(base: SourceSpan, start: number, end: number): SourceSpan {
    const absoluteStart = base.start + start;
    const absoluteEnd = base.start + end;
    if (!this.source) return { ...base, start: absoluteStart, end: absoluteEnd };

    const prefix = this.source.slice(base.start, absoluteStart);
    const lineBreaks = prefix.match(/\\n/g)?.length ?? 0;
    const lastLineBreak = prefix.lastIndexOf('\\n');
    return {
      start: absoluteStart,
      end: absoluteEnd,
      line: base.line + lineBreaks,
      column: lastLineBreak === -1 ? base.column + prefix.length : prefix.length - lastLineBreak,
    };
  }

  private declare(scope: Scope, entry: SymbolEntry): void {
    if (!this.isValidIdentifier(entry.name)) {
      this.report('GTPL4001', `Invalid template variable name "${entry.name}".`, entry.span);
      return;
    }
    const previous = scope.declare(entry);
    if (previous) {
      this.report(
        'GTPL4003',
        `Duplicate template variable "${entry.name}" in the same scope (already declared as ${previous.kind}).`,
        entry.span,
      );
    }
  }

  private isValidIdentifier(name: string): boolean {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)
      && !['true', 'false', 'null', 'undefined', 'this', 'new'].includes(name);
  }

  private report(code: string, message: string, span: SourceSpan): void {
    this.diagnostics.push({ code, message, span });
  }
}

export function analyzeGtpl(
  nodes: readonly GtplNode[],
  options: GtplSemanticOptions = {},
): GtplSemanticResult {
  return new GtplSemanticAnalyzer(options).analyze(nodes);
}
