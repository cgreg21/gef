import type { ExpressionNode, ExpressionSpan } from '../ast/expression.js';

export type {
  ArrayExpression,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  ExpressionNode,
  ExpressionSpan,
  IdentifierExpression,
  LiteralExpression,
  MemberExpression,
  UnaryExpression,
} from '../ast/expression.js';

export interface ExpressionDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly span: ExpressionSpan;
}

export interface ExpressionParseResult {
  readonly expression: ExpressionNode | null;
  readonly diagnostics: readonly ExpressionDiagnostic[];
}

type TokenKind = 'identifier' | 'number' | 'string' | 'operator' | 'eof';

interface Token {
  readonly kind: TokenKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly terminated?: boolean;
}

const BINARY_PRECEDENCE: Readonly<Record<string, number>> = {
  '??': 1,
  '||': 2,
  '&&': 3,
  '==': 4,
  '!=': 4,
  '===': 4,
  '!==': 4,
  '<': 5,
  '>': 5,
  '<=': 5,
  '>=': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
  '%': 7,
  '**': 8,
};

const OPERATORS = ['===', '!==', '?.', '??', '||', '&&', '==', '!=', '<=', '>=', '**'];

class ExpressionParser {
  private offset = 0;
  private current: Token;
  private readonly diagnostics: ExpressionDiagnostic[] = [];

  constructor(private readonly source: string) {
    this.current = this.nextToken();
  }

  parse(): ExpressionParseResult {
    if (this.getCurrentToken().kind === 'eof') {
      this.report('GTPL2001', 'Expression cannot be empty.', 0, 0);
      return { expression: null, diagnostics: this.diagnostics };
    }

    const expression = this.parseExpression(0);
    if (this.getCurrentToken().kind !== 'eof') {
      this.report('GTPL2002', `Unexpected token "${this.current.value}".`, this.current.start, this.current.end);
    }
    return { expression, diagnostics: this.diagnostics };
  }

  private parseExpression(minPrecedence: number): ExpressionNode | null {
    let left = this.parsePrefix();
    if (!left) return null;

    while (true) {
      if (this.current.value === '.' || this.current.value === '?.') {
        if (18 < minPrecedence) break;
        const optional = this.current.value === '?.';
        this.advance();
        if (this.current.kind !== 'identifier') {
          this.report('GTPL2003', 'Expected a property name after member access.', this.current.start, this.current.end);
          return left;
        }
        const property = this.current;
        this.advance();
        left = {
          kind: 'member',
          object: left,
          property: property.value,
          computed: false,
          optional,
          span: { start: left.span.start, end: property.end },
        };
        continue;
      }

      if (this.current.value === '[') {
        if (18 < minPrecedence) break;
        this.advance();
        const property = this.parseExpression(0);
        const close = this.expect(']');
        if (!property) return left;
        left = {
          kind: 'member',
          object: left,
          property,
          computed: true,
          optional: false,
          span: { start: left.span.start, end: close?.end ?? property.span.end },
        };
        continue;
      }

      if (this.current.value === '(') {
        if (18 < minPrecedence) break;
        this.advance();
        const args = this.parseDelimitedExpressions(')');
        const close = this.expect(')');
        left = {
          kind: 'call',
          callee: left,
          arguments: args,
          optional: false,
          span: { start: left.span.start, end: close?.end ?? args.at(-1)?.span.end ?? this.getCurrentToken().start },
        };
        continue;
      }

      if (this.current.value === '?' && minPrecedence <= 0) {
        this.advance();
        const consequent = this.parseExpression(0);
        this.expect(':');
        const alternate = this.parseExpression(0);
        if (!consequent || !alternate) return left;
        left = {
          kind: 'conditional',
          test: left,
          consequent,
          alternate,
          span: { start: left.span.start, end: alternate.span.end },
        };
        continue;
      }

      const precedence = BINARY_PRECEDENCE[this.current.value];
      if (precedence === undefined || precedence < minPrecedence) break;
      const operator = this.current.value;
      this.advance();
      const nextMinimum = operator === '**' ? precedence : precedence + 1;
      const right = this.parseExpression(nextMinimum);
      if (!right) return left;
      left = {
        kind: 'binary',
        operator,
        left,
        right,
        span: { start: left.span.start, end: right.span.end },
      };
    }

    return left;
  }

  private parseDelimitedExpressions(closing: string): ExpressionNode[] {
    const expressions: ExpressionNode[] = [];
    while (this.getCurrentToken().kind !== 'eof' && this.getCurrentToken().value !== closing) {
      const before = this.getCurrentToken();
      const expression = this.parseExpression(0);
      if (expression) expressions.push(expression);

      const current = this.getCurrentToken();
      if (current.value === ',') {
        this.advance();
        continue;
      }
      if (current.kind === 'eof' || current.value === closing) break;
      if (current === before) {
        this.advance();
        continue;
      }

      this.report('GTPL2008', 'Expected \",\" between expressions.', current.start, current.end);
    }
    return expressions;
  }

