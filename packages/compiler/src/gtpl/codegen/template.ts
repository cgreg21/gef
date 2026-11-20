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

function expression(node: ExpressionNode | undefined, locals: ReadonlySet<string>, options: GtplTemplateOptions): string {
  if (!node) throw new Error('Cannot generate GTPL: an expression has no valid AST.');
  return emitGtplExpression(node, {
    ...(options.componentMembers ? { contextIdentifiers: options.componentMembers } : {}),
    localIdentifiers: [...locals, ...(options.globals ?? [])],
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
export function emitGtplTemplate(
  nodes: readonly GtplNode[],
  options: GtplTemplateOptions = {},
): string {
  const renderNodes = (items: readonly GtplNode[], parentLocals: ReadonlySet<string>): string => {
    const locals = new Set(parentLocals);
    const statements: string[] = [];
    const rendered: string[] = [];

    for (const node of items) {
      if (node.kind === 'let-declaration') {
        const value = expression(node.parsedExpression, locals, options);
        statements.push(`const ${node.name} = ${value};`);
        locals.add(node.name);
        continue;
      }
      rendered.push(renderNode(node, locals));
    }

    return `(() => { ${statements.join(' ')} return runtime.fragment([${rendered.join(', ')}]); })()`;
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
    return `runtime.element(${JSON.stringify(node.name)}, { ${attributes.join(', ')} }, ${renderNodes(node.children, locals)})`;
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
    return `runtime.for(${collection}, (${node.item}, $index, $count) => { const $first = $index === 0; const $last = $index === $count - 1; const $even = $index % 2 === 0; const $odd = !$even; ${aliases} return ${body}; }, (${node.item}, $index, $count) => { const $first = $index === 0; const $last = $index === $count - 1; const $even = $index % 2 === 0; const $odd = !$even; ${aliases} return ${track}; }, () => ${empty})`;
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

  return `(ctx, runtime) => ${renderNodes(nodes, new Set())}`;
}
