import type {
  ElementNode,
  ForBlockNode,
  GtplNode,
  IfBlockNode,
  SwitchBlockNode,
  TextNode,
} from '../ast/types.js';
import type { ExpressionNode } from '../ast/expression.js';
import { emitGtplExpression } from './expression.js';

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

interface RootNodeMapping {
  readonly generatedColumn: number;
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
  }
}

function isWhitespaceOnlyText(node: GtplNode): boolean {
  return node.kind === 'text'
    && node.parts.every((part) => part.kind === 'text' && /^\s*$/.test(part.value));
}

function expression(node: ExpressionNode | undefined, locals: ReadonlySet<string>, options: GtplTemplateOptions): string {
  if (!node) throw new Error('Cannot generate GTPL: an expression has no valid AST.');
  const identifiers = new Set<string>();
  collectIdentifiers(node, identifiers);
  const globals = new Set([...BUILTIN_GLOBALS, ...(options.globals ?? [])]);
  const contextIdentifiers = options.componentMembers
    ?? [...identifiers].filter((name) => !locals.has(name) && !globals.has(name));
  return emitGtplExpression(node, {
    contextIdentifiers,
    localIdentifiers: [...locals, ...globals],
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
): { code: string; rootMappings: RootNodeMapping[] } {
  const rootMappings: RootNodeMapping[] = [];
  const renderNodes = (items: readonly GtplNode[], parentLocals: ReadonlySet<string>, captureRootNodes = false): string => {
    const locals = new Set(parentLocals);
    const statements: string[] = [];
    const rendered: string[] = [];
    const renderedNodes: GtplNode[] = [];
    const contentNodes = items.filter((node) => !isWhitespaceOnlyText(node));
    const isElementContainer = contentNodes.length > 0
      && contentNodes.every((node) => node.kind === 'element');
    const nodes = isElementContainer ? contentNodes : items;

    for (const node of nodes) {
      if (node.kind === 'let-declaration') {
        const value = expression(node.parsedExpression, locals, options);
        statements.push(`const ${node.name} = ${value};`);
        locals.add(node.name);
        continue;
      }
      rendered.push(renderNode(node, locals));
      if (captureRootNodes) renderedNodes.push(node);
    }

    const contentPrefix = rendered.length > 1 ? 'runtime.fragment([' : '';
    const content = rendered.length === 0
      ? 'runtime.fragment([])'
      : rendered.length === 1 ? rendered[0]! : contentPrefix + rendered.join(', ') + '])';
    const statementPrefix = statements.length === 0 ? '' : '(() => { ' + statements.join(' ') + ' return ';
    if (captureRootNodes) {
      let generatedColumn = '(ctx, runtime) => '.length + statementPrefix.length + contentPrefix.length;
      for (let index = 0; index < renderedNodes.length; index += 1) {
        const node = renderedNodes[index]!;
        rootMappings.push({
          generatedColumn,
          sourceLine: node.span.line - 1,
          sourceColumn: node.span.column - 1,
        });
        generatedColumn += rendered[index]!.length + (index < renderedNodes.length - 1 ? 2 : 0);
      }
    }
    return statementPrefix + content + (statements.length === 0 ? '' : ' })()');
  };

  const renderText = (node: TextNode, locals: ReadonlySet<string>): string => {
    const value = node.parts.map((part) => part.kind === 'text'
      ? JSON.stringify(part.value)
      : `String(${expression(part.parsedExpression, locals, options)} ?? '')`);
    if (value.length === 0) return 'runtime.text("")';
    const text = value.length === 1 ? value[0] : value.join(' + ');
    return node.parts.some((part) => part.kind === 'interpolation')
      ? `runtime.text(runtime.bind(() => ${text}))`
      : `runtime.text(${text})`;
  };

  const renderElement = (node: ElementNode, locals: ReadonlySet<string>): string => {
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
        const emitted = expression(attribute.parsedExpression, attributeLocals, options);
        value = attribute.kind === 'event'
          ? `($event) => ${emitted}`
          : attribute.kind === 'property' ? `runtime.bind(() => ${emitted})` : emitted;
      }
      attributes.push(`${JSON.stringify(attribute.name)}: ${value}`);
    }
    const children = node.children.length > 0 ? renderNodes(node.children, locals) : 'undefined';
    return `runtime.element(${JSON.stringify(node.name)}, { ${attributes.join(', ')} }, ${children})`;
  };

  const renderIf = (node: IfBlockNode, locals: ReadonlySet<string>): string => {
    let fallback = 'runtime.fragment([])';
    for (let index = node.branches.length - 1; index >= 0; index -= 1) {
      const branch = node.branches[index]!;
      if (branch.parsedCondition) {
        const condition = expression(branch.parsedCondition, locals, options);
        const render = branch.alias
          ? `(${branch.alias}) => ${renderNodes(branch.children, new Set([...locals, branch.alias]))}`
          : `() => ${renderNodes(branch.children, locals)}`;
        fallback = `runtime.if(runtime.bind(() => ${condition}), ${render}, () => ${fallback})`;
      } else {
        fallback = renderNodes(branch.children, locals);
      }
    }
    return fallback;
  };

  const renderFor = (node: ForBlockNode, locals: ReadonlySet<string>): string => {
    const loopLocals = new Set([...locals, node.item, '$index', '$count', '$first', '$last', '$even', '$odd', ...node.aliases.map((alias) => alias.name)]);
    const aliases = node.aliases.map((alias) => `const ${alias.name} = ${alias.context};`).join(' ');
    const body = renderNodes(node.children, loopLocals);
    const empty = renderNodes(node.empty, locals);
    const collection = expression(node.parsedCollection, locals, options);
    const track = expression(node.parsedTrack, loopLocals, options);
    return `runtime.for(runtime.bind(() => ${collection}), (${node.item}, $index, $count) => { const $first = $index === 0; const $last = $index === $count - 1; const $even = $index % 2 === 0; const $odd = !$even; ${aliases} return ${body}; }, (${node.item}, $index, $count) => { const $first = $index === 0; const $last = $index === $count - 1; const $even = $index % 2 === 0; const $odd = !$even; ${aliases} return ${track}; }, () => ${empty})`;
  };

  const renderSwitch = (node: SwitchBlockNode, locals: ReadonlySet<string>): string => {
    const cases = node.cases.map((branch) => {
      const values = branch.parsedExpressions.map((item) => expression(item, locals, options));
      return `{ values: [${values.join(', ')}], render: () => ${renderNodes(branch.children, locals)} }`;
    });
    const fallback = node.defaultCase && !node.defaultCase.exhaustive
      ? `() => ${renderNodes(node.defaultCase.children, locals)}`
      : 'undefined';
    return `runtime.switch(runtime.bind(() => ${expression(node.parsedExpression, locals, options)}), [${cases.join(', ')}], ${fallback})`;
  };

  const renderNode = (node: GtplNode, locals: ReadonlySet<string>): string => {
    switch (node.kind) {
      case 'text': return renderText(node, locals);
      case 'element': return renderElement(node, locals);
      case 'if-block': return renderIf(node, locals);
      case 'for-block': return renderFor(node as ForBlockNode, locals);
      case 'switch-block': return renderSwitch(node, locals);
      case 'let-declaration': return 'runtime.fragment([])';
    }
  };

  return { code: '(ctx, runtime) => ' + renderNodes(nodes, new Set(), true), rootMappings };
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

function createMappings(mappings: readonly RootNodeMapping[]): string {
  let previousGeneratedColumn = 0;
  let previousSourceLine = 0;
  let previousSourceColumn = 0;
  return mappings.map((mapping) => {
    const segment = [
      encodeVlq(mapping.generatedColumn - previousGeneratedColumn),
      encodeVlq(0),
      encodeVlq(mapping.sourceLine - previousSourceLine),
      encodeVlq(mapping.sourceColumn - previousSourceColumn),
    ].join('');
    previousGeneratedColumn = mapping.generatedColumn;
    previousSourceLine = mapping.sourceLine;
    previousSourceColumn = mapping.sourceColumn;
    return segment;
  }).join(',');
}

/** Emits a render function and a source map for its top-level GTPL nodes. */
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
      mappings: createMappings(generated.rootMappings),
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
