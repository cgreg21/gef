import type {
  AttributeKind,
  ElementNode,
  ForContextAlias,
  GtplAttribute,
  GtplNode,
  GtplParseResult,
  IfBranch,
  InterpolationPart,
  SwitchCaseNode,
  SwitchDefaultNode,
  TextNode,
  TextPart,
} from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/diagnostic.js';
import type { SourceSpan } from '../source/span.js';
import type { ExpressionNode } from '../ast/expression.js';
import { parseGtplExpression } from '../expression/parser.js';

const BLOCK_DIRECTIVES = ['@if', '@for', '@switch', '@let', '@case', '@default', '@empty'] as const;

class GtplParser {
  private offset = 0;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly lineStarts: number[] = [0];
  private blockDepth = 0;
  private switchCaseDepth = 0;

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
    if (this.startsWithDirective('@if')) return this.parseIfBlock();
    if (this.startsWithDirective('@for')) return this.parseForBlock();
    if (this.startsWithDirective('@switch')) return this.parseSwitchBlock();
    if (this.startsWithDirective('@let')) return this.parseLetDeclaration();
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
        if (this.blockDepth > 0 && this.peek() === '}') break;
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
    let valueStart = this.offset;
    let valueEnd = this.offset;
    if (this.peek() === '=') {
      this.offset += 1;
      this.skipWhitespace();
      const quote = this.peek();
      if (quote === '"' || quote === "'") {
        this.offset += 1;
        valueStart = this.offset;
        while (!this.eof() && this.peek() !== quote) this.offset += 1;
        valueEnd = this.offset;
        value = this.source.slice(valueStart, valueEnd);
        if (this.peek() === quote) this.offset += 1;
        else this.report('GTPL1007', 'Unterminated quoted attribute value.', start, this.offset);
      } else {
        valueStart = this.offset;
        while (!this.eof() && !this.isWhitespace(this.peek()) && this.peek() !== '>' && !this.startsWith('/>')) {
          this.offset += 1;
        }
        valueEnd = this.offset;
        value = this.source.slice(valueStart, valueEnd);
        if (value.length === 0) {
          this.report('GTPL1008', 'Expected an attribute value after "=".', start, this.offset);
        }
      }
    }

