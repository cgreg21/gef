import type { ExpressionNode } from '../ast/expression.js';

export interface GtplExpressionOptions {
  /** Component members are read from the generated render function's context. */
  readonly contextIdentifiers?: readonly string[];
  /** Names already declared in the current generated lexical scope. */
  readonly localIdentifiers?: readonly string[];
}

/**
 * Emits a JavaScript expression from the GTPL expression AST.
 *
 * Composite expressions are parenthesized to preserve AST grouping without
 * maintaining a second operator-precedence table.
 */
export function emitGtplExpression(
  expression: ExpressionNode,
  options: GtplExpressionOptions = {},
): string {
  return emitInternal(expression, options);
}

export function emitGtplExpressionWithMarkers(
  expression: ExpressionNode,
  options: GtplExpressionOptions,
  markNode: (node: ExpressionNode) => string,
): string {
  return emitInternal(expression, options, markNode);
}

function emitInternal(
  expression: ExpressionNode,
  options: GtplExpressionOptions,
  markNode?: (node: ExpressionNode) => string,
): string {
  const context = new Set(options.contextIdentifiers ?? []);
  const locals = new Set(options.localIdentifiers ?? []);
  const emit = (node: ExpressionNode): string => {
    const marker = markNode?.(node) ?? '';
    let code: string;
    switch (node.kind) {
      case 'literal':
        code = JSON.stringify(node.value); break;
      case 'identifier':
        code = context.has(node.name) && !locals.has(node.name) ? `ctx.${node.name}` : node.name; break;
      case 'member': {
        const object = emit(node.object);
        if (node.computed) {
          const property = typeof node.property === 'string' ? JSON.stringify(node.property) : emit(node.property);
          code = node.optional ? `(${object}?.[${property}])` : `(${object}[${property}])`; break;
        }
        const property = String(node.property);
        code = node.optional ? `(${object}?.${property})` : `(${object}.${property})`; break;
      }
      case 'call': {
        const callee = emit(node.callee);
        const optional = node.optional ? '?.' : '';
        code = `(${callee}${optional}(${node.arguments.map(emit).join(', ')}))`; break;
      }
      case 'unary':
        code = `(${node.operator}${emit(node.argument)})`; break;
      case 'binary':
        code = `(${emit(node.left)} ${node.operator} ${emit(node.right)})`; break;
      case 'conditional':
        code = `(${emit(node.test)} ? ${emit(node.consequent)} : ${emit(node.alternate)})`; break;
      case 'assignment':
        code = `(${emit(node.target)} = ${emit(node.value)})`; break;
      case 'pipe':
        code = `runtime.pipe(${JSON.stringify(node.name)}, ${emit(node.expression)}${node.arguments.length ? `, ${node.arguments.map(emit).join(', ')}` : ''})`; break;
      case 'array':
        code = `[${node.elements.map(emit).join(', ')}]`; break;
      case 'object':
        code = `{${node.properties.map(({ key, value }) => `${JSON.stringify(key)}: ${emit(value)}`).join(', ')}}`; break;
    }
    return marker + code!;
  };
  return emit(expression);
}
