import type {
  ElementNode,
  ForBlockNode,
  GtplNode,
  IfBlockNode,
  SwitchBlockNode,
  TextNode,
} from '../ast/types.js';
import type { ExpressionNode } from '../ast/expression.js';
import { emitGtplExpressionWithMarkers } from './expression.js';

export interface GtplTemplateOptions {
  /** Component fields referenced by expressions; emitted as ctx.field. */
  readonly componentMembers?: readonly string[];
  /** Framework globals which should remain unqualified. */
  readonly globals?: readonly string[];
}

export interface GtplSourceMapOptions extends GtplTemplateOptions {
  readonly source: string;
  readonly sourceContent?: string;
  readonly file?: string;
}

export interface GtplSourceMap {
  readonly version: 3;
  readonly file?: string;
  readonly sources: readonly string[];
  readonly sourcesContent?: readonly string[];
  readonly names: readonly string[];
  readonly mappings: string;
}

export interface GtplTemplateWithSourceMap {
  readonly code: string;
  readonly map: GtplSourceMap;
}

interface NodeMapping {
  generatedLine: number;
  generatedColumn: number;
  readonly sourceLine: number;
  readonly sourceColumn: number;
}

const BUILTIN_GLOBALS = new Set([
  'Array', 'BigInt', 'Boolean', 'Date', 'Infinity', 'Intl', 'JSON',
  'Math', 'NaN', 'Number', 'Object', 'String', 'undefined',
  'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'ctx',
]);

function collectIdentifiers(node: ExpressionNode, names: Set<string>): void {
  switch (node.kind) {
    case 'literal':
      return;
    case 'identifier':
      names.add(node.name);
      return;
    case 'member':
      collectIdentifiers(node.object, names);
      if (node.computed && typeof node.property !== 'string') collectIdentifiers(node.property, names);
      return;
    case 'call':
      collectIdentifiers(node.callee, names);
      for (const argument of node.arguments) collectIdentifiers(argument, names);
      return;
    case 'unary':
      collectIdentifiers(node.argument, names);
      return;
    case 'binary':
      collectIdentifiers(node.left, names);
      collectIdentifiers(node.right, names);
      return;
    case 'conditional':
      collectIdentifiers(node.test, names);
      collectIdentifiers(node.consequent, names);
      collectIdentifiers(node.alternate, names);
      return;
    case 'assignment':
      collectIdentifiers(node.target, names);
      collectIdentifiers(node.value, names);
      return;
    case 'pipe':
      collectIdentifiers(node.expression, names);
      for (const argument of node.arguments) collectIdentifiers(argument, names);
      return;
    case 'array':
      for (const element of node.elements) collectIdentifiers(element, names);
      return;
    case 'object':
      for (const property of node.properties) collectIdentifiers(property.value, names);
  }
}

function collectTemplateNames(nodes: readonly GtplNode[], names: Set<string>): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'let-declaration':
        names.add(node.name);
        if (node.parsedExpression) collectIdentifiers(node.parsedExpression, names);
        break;
      case 'text':
        for (const part of node.parts) if (part.kind === 'interpolation' && part.parsedExpression) collectIdentifiers(part.parsedExpression, names);
        break;
      case 'element':
        for (const attribute of node.attributes) if (attribute.parsedExpression) collectIdentifiers(attribute.parsedExpression, names);
        collectTemplateNames(node.children, names);
        break;
      case 'if-block':
        for (const branch of node.branches) {
          if (branch.alias) names.add(branch.alias);
          if (branch.parsedCondition) collectIdentifiers(branch.parsedCondition, names);
          collectTemplateNames(branch.children, names);
        }
        break;
      case 'for-block':
        names.add(node.item);
        for (const alias of node.aliases) names.add(alias.name);
        if (node.parsedCollection) collectIdentifiers(node.parsedCollection, names);
        if (node.parsedTrack) collectIdentifiers(node.parsedTrack, names);
        collectTemplateNames(node.children, names);
        collectTemplateNames(node.empty, names);
        break;
      case 'switch-block':
        if (node.parsedExpression) collectIdentifiers(node.parsedExpression, names);
        for (const branch of node.cases) {
          for (const value of branch.parsedExpressions) collectIdentifiers(value, names);
          collectTemplateNames(branch.children, names);
        }
        if (node.defaultCase) collectTemplateNames(node.defaultCase.children, names);
        break;
    }
  }
}