  private parsePrefix(): ExpressionNode | null {
    const token = this.current;

    if (token.value === '!' || token.value === '+' || token.value === '-') {
      this.advance();
      const argument = this.parseExpression(9);
      if (!argument) return null;
      return {
        kind: 'unary',
        operator: token.value,
        argument,
        span: { start: token.start, end: argument.span.end },
      };
    }

    if (token.value === '(') {
      this.advance();
      const expression = this.parseExpression(0);
      this.expect(')');
      return expression;
    }

    if (token.value === '[') {
      this.advance();
      const elements = this.parseDelimitedExpressions(']');
      const close = this.expect(']');
      return {
        kind: 'array',
        elements,
        span: { start: token.start, end: close?.end ?? elements.at(-1)?.span.end ?? this.getCurrentToken().start },
      };
    }

    if (token.kind === 'number') {
      this.advance();
      return {
        kind: 'literal',
        value: Number(token.value),
        raw: token.value,
        span: { start: token.start, end: token.end },
      };
    }

    if (token.kind === 'string') {
      this.advance();
      return {
        kind: 'literal',
        value: this.decodeString(token.value, token.terminated === true),
        raw: token.value,
        span: { start: token.start, end: token.end },
      };
    }

    if (token.kind === 'identifier') {
      this.advance();
      if (token.value === 'true' || token.value === 'false' || token.value === 'null') {
        return {
          kind: 'literal',
          value: token.value === 'null' ? null : token.value === 'true',
          raw: token.value,
          span: { start: token.start, end: token.end },
        };
      }
      return { kind: 'identifier', name: token.value, span: { start: token.start, end: token.end } };
    }

    this.report('GTPL2004', `Expected an expression, found "${token.value || 'end of input'}".`, token.start, token.end);
    if (token.kind !== 'eof' && ![')', ']', ',', ':'].includes(token.value)) this.advance();
    return null;
  }

  private nextToken(): Token {
    while (this.offset < this.source.length && /\s/.test(this.source[this.offset] ?? '')) this.offset += 1;
    const start = this.offset;
    if (start >= this.source.length) return { kind: 'eof', value: '', start, end: start };

    const char = this.source[this.offset] ?? '';
    if (/[A-Za-z_$]/.test(char)) {
      this.offset += 1;
      while (this.offset < this.source.length && /[A-Za-z0-9_$]/.test(this.source[this.offset] ?? '')) this.offset += 1;
      return { kind: 'identifier', value: this.source.slice(start, this.offset), start, end: this.offset };
    }

    if (/[0-9]/.test(char)) {
      this.offset += 1;
      while (this.offset < this.source.length && /[0-9]/.test(this.source[this.offset] ?? '')) this.offset += 1;
      if (this.source[this.offset] === '.' && /[0-9]/.test(this.source[this.offset + 1] ?? '')) {
        this.offset += 1;
        while (this.offset < this.source.length && /[0-9]/.test(this.source[this.offset] ?? '')) this.offset += 1;
      }
      return { kind: 'number', value: this.source.slice(start, this.offset), start, end: this.offset };
    }

    if (char === '"' || char === "'") {
      this.offset += 1;
      let terminated = false;
      while (this.offset < this.source.length) {
        const current = this.source[this.offset] ?? '';
        if (current === '\\') {
          this.offset = Math.min(this.offset + 2, this.source.length);
          continue;
        }
        if (current === char) {
          this.offset += 1;
          terminated = true;
          break;
        }
        if (current === '\n' || current === '\r') break;
        this.offset += 1;
      }
      const raw = this.source.slice(start, this.offset);
      if (!terminated) {
        this.report('GTPL2005', 'Unterminated string literal.', start, this.offset);
      }
      return { kind: 'string', value: raw, start, end: this.offset, terminated };
    }

    for (const operator of OPERATORS) {
      if (this.source.startsWith(operator, this.offset)) {
        this.offset += operator.length;
        return { kind: 'operator', value: operator, start, end: this.offset };
      }
    }

    if ('()[]{}.,?:!+-*/%<>=|'.includes(char)) {
      this.offset += 1;
      return { kind: 'operator', value: char, start, end: this.offset };
    }

    this.offset += 1;
    this.report('GTPL2006', `Unsupported character "${char}" in expression.`, start, this.offset);
    return { kind: 'operator', value: char, start, end: this.offset };
  }

  private decodeString(raw: string, terminated: boolean): string {
    const content = raw.slice(1, terminated ? -1 : undefined);
    return content.replace(/\\(['"\\nrt])/g, (_match, escaped: string) => {
      if (escaped === 'n') return '\n';
      if (escaped === 'r') return '\r';
      if (escaped === 't') return '\t';
      return escaped;
    });
  }

  private expect(value: string): Token | null {
    if (this.current.value === value) {
      const token = this.current;
      this.advance();
      return token;
    }
    this.report('GTPL2007', `Expected "${value}", found "${this.current.value || 'end of input'}".`, this.current.start, this.current.end);
    return null;
  }

  private getCurrentToken(): Token {
    return this.current;
  }

  private advance(): void {
    this.current = this.nextToken();
  }

  private report(code: string, message: string, start: number, end: number): void {
    this.diagnostics.push({ code, message, span: { start, end } });
  }
}

export function parseGtplExpression(source: string): ExpressionParseResult {
  return new ExpressionParser(source).parse();
}
