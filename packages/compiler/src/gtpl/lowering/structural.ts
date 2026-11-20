import type { ElementNode, ForBlockNode, GtplNode, IfBlockNode } from '../ast/types.js';
import type { ExpressionNode } from '../ast/expression.js';
import type { Diagnostic } from '../diagnostics/diagnostic.js';
import { parseGtplExpression } from '../expression/parser.js';

export interface GtplLoweringResult {
  readonly nodes: readonly GtplNode[];
  readonly diagnostics: readonly Diagnostic[];
}

const CONTEXT_ALIASES: Readonly<Record<string, ForBlockNode['aliases'][number]['context']>> = {
  count: '$count',
  index: '$index',
  first: '$first',
  last: '$last',
  even: '$even',
  odd: '$odd',
  '$count': '$count',
  '$index': '$index',
  '$first': '$first',
  '$last': '$last',
  '$even': '$even',
  '$odd': '$odd',
};

function parseExpression(
  source: string,
  span: ElementNode['span'],
  diagnostics: Diagnostic[],
): ExpressionNode | undefined {
  const parsed = parseGtplExpression(source.trim());
  for (const item of parsed.diagnostics) {
    diagnostics.push({
      code: item.code,
      message: item.message,
      span: {
        start: span.start + item.span.start,
        end: span.start + item.span.end,
        line: span.line,
        column: span.column + item.span.start,
      },
    });
  }
  return parsed.expression ?? undefined;
}

function splitMicrosyntax(source: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    else if (char === ';' && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
}

function lowerFor(element: ElementNode, value: string, diagnostics: Diagnostic[]): ForBlockNode | undefined {
  const segments = splitMicrosyntax(value);
  const loop = /^(?:let\s+)?([A-Za-z_$][\w$]*)\s+of\s+([\s\S]+)$/.exec(segments[0] ?? '');
  if (!loop) {
    diagnostics.push({ code: 'GTPL4203', message: 'Invalid *for syntax; expected "let item of iterable".', span: element.span });
    return undefined;
  }

  const item = loop[1]!;
  const collection = loop[2]!.trim();
  let trackSource = item;
  let sawTrack = false;
  const aliases: ForBlockNode['aliases'][number][] = [];
  for (const segment of segments.slice(1)) {
    const track = /^(?:track|trackBy:)\s*([\s\S]+)$/.exec(segment);
    if (track) {
      if (sawTrack) {
        diagnostics.push({ code: 'GTPL4204', message: 'Only one track expression is allowed in *for.', span: element.span });
      } else {
        trackSource = track[1]!.trim();
        sawTrack = true;
      }
      continue;
    }

    const alias = /^let\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)$/.exec(segment);
    if (alias) {
      const context = CONTEXT_ALIASES[alias[2]!];
      if (!context) {
        diagnostics.push({ code: 'GTPL4205', message: `Unknown *for contextual variable "${alias[2]}".`, span: element.span });
      } else if (aliases.some((entry) => entry.name === alias[1])) {
        diagnostics.push({ code: 'GTPL4206', message: `Duplicate *for alias "${alias[1]}".`, span: element.span });
      } else {
        aliases.push({ name: alias[1]!, context });
      }
      continue;
    }

    diagnostics.push({ code: 'GTPL4207', message: `Unsupported *for segment "${segment}".`, span: element.span });
  }

  const parsedCollection = parseExpression(collection, element.span, diagnostics);
  const parsedTrack = parseExpression(trackSource, element.span, diagnostics);
  if (!parsedCollection || !parsedTrack) return undefined;
  return {
    kind: 'for-block',
    item,
    collection,
    parsedCollection,
    track: trackSource,
    parsedTrack,
    aliases,
    children: [element],
    empty: [],
    span: element.span,
  };
}

function lowerElement(element: ElementNode, diagnostics: Diagnostic[]): GtplNode {
  const structural = element.attributes.filter((attribute) => attribute.kind === 'structural');
  const children = lowerNodes(element.children, diagnostics);
  const cleanElement: ElementNode = {
    ...element,
    attributes: element.attributes.filter((attribute) => attribute.kind !== 'structural'),
    children,
  };
  if (structural.length === 0) return cleanElement;
  if (structural.length > 1) {
    diagnostics.push({ code: 'GTPL4201', message: 'Only one structural directive is allowed on an element.', span: structural[1]!.span });
  }

  const directive = structural[0]!;
  if (directive.name === 'if' || directive.name === 'gefIf') {
    const condition = directive.parsedExpression;
    if (!condition) {
      diagnostics.push({ code: 'GTPL4202', message: 'Invalid *if expression.', span: directive.valueSpan });
      return cleanElement;
    }
    const branch: IfBlockNode['branches'][number] = {
      condition: directive.value,
      parsedCondition: condition,
      span: directive.span,
      children: [cleanElement],
    };
    return { kind: 'if-block', branches: [branch], span: element.span };
  }

  if (directive.name === 'for' || directive.name === 'gefFor') {
    return lowerFor(cleanElement, directive.value, diagnostics) ?? cleanElement;
  }

  diagnostics.push({
    code: 'GTPL4202',
    message: `Unsupported structural directive "*${directive.name}".`,
    span: directive.span,
  });
  return cleanElement;
}

function lowerNodes(nodes: readonly GtplNode[], diagnostics: Diagnostic[]): GtplNode[] {
  return nodes.map((node) => {
    if (node.kind === 'element') return lowerElement(node, diagnostics);
    if (node.kind === 'if-block') {
      return { ...node, branches: node.branches.map((branch) => ({ ...branch, children: lowerNodes(branch.children, diagnostics) })) };
    }
    if (node.kind === 'for-block') {
      return { ...node, children: lowerNodes(node.children, diagnostics), empty: lowerNodes(node.empty, diagnostics) };
    }
    if (node.kind === 'switch-block') {
      return {
        ...node,
        cases: node.cases.map((branch) => ({ ...branch, children: lowerNodes(branch.children, diagnostics) })),
        ...(node.defaultCase ? { defaultCase: { ...node.defaultCase, children: lowerNodes(node.defaultCase.children, diagnostics) } } : {}),
      };
    }
    return node;
  });
}

/** Lowers supported structural attributes into the compiler's control-flow AST. */
export function lowerGtplStructuralDirectives(nodes: readonly GtplNode[]): GtplLoweringResult {
  const diagnostics: Diagnostic[] = [];
  return { nodes: lowerNodes(nodes, diagnostics), diagnostics };
}