function isWhitespaceOnlyText(node: GtplNode): boolean {
  return node.kind === 'text'
    && node.parts.every((part) => part.kind === 'text' && /^\s*$/.test(part.value));
}

function expression(
  node: ExpressionNode | undefined,
  locals: ReadonlySet<string>,
  options: GtplTemplateOptions,
  mappings?: NodeMapping[],
  sourcePosition?: { line: number; column: number },
  sourceExpression?: string,
  localBindings?: ReadonlyMap<string, string>,
): string {
  if (!node) throw new Error('Cannot generate GTPL: an expression has no valid AST.');
  const identifiers = new Set<string>();
  collectIdentifiers(node, identifiers);
  const globals = new Set([...BUILTIN_GLOBALS, ...(options.globals ?? [])]);
  const contextIdentifiers = options.componentMembers
    ?? [...identifiers].filter((name) => !locals.has(name) && !globals.has(name));
  const expressionOptions = {
    contextIdentifiers,
    localIdentifiers: [...locals, ...globals],
    ...(localBindings ? { localBindings } : {}),
  };
  if (!mappings || !sourcePosition || sourceExpression === undefined) {
    return emitGtplExpressionWithMarkers(node, expressionOptions, () => '');
  }
  return emitGtplExpressionWithMarkers(node, expressionOptions, (part) => {
    const marker = mappings.length;
    const prefix = sourceExpression.slice(0, part.span.start);
    const lines = prefix.split(/\r\n|\r|\n/);
    const line = sourcePosition.line + lines.length - 1;
    const column = lines.length === 1 ? sourcePosition.column + prefix.length : lines[lines.length - 1]!.length + 1;
    mappings.push({ generatedLine: 0, generatedColumn: 0, sourceLine: line - 1, sourceColumn: column - 1 });
    return `/*__GEF_MAP_${marker}__*/`;
  });
}

/**
 * Emits a render function using the small GtplRenderRuntime contract:
 * element(name, attributes, children), text(value), fragment(children),
 * if(condition, render), for(collection, renderItem, trackBy, renderEmpty),
 * and switch(value, cases, renderDefault).
 *
 * The function returns source only; it does not evaluate templates or provide
 * a renderer. Runtime implementations own native widget creation and cleanup.
 */