    const kind = this.attributeKind(rawName);
    const name = this.normalizedAttributeName(rawName, kind);
    const valueSpan = this.span(valueStart, valueEnd);
    const attribute: GtplAttribute = { name, value, kind, span: this.span(start, this.offset), valueSpan };
    if (kind === 'property' || kind === 'event' || kind === 'two-way' || kind === 'structural') {
      // *gefFor has a dedicated microsyntax (let item of items), parsed in a later compiler phase.
      if (!(kind === 'structural' && (name === 'for' || name === 'gefFor') && /^\s*let\s+/.test(value))) {
        const parsed = parseGtplExpression(value);
        this.reportExpressionDiagnostics(parsed, valueStart);
        if (parsed.expression) return { ...attribute, parsedExpression: parsed.expression };
      }
    }
    return attribute;
  }

  private reportExpressionDiagnostics(
    parsed: ReturnType<typeof parseGtplExpression>,
    sourceOffset: number,
  ): void {
    for (const diagnostic of parsed.diagnostics) {
      this.report(
        diagnostic.code,
        diagnostic.message,
        sourceOffset + diagnostic.span.start,
        sourceOffset + diagnostic.span.end,
      );
    }
  }

  private getTrimmedContentOffset(content: { value: string; start: number }): number {
    return content.start + content.value.length - content.value.trimStart().length;
  }

  private parseText(): TextNode {
    const start = this.offset;
    while (!this.eof() && this.peek() !== '<') {
      if (this.offset > start && this.isBlockDirectiveStart()) break;
      if (this.blockDepth > 0 && this.peek() === '}') {
        if (this.startsWith('}}')) {
          this.offset += 2;
          continue;
        }
        break;
      }
      this.offset += 1;
    }
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
      const leadingWhitespace = expression.length - expression.trimStart().length;
      const expressionStart = matchStart + 2 + leadingWhitespace;
      const expressionEnd = expressionStart + expression.trim().length;
      if (expression.trim().length === 0) {
        this.report('GTPL1010', 'Interpolation expression cannot be empty.', matchStart, start + pattern.lastIndex);
      }
      const parsed = parseGtplExpression(expression.trim());
      this.reportExpressionDiagnostics(parsed, expressionStart);
      parts.push({
        kind: 'interpolation',
        expression: expression.trim(),
        span: this.span(matchStart, start + pattern.lastIndex),
        expressionSpan: this.span(expressionStart, expressionEnd),
        ...(parsed.expression ? { parsedExpression: parsed.expression } : {}),
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


  private parseIfBlock(): GtplNode {
    const start = this.offset;
    const branches: IfBranch[] = [];
    let keyword = '@if';
    let first = true;
    let blockEnd = start;
    while (first || keyword === '@else if') {
      const branchStart = this.offset;
      first = false;
      this.offset += keyword.length;
      this.skipWhitespace();
      const conditionStart = this.offset;
      const conditionContent = this.readParenthesizedContent();
      const rawCondition = conditionContent.value.trim();
      const aliasMatch = /^(.*?);\s*as\s+([A-Za-z_$][\w$]*)\s*$/.exec(rawCondition);
      const conditionSource = aliasMatch?.[1] ?? rawCondition;
      const condition = conditionSource.trim();
      const alias = aliasMatch?.[2];
      const conditionOffset = this.getTrimmedContentOffset(conditionContent);
      if (rawCondition.includes(';') && !aliasMatch) {
        this.report('GTPL3007', 'Invalid @if alias; expected "condition; as name".', conditionStart, this.offset);
      }
      const parsed = parseGtplExpression(condition);
      this.reportExpressionDiagnostics(parsed, conditionOffset);
      this.skipWhitespace();
      const children = this.parseBraceBlock();
      blockEnd = this.offset;
      branches.push({ condition, ...(alias ? { alias } : {}), ...(parsed.expression ? { parsedCondition: parsed.expression } : {}), span: this.span(branchStart, this.offset), children });
      this.skipWhitespace();
      if (this.startsWithDirective('@else if')) { keyword = '@else if'; continue; }
      if (this.startsWithDirective('@else')) {
        const elseStart = this.offset;
        this.offset += '@else'.length;
        this.skipWhitespace();
        const elseChildren = this.parseBraceBlock();
        blockEnd = this.offset;
        branches.push({ span: this.span(elseStart, this.offset), children: elseChildren });
      }
      break;
    }
    return { kind: 'if-block', branches, span: this.span(start, blockEnd) };
  }

  private parseSwitchBlock(): GtplNode {
    const start = this.offset;
    this.offset += '@switch'.length;
    this.skipWhitespace();
    const expressionContent = this.readParenthesizedContent();
    const expression = expressionContent.value.trim();
    const expressionOffset = this.getTrimmedContentOffset(expressionContent);
    const parsedExpression = parseGtplExpression(expression);
    this.reportExpressionDiagnostics(parsedExpression, expressionOffset);
    this.skipWhitespace();
    if (this.peek() !== '{') {
      this.report('GTPL3101', 'Expected "{" after @switch expression.', this.offset, this.offset + 1);
      return { kind: 'switch-block', expression, cases: [], span: this.span(start, this.offset),
        ...(parsedExpression.expression ? { parsedExpression: parsedExpression.expression } : {}) };
    }
    this.offset += 1;
    this.blockDepth += 1;
    const cases: SwitchCaseNode[] = [];
    let defaultCase: SwitchDefaultNode | undefined;
    let sawDefault = false;
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.peek() === '}') break;
      if (this.startsWithDirective('@case')) {
        if (sawDefault) this.report('GTPL3102', '@case cannot appear after @default.', this.offset, this.offset + 5);
        const caseStart = this.offset;
        const expressions: string[] = [];
        const parsedExpressions: ExpressionNode[] = [];
        while (this.startsWithDirective('@case')) {
          this.offset += '@case'.length;
          this.skipWhitespace();
          const valueContent = this.readParenthesizedContent();
          const value = valueContent.value.trim();
          const parsed = parseGtplExpression(value);
          const valueOffset = this.getTrimmedContentOffset(valueContent);
          this.reportExpressionDiagnostics(parsed, valueOffset);
          expressions.push(value);
          if (parsed.expression) parsedExpressions.push(parsed.expression);
          else this.report('GTPL3103', 'Invalid @case expression.', valueContent.start - 1, this.offset);
          this.skipWhitespace();
        }
        const children = this.parseBraceBlock(true);
        cases.push({ expressions, parsedExpressions, span: this.span(caseStart, this.offset), children });
        continue;
      }
      if (this.startsWithDirective('@default')) {
        const defaultStart = this.offset;
        this.offset += '@default'.length;
        this.skipWhitespace();
        const duplicateDefault = sawDefault;
        if (duplicateDefault) this.report('GTPL3104', 'Only one @default block is allowed.', defaultStart, this.offset);
        sawDefault = true;
        if (this.startsWith('never') && !/[A-Za-z0-9_$]/.test(this.source[this.offset + 5] ?? '')) {
          this.offset += 'never'.length;
          this.skipWhitespace();
          let neverExpression: string | undefined;
          let parsedNeverExpression: ExpressionNode | undefined;
          if (this.peek() === '(') {
            const neverContent = this.readParenthesizedContent();
            neverExpression = neverContent.value.trim();
            const neverOffset = this.getTrimmedContentOffset(neverContent);
            const parsed = parseGtplExpression(neverExpression);
            this.reportExpressionDiagnostics(parsed, neverOffset);
            if (parsed.expression) parsedNeverExpression = parsed.expression;
            this.skipWhitespace();
          }
          if (this.peek() === ';') this.offset += 1;
          else this.report('GTPL3105', 'Expected ";" after @default never.', this.offset, this.offset + 1);
          if (!duplicateDefault) {
            defaultCase = { exhaustive: true, span: this.span(defaultStart, this.offset), children: [],
              ...(neverExpression !== undefined ? { neverExpression } : {}),
              ...(parsedNeverExpression ? { parsedNeverExpression } : {}) };
          }
        } else {
          const children = this.parseBraceBlock(true);
          if (!duplicateDefault) {
            defaultCase = { exhaustive: false, span: this.span(defaultStart, this.offset), children };
          }
        }
        continue;
      }
      this.report('GTPL3106', 'Expected @case or @default inside @switch.', this.offset, Math.min(this.offset + 1, this.source.length));
      const before = this.offset;
      const unexpected = this.parseNode();
      if (unexpected && this.offset === before) this.offset += 1;
    }
    if (this.peek() === '}') this.offset += 1;
    else this.report('GTPL3107', 'Unterminated @switch block.', this.offset, this.offset);
    this.blockDepth -= 1;
    if (cases.length === 0) this.report('GTPL3108', '@switch requires at least one @case.', start, this.offset);
    return { kind: 'switch-block', expression, cases, ...(defaultCase ? { defaultCase } : {}),
      ...(parsedExpression.expression ? { parsedExpression: parsedExpression.expression } : {}),
      span: this.span(start, this.offset) };
  }

  private parseLetDeclaration(): GtplNode {
    const start = this.offset;
    this.offset += '@let'.length;
    if (!this.isWhitespace(this.peek())) {
      this.report('GTPL3201', 'Expected whitespace after @let.', start, this.offset);
    }
    this.skipWhitespace();
    const nameStart = this.offset;
    const name = this.readIdentifier();
    if (!name) this.report('GTPL3202', 'Expected a variable name after @let.', nameStart, this.offset);
    this.skipWhitespace();
    if (this.peek() !== '=') this.report('GTPL3203', 'Expected "=" in @let declaration.', this.offset, this.offset + 1);
    else this.offset += 1;
    this.skipWhitespace();
    const expressionStart = this.offset;
    const expression = this.readUntilSemicolon();
    if (this.peek() === ';') this.offset += 1;
    else this.report('GTPL3204', 'Expected ";" to terminate @let declaration.', start, this.offset);
    const parsed = parseGtplExpression(expression);
    this.reportExpressionDiagnostics(parsed, expressionStart);
    return { kind: 'let-declaration', name, expression,
      ...(parsed.expression ? { parsedExpression: parsed.expression } : {}),
      span: this.span(start, this.offset) };
  }

  private readIdentifier(): string {
    const start = this.offset;
    if (!/[A-Za-z_$]/.test(this.peek())) return '';
    this.offset += 1;
    while (/[A-Za-z0-9_$]/.test(this.peek())) this.offset += 1;
    return this.source.slice(start, this.offset);
  }

  private readUntilSemicolon(): string {
    const start = this.offset;
    let round = 0;
    let square = 0;
    let quote = '';
    while (!this.eof()) {
      const char = this.peek();
      if (quote) {
        if (char === '\\') this.offset += 2;
        else { if (char === quote) quote = ''; this.offset += 1; }
        continue;
      }
      if (char === '"' || char === "'") { quote = char; this.offset += 1; continue; }
      if (char === '(') round += 1;
      else if (char === ')') round = Math.max(0, round - 1);
      else if (char === '[') square += 1;
      else if (char === ']') square = Math.max(0, square - 1);
      else if (round === 0 && square === 0) {
        if (char === ';') break;
        if (this.blockDepth > 0 && (char === '}' || this.isTagStart(this.offset))) break;
      }
      this.offset += 1;
    }
    return this.source.slice(start, this.offset).trim();
  }

  private parseForBlock(): GtplNode {
    const start = this.offset;
    this.offset += '@for'.length;
    this.skipWhitespace();
    const headerStart = this.offset;
    const headerContent = this.readParenthesizedContent();
    const header = headerContent.value;
    const segments = this.splitTopLevelSegments(header);
    const mainSegment = segments[0]?.value.trim() ?? '';
    const loop = /^(?:let\s+)?([A-Za-z_$][\w$]*)\s+of\s+([\s\S]+)$/.exec(mainSegment);
    if (!loop) this.report('GTPL3001', 'Invalid @for header; expected "item of iterable".', headerStart, this.offset);
    const item = loop?.[1] ?? '$item';
    const collection = loop?.[2] ?? '';
    const collectionOffset = headerContent.start + (segments[0]?.start ?? 0) + (segments[0]?.value.indexOf(collection) ?? 0);
    const parsedCollection = parseGtplExpression(collection);
    this.reportExpressionDiagnostics(parsedCollection, collectionOffset);

    let track = '';
    let trackOffset = headerStart;
    const aliases: ForContextAlias[] = [];
    let sawTrack = false;
    for (const segment of segments.slice(1)) {
      const value = segment.value.trim();
      if (value.startsWith('track ')) {
        if (sawTrack) this.report('GTPL3008', 'Only one track expression is allowed in @for.', headerContent.start + segment.start, headerContent.start + segment.start + segment.value.length);
        sawTrack = true;
        track = value.slice(6).trim();
        trackOffset = headerContent.start + segment.start + segment.value.indexOf(track);
        continue;
      }
      if (value.startsWith('let ')) {
        for (const declaration of value.slice(4).split(',')) {
          const match = /^\s*([A-Za-z_$][\w$]*)\s*=\s*(\$[A-Za-z]+)\s*$/.exec(declaration);
          if (!match) {
            this.report('GTPL3009', 'Invalid @for contextual alias; expected "let name = $index".', headerContent.start + segment.start, headerContent.start + segment.start + segment.value.length);
            continue;
          }
          const name = match[1]!;
          const context = match[2]!;
          if (!['$count', '$index', '$first', '$last', '$even', '$odd'].includes(context)) {
            this.report('GTPL3010', `Unknown @for contextual variable "${context}".`, headerContent.start + segment.start, headerContent.start + segment.start + segment.value.length);
            continue;
          }
          if (aliases.some((alias) => alias.name === name)) {
            this.report('GTPL3011', `Duplicate @for alias "${name}".`, headerContent.start + segment.start, headerContent.start + segment.start + segment.value.length);
            continue;
          }
          aliases.push({ name, context: context as ForContextAlias['context'] });
        }
        continue;
      }
      this.report('GTPL3012', 'Unsupported @for header segment; expected "track expression" or "let alias = $index".', headerContent.start + segment.start, headerContent.start + segment.start + segment.value.length);
    }
    if (!sawTrack) this.report('GTPL3002', '@for requires a track expression.', headerStart, this.offset);
    const parsedTrack = parseGtplExpression(track);
    this.reportExpressionDiagnostics(parsedTrack, trackOffset);
    this.skipWhitespace();
    const children = this.parseBraceBlock();
    let blockEnd = this.offset;
    this.skipWhitespace();
    let empty: GtplNode[] = [];
    if (this.startsWithDirective('@empty')) {
      this.offset += '@empty'.length;
      this.skipWhitespace();
      empty = this.parseBraceBlock();
      blockEnd = this.offset;
    }
    return { kind: 'for-block', item, collection, track, aliases, children, empty,
      ...(parsedCollection.expression ? { parsedCollection: parsedCollection.expression } : {}),
      ...(parsedTrack.expression ? { parsedTrack: parsedTrack.expression } : {}),
      span: this.span(start, blockEnd) };
  }

  private splitTopLevelSegments(value: string): { value: string; start: number }[] {
    const segments: { value: string; start: number }[] = [];
    let start = 0;
    let round = 0;
    let square = 0;
    let quote = '';
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index] ?? '';
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '(') round += 1;
      else if (char === ')') round = Math.max(0, round - 1);
      else if (char === '[') square += 1;
      else if (char === ']') square = Math.max(0, square - 1);
      else if (char === ';' && round === 0 && square === 0) {
        segments.push({ value: value.slice(start, index), start });
        start = index + 1;
      }
    }
    segments.push({ value: value.slice(start), start });
    return segments;
  }

  private readParenthesizedContent(): { value: string; start: number } {
    if (this.peek() !== '(') {
      this.report('GTPL3003', 'Expected "(" after control-flow keyword.', this.offset, this.offset + 1);
      return { value: '', start: this.offset };
    }
    const start = ++this.offset;
    let depth = 1;
    let quote = '';
    while (!this.eof() && depth > 0) {
      const char = this.peek();
      if (quote) {
        if (char === '\\') this.offset += 2;
        else { if (char === quote) quote = ''; this.offset += 1; }
        continue;
      }
      if (char === '"' || char === "'") { quote = char; this.offset += 1; continue; }
      if (depth === 1 && (char === '{' || char === '}')) break;
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (depth > 0) this.offset += 1;
    }
    const value = this.source.slice(start, this.offset);
    if (this.peek() === ')') this.offset += 1;
    else this.report('GTPL3004', 'Unterminated control-flow condition.', start - 1, this.offset);
    return { value, start };
  }

  private parseBraceBlock(stopAtSwitchLabel = false): GtplNode[] {
    const children: GtplNode[] = [];
    if (this.peek() !== '{') { this.report('GTPL3005', 'Expected "{" to start control-flow block.', this.offset, this.offset + 1); return children; }
    this.offset += 1;
    this.blockDepth += 1;
    if (stopAtSwitchLabel) this.switchCaseDepth += 1;
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.peek() === '}') break;
      if (this.switchCaseDepth > 0 && (this.startsWithDirective('@case') || this.startsWithDirective('@default'))) break;
      const before = this.offset;
      const node = this.parseNode();
      if (node) children.push(node);
      if (before === this.offset && this.peek() !== '}') this.offset += 1;
    }
    if (this.peek() === '}') this.offset += 1;
    else this.report('GTPL3006', 'Unterminated control-flow block.', this.offset, this.offset);
    if (stopAtSwitchLabel) this.switchCaseDepth -= 1;
    this.blockDepth -= 1;
    return children;
  }

  private isBlockDirectiveStart(): boolean {
    return BLOCK_DIRECTIVES.some((keyword) => this.startsWithDirective(keyword));
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

  private startsWithDirective(value: string): boolean {
    return this.startsWith(value)
      && !/[A-Za-z0-9_$]/.test(this.source[this.offset + value.length] ?? '');
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
