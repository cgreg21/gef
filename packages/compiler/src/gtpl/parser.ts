import type {
  AttributeKind,
  Diagnostic,
  ElementNode,
  GtplAttribute,
  GtplNode,
  GtplParseResult,
  InterpolationPart,
  SourceSpan,
  TextNode,
  TextPart,
} from './ast.js';

class GtplParser {
  private offset = 0;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly lineStarts: number[] = [0];

  constructor(private readonly source: string) {
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '\n') this.lineStarts.push(i + 1);
    }
  }

  parse(): GtplParseResult {
    const nodes: GtplNode[] = [];
    while (!this.eof()) {
      if (this.startsWith('<!--')) {
        this.parseComment();
        continue;
      }
      if (this.startsWith('</')) {
        const start = this.offset;
        this.consumeClosingTag();
        this.report('GTPL1001', 'Unexpected closing tag.', start, this.offset);
        continue;
      }
      const before = this.offset;
      const node = this.parseNode();
      if (node) nodes.push(node);
      if (this.offset === before) this.offset += 1;
    }
    return { nodes, diagnostics: this.diagnostics };
  }

  private parseNode(): GtplNode | null {
    if (this.peek() === '<' && this.isTagStart(this.offset)) {
      return this.parseElement();
    }
    return this.parseText();
  }

  private parseElement(): ElementNode {
    const start = this.offset;
    this.offset += 1;
    const name = this.readName();
    if (!name) {
      this.report('GTPL1002', 'Expected an element name after "<".', start, this.offset);
      return {
        kind: 'element',
        name: '',
        attributes: [],
        children: [],
        span: this.span(start, this.offset),
      };
    }

    const attributes: GtplAttribute[] = [];
    let selfClosing = false;
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.startsWith('/>')) {
        this.offset += 2;
        selfClosing = true;
        break;
      }
      if (this.peek() === '>') {
        this.offset += 1;
        break;
      }
      const attribute = this.parseAttribute();
      if (attribute) attributes.push(attribute);
      else {
        this.report('GTPL1003', 'Malformed attribute in opening tag.', this.offset, Math.min(this.offset + 1, this.source.length));
        this.recoverToTagEnd();
        break;
      }
    }

    if (this.eof() && this.source[this.source.length - 1] !== '>') {
      this.report('GTPL1004', `Unterminated opening tag "<${name}".`, start, this.offset);
    }

    const children: GtplNode[] = [];
    if (!selfClosing) {
      let closed = false;
      while (!this.eof()) {
        if (this.startsWith('<!--')) {
          this.parseComment();
          continue;
        }
        if (this.startsWith('</')) {
          const closingStart = this.offset;
          const closingName = this.consumeClosingTag();
          if (closingName === name) {
            closed = true;
            break;
          }
          this.report(
            'GTPL1005',
            `Expected closing tag "</${name}>", found "${closingName ? `</${closingName}>` : 'malformed closing tag'}".`,
            closingStart,
            this.offset,
          );
          continue;
        }
        const before = this.offset;
        const child = this.parseNode();
        if (child) children.push(child);
        if (this.offset === before) this.offset += 1;
      }
      if (!closed) {
        this.report('GTPL1006', `Missing closing tag "</${name}>".`, start, this.offset);
      }
    }

    return {
      kind: 'element',
      name,
      attributes,
      children,
      span: this.span(start, this.offset),
    };
  }

  private parseAttribute(): GtplAttribute | null {
    const start = this.offset;
    const rawName = this.readAttributeName();
    if (!rawName) return null;
    this.skipWhitespace();

    let value = '';
    if (this.peek() === '=') {
      this.offset += 1;
      this.skipWhitespace();
      const quote = this.peek();
      if (quote === '"' || quote === "'") {
        this.offset += 1;
        const valueStart = this.offset;
        while (!this.eof() && this.peek() !== quote) this.offset += 1;
        value = this.source.slice(valueStart, this.offset);
        if (this.peek() === quote) this.offset += 1;
        else this.report('GTPL1007', 'Unterminated quoted attribute value.', start, this.offset);
      } else {
        const valueStart = this.offset;
        while (!this.eof() && !this.isWhitespace(this.peek()) && this.peek() !== '>' && !this.startsWith('/>')) {
          this.offset += 1;
        }
        value = this.source.slice(valueStart, this.offset);
        if (value.length === 0) {
          this.report('GTPL1008', 'Expected an attribute value after "=".', start, this.offset);
        }
      }
    }

    const kind = this.attributeKind(rawName);
    const name = this.normalizedAttributeName(rawName, kind);
    return { name, value, kind, span: this.span(start, this.offset) };
  }

  private parseText(): TextNode {
    const start = this.offset;
    while (!this.eof() && this.peek() !== '<') this.offset += 1;
    if (this.offset === start) this.offset += 1;
    const end = this.offset;
    const raw = this.source.slice(start, end);
    const parts: (TextPart | InterpolationPart)[] = [];
    const pattern = /\{\{([\s\S]*?)\}\}/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw)) !== null) {
      const matchStart = start + match.index;
      if (match.index > cursor) {
        parts.push({
          kind: 'text',
          value: raw.slice(cursor, match.index),
          span: this.span(start + cursor, matchStart),
        });
      }
      const expression = match[1] ?? '';
      if (expression.trim().length === 0) {
        this.report('GTPL1010', 'Interpolation expression cannot be empty.', matchStart, start + pattern.lastIndex);
      }
      parts.push({
        kind: 'interpolation',
        expression: expression.trim(),
        span: this.span(matchStart, start + pattern.lastIndex),
      });
      cursor = pattern.lastIndex;
    }

    const unclosed = raw.indexOf('{{', cursor);
    if (unclosed !== -1) {
      this.report('GTPL1011', 'Unterminated interpolation; expected "}}".', start + unclosed, end);
    }
    if (cursor < raw.length) {
      parts.push({
        kind: 'text',
        value: raw.slice(cursor),
        span: this.span(start + cursor, end),
      });
    }
    return { kind: 'text', parts, span: this.span(start, end) };
  }

  private parseComment(): void {
    const start = this.offset;
    const end = this.source.indexOf('-->', this.offset + 4);
    if (end === -1) {
      this.offset = this.source.length;
      this.report('GTPL1012', 'Unterminated template comment.', start, this.offset);
    } else {
      this.offset = end + 3;
    }
  }

  private consumeClosingTag(): string | null {
    this.offset += 2;
    this.skipWhitespace();
    const name = this.readName();
    this.skipWhitespace();
    if (this.peek() === '>') this.offset += 1;
    else this.recoverToTagEnd();
    return name || null;
  }

  private readName(): string {
    const start = this.offset;
    while (!this.eof() && /[A-Za-z0-9_.:-]/.test(this.peek())) this.offset += 1;
    return this.source.slice(start, this.offset);
  }

  private readAttributeName(): string {
    const start = this.offset;
    while (!this.eof()) {
      const char = this.peek();
      if (this.isWhitespace(char) || char === '=' || char === '>' || this.startsWith('/>')) break;
      this.offset += 1;
    }
    return this.source.slice(start, this.offset);
  }

  private attributeKind(name: string): AttributeKind {
    if (name.startsWith('[(') && name.endsWith(')]')) return 'two-way';
    if (name.startsWith('[') && name.endsWith(']')) return 'property';
    if (name.startsWith('(') && name.endsWith(')')) return 'event';
    if (name.startsWith('*')) return 'structural';
    if (name.startsWith('#')) return 'reference';
    return 'static';
  }

  private normalizedAttributeName(name: string, kind: AttributeKind): string {
    switch (kind) {
      case 'two-way': return name.slice(2, -2);
      case 'property':
      case 'event': return name.slice(1, -1);
      case 'structural':
      case 'reference': return name.slice(1);
      case 'static': return name;
    }
  }

  private recoverToTagEnd(): void {
    while (!this.eof() && this.peek() !== '>') this.offset += 1;
    if (this.peek() === '>') this.offset += 1;
  }

  private skipWhitespace(): void {
    while (!this.eof() && this.isWhitespace(this.peek())) this.offset += 1;
  }

  private isTagStart(offset: number): boolean {
    return this.source[offset] === '<' && /[A-Za-z]/.test(this.source[offset + 1] ?? '');
  }

  private startsWith(value: string): boolean {
    return this.source.startsWith(value, this.offset);
  }

  private peek(): string {
    return this.source[this.offset] ?? '';
  }

  private eof(): boolean {
    return this.offset >= this.source.length;
  }

  private isWhitespace(value: string): boolean {
    return value === ' ' || value === '\n' || value === '\r' || value === '\t';
  }

  private span(start: number, end: number): SourceSpan {
    let low = 0;
    let high = this.lineStarts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if ((this.lineStarts[middle] ?? 0) <= start) low = middle;
      else high = middle;
    }
    return {
      start,
      end,
      line: low + 1,
      column: start - (this.lineStarts[low] ?? 0) + 1,
    };
  }

  private report(code: string, message: string, start: number, end: number): void {
    this.diagnostics.push({ code, message, span: this.span(start, end) });
  }
}

export function parseGtpl(source: string): GtplParseResult {
  return new GtplParser(source).parse();
}