function emitGtplTemplateInternal(
  nodes: readonly GtplNode[],
  options: GtplTemplateOptions,
): { code: string; nodeMappings: NodeMapping[] } {
  const nodeMappings: NodeMapping[] = [];
  const reservedNames = new Set<string>();
  collectTemplateNames(nodes, reservedNames);
  let generatedNameIndex = 0;
  const nextGeneratedName = (): string => {
    let name: string;
    do { name = `$__gefLet${generatedNameIndex++}`; } while (reservedNames.has(name));
    reservedNames.add(name);
    return name;
  };
  const renderNodes = (
    items: readonly GtplNode[],
    parentLocals: ReadonlySet<string>,
    parentLetBindings: ReadonlyMap<string, string> = new Map(),
  ): string => {
    const locals = new Set(parentLocals);
    const letBindings = new Map(parentLetBindings);
    const statements: string[] = [];
    const rendered: string[] = [];
    const contentNodes = items.filter((node) => !isWhitespaceOnlyText(node));
    const isElementContainer = contentNodes.length > 0
      && contentNodes.every((node) => node.kind === 'element');
    const nodes = isElementContainer ? contentNodes : items;

    for (const node of nodes) {
      if (node.kind === 'let-declaration') {
        const value = expression(node.parsedExpression, locals, options, nodeMappings, node.expressionSpan, node.expression, letBindings);
        const getter = nextGeneratedName();
        statements.push(`const ${getter} = () => ${value};`);
        locals.add(node.name);
        letBindings.set(node.name, getter);
        continue;
      }
      rendered.push(renderNode(node, locals, letBindings));
    }

    const contentPrefix = rendered.length > 1 ? 'runtime.fragment([' : '';
    const content = rendered.length === 0
      ? 'runtime.fragment([])'
      : rendered.length === 1 ? rendered[0]! : contentPrefix + '\n  ' + rendered.join(',\n  ') + '\n])';
    const statementPrefix = statements.length === 0 ? '' : '(() => {\n  ' + statements.join('\n  ') + '\n  return ';
    return statementPrefix + content + (statements.length === 0 ? '' : '\n})()');
  };

  const renderText = (node: TextNode, locals: ReadonlySet<string>, letBindings: ReadonlyMap<string, string>): string => {
    const value = node.parts.map((part) => part.kind === 'text'
      ? JSON.stringify(part.value)
      : `String(${expression(part.parsedExpression, locals, options, nodeMappings, part.expressionSpan, part.expression, letBindings)} ?? '')`);
    if (value.length === 0) return 'runtime.text("")';
    const text = value.length === 1 ? value[0] : value.join(' + ');
    return node.parts.some((part) => part.kind === 'interpolation')
      ? `runtime.text(runtime.bind(() => ${text}))`
      : `runtime.text(${text})`;
  };

  const renderElement = (node: ElementNode, locals: ReadonlySet<string>, letBindings: ReadonlyMap<string, string>): string => {
    const attributes: string[] = [];
    for (const attribute of node.attributes) {
      if (attribute.kind === 'structural' || attribute.kind === 'two-way') {
        throw new Error(`Cannot generate GTPL: ${attribute.kind} attribute "*${attribute.name}" requires a lowering pass.`);
      }
      let value: string;
      if (attribute.kind === 'static' || attribute.kind === 'reference') {
        value = JSON.stringify(attribute.value);
      } else {
        const attributeLocals = attribute.kind === 'event' ? new Set([...locals, '$event']) : locals;
        const attributeLetBindings = attribute.kind === 'event'
          ? withoutBinding(letBindings, '$event')
          : letBindings;
        const emitted = expression(attribute.parsedExpression, attributeLocals, options, nodeMappings, {
          line: attribute.valueSpan.line,
          column: attribute.valueSpan.column,
        }, attribute.value, attributeLetBindings);
        value = attribute.kind === 'event'
          ? `($event) => ${emitted}`
          : attribute.kind === 'property' ? `runtime.bind(() => ${emitted})` : emitted;
      }
      const name = attribute.kind === 'property' && attribute.name === 'class' ? 'classBinding'
        : attribute.kind === 'property' && attribute.name === 'style' ? 'styleBinding'
          : attribute.name;
      attributes.push(`${JSON.stringify(name)}: ${value}`);
    }
    const children = node.children.length > 0 ? renderNodes(node.children, locals, letBindings) : 'undefined';
    const attributeObject = attributes.length === 0
      ? '{}'
      : `{\n  ${attributes.join(',\n  ')}\n}`;
    return `runtime.element(${JSON.stringify(node.name)}, ${attributeObject}, ${children})`;
  };

  const renderIf = (node: IfBlockNode, locals: ReadonlySet<string>, letBindings: ReadonlyMap<string, string>): string => {
    let fallback = 'runtime.fragment([])';
    for (let index = node.branches.length - 1; index >= 0; index -= 1) {
      const branch = node.branches[index]!;
      if (branch.parsedCondition) {
        const condition = expression(branch.parsedCondition, locals, options, nodeMappings, branch.conditionSpan, branch.condition, letBindings);
        const render = branch.alias
          ? `(${branch.alias}) => ${renderNodes(branch.children, new Set([...locals, branch.alias]), withoutBinding(letBindings, branch.alias))}`
          : `() => ${renderNodes(branch.children, locals, letBindings)}`;
        fallback = `runtime.if(runtime.bind(() => ${condition}), ${render}, () => ${fallback})`;
      } else {
        fallback = renderNodes(branch.children, locals, letBindings);
      }
    }
    return fallback;
  };

  const renderFor = (node: ForBlockNode, locals: ReadonlySet<string>, letBindings: ReadonlyMap<string, string>): string => {
    const loopNames = [node.item, '$index', '$count', '$first', '$last', '$even', '$odd', ...node.aliases.map((alias) => alias.name)];
    const loopLocals = new Set([...locals, ...loopNames]);
    const loopLetBindings = withoutBindings(letBindings, loopNames);
    const aliases = node.aliases.map((alias) => `const ${alias.name} = ${alias.context};`).join(' ');
    const aliasLines = aliases ? `${aliases}\n    ` : '';
    const body = renderNodes(node.children, loopLocals, loopLetBindings);
    const empty = renderNodes(node.empty, locals, letBindings);
    const collection = expression(node.parsedCollection, locals, options, nodeMappings, node.collectionSpan, node.collection, letBindings);
    const track = expression(node.parsedTrack, loopLocals, options, nodeMappings, node.trackSpan, node.track, loopLetBindings);
    return `runtime.for(
  runtime.bind(() => ${collection}),
  (${node.item}, $index, $count) => {
    const $first = $index === 0;
    const $last = $index === $count - 1;
    const $even = $index % 2 === 0;
    const $odd = !$even;
    ${aliasLines}return ${body};
  },
  (${node.item}, $index, $count) => {
    const $first = $index === 0;
    const $last = $index === $count - 1;
    const $even = $index % 2 === 0;
    const $odd = !$even;
    ${aliasLines}return ${track};
  },
  () => ${empty}
)`;
  };

  const renderSwitch = (node: SwitchBlockNode, locals: ReadonlySet<string>, letBindings: ReadonlyMap<string, string>): string => {
    const cases = node.cases.map((branch) => {
      const values = branch.parsedExpressions.map((item, index) => expression(item, locals, options, nodeMappings, branch.expressionSpans[index], branch.expressions[index], letBindings));
      return `{ values: [${values.join(', ')}], render: () => ${renderNodes(branch.children, locals, letBindings)} }`;
    });
    const fallback = node.defaultCase && !node.defaultCase.exhaustive
      ? `() => ${renderNodes(node.defaultCase.children, locals, letBindings)}`
      : 'undefined';
    return `runtime.switch(runtime.bind(() => ${expression(node.parsedExpression, locals, options, nodeMappings, node.expressionSpan, node.expression, letBindings)}), [${cases.join(', ')}], ${fallback})`;
  };

  const renderNode = (node: GtplNode, locals: ReadonlySet<string>, letBindings: ReadonlyMap<string, string>): string => {
    const marker = nodeMappings.length;
    nodeMappings.push({ generatedLine: 0, generatedColumn: 0, sourceLine: node.span.line - 1, sourceColumn: node.span.column - 1 });
    let rendered: string;
    switch (node.kind) {
      case 'text': rendered = renderText(node, locals, letBindings); break;
      case 'element': rendered = renderElement(node, locals, letBindings); break;
      case 'if-block': rendered = renderIf(node, locals, letBindings); break;
      case 'for-block': rendered = renderFor(node as ForBlockNode, locals, letBindings); break;
      case 'switch-block': rendered = renderSwitch(node, locals, letBindings); break;
      case 'let-declaration': rendered = 'runtime.fragment([])'; break;
    }
    return `/*__GEF_MAP_${marker}__*/${rendered}`;
  };

  const withoutBinding = (bindings: ReadonlyMap<string, string>, name: string): Map<string, string> => {
    const result = new Map(bindings);
    result.delete(name);
    return result;
  };
  const withoutBindings = (bindings: ReadonlyMap<string, string>, names: readonly string[]): Map<string, string> => {
    const result = new Map(bindings);
    for (const name of names) result.delete(name);
    return result;
  };

  const markedCode = '(ctx, runtime) => {\n  return ' + renderNodes(nodes, new Set()) + ';\n}';
  const formattedCode = markedCode;
  let result = '';
  let cursor = 0;
  let generatedLine = 0;
  let generatedColumn = 0;
  const markerPattern = /\/\*__GEF_MAP_(\d+)__\*\//g;
  for (const match of formattedCode.matchAll(markerPattern)) {
    const offset = match.index!;
    let before = formattedCode.slice(cursor, offset);
    if (before.endsWith('  ')) before = before.replace(/ +$/, ' ');
    if (before.endsWith(' ') && /[([{]$/.test(before.trimEnd())) before = before.slice(0, -1);
    result += before;
    const lines = before.split('\n');
    if (lines.length > 1) {
      generatedLine += lines.length - 1;
      generatedColumn = lines[lines.length - 1]!.length;
    } else {
      generatedColumn += before.length;
    }
    const mapping = nodeMappings[Number(match[1])];
    if (!mapping) throw new Error('Cannot generate GTPL source map: unknown mapping marker.');
    mapping.generatedLine = generatedLine;
    mapping.generatedColumn = generatedColumn;
    cursor = offset + match[0].length;
    while (formattedCode[cursor] === ' ' || formattedCode[cursor] === '\t') cursor += 1;
  }
  result += formattedCode.slice(cursor);
  return { code: result, nodeMappings };
}



function encodeVlq(value: number): string {
  const signed = value < 0 ? (-value << 1) | 1 : value << 1;
  let remaining = signed;
  let encoded = '';
  do {
    let digit = remaining & 31;
    remaining >>>= 5;
    if (remaining > 0) digit |= 32;
    encoded += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[digit]!;
  } while (remaining > 0);
  return encoded;
}

function createMappings(mappings: readonly NodeMapping[]): string {
  const lines: string[][] = [];
  let previousGeneratedLine = -1;
  let previousGeneratedColumn = 0;
  let previousSourceLine = 0;
  let previousSourceColumn = 0;
  for (const mapping of [...mappings].sort((left, right) =>
    left.generatedLine - right.generatedLine || left.generatedColumn - right.generatedColumn)) {
    if (mapping.generatedLine !== previousGeneratedLine) {
      previousGeneratedLine = mapping.generatedLine;
      previousGeneratedColumn = 0;
      lines[previousGeneratedLine] ??= [];
    }
    lines[previousGeneratedLine]!.push([
      encodeVlq(mapping.generatedColumn - previousGeneratedColumn),
      encodeVlq(0),
      encodeVlq(mapping.sourceLine - previousSourceLine),
      encodeVlq(mapping.sourceColumn - previousSourceColumn),
    ].join(''));
    previousGeneratedColumn = mapping.generatedColumn;
    previousSourceLine = mapping.sourceLine;
    previousSourceColumn = mapping.sourceColumn;
  }
  return lines.map((segments) => (segments ?? []).join(',')).join(';');
}

/** Emits a render function and source mappings for every rendered GTPL node. */
export function emitGtplTemplateWithSourceMap(
  nodes: readonly GtplNode[],
  options: GtplSourceMapOptions,
): GtplTemplateWithSourceMap {
  const { source, sourceContent, file, ...templateOptions } = options;
  const generated = emitGtplTemplateInternal(nodes, templateOptions);
  return {
    code: generated.code,
    map: {
      version: 3,
      ...(file ? { file } : {}),
      sources: [source],
      ...(sourceContent === undefined ? {} : { sourcesContent: [sourceContent] }),
      names: [],
      mappings: createMappings(generated.nodeMappings),
    },
  };
}

/** Emits a render function without source-map metadata. */
export function emitGtplTemplate(
  nodes: readonly GtplNode[],
  options: GtplTemplateOptions = {},
): string {
  return emitGtplTemplateInternal(nodes, options).code;
}
