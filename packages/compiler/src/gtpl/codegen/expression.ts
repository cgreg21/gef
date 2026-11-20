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
  const context = new Set(options.contextIdentifiers ?? []);
  const locals = new Set(options.localIdentifiers ?? []);
  const emit = (node: ExpressionNode): string => {
    switch (node.kind) {
      case 'literal':
        return JSON.stringify(node.value);
      case 'identifier':
        return context.has(node.name) && !locals.has(node.name) ? `ctx.${node.name}` : node.name;
      case 'member': {
        const object = emit(node.object);
        if (node.computed) {
          const property = typeof node.property === 'string' ? JSON.stringify(node.property) : emit(node.property);
          return node.optional ? `(${object}?.[${property}])` : `(${object}[${property}])`;
        }
        const property = String(node.property);
        return node.optional ? `(${object}?.${property})` : `(${object}.${property})`;
      }
      case 'call': {
        const callee = emit(node.callee);
        const optional = node.optional ? '?.' : '';
        return `(${callee}${optional}(${node.arguments.map(emit).join(', ')}))`;
      }
      case 'unary':
        return `(${node.operator}${emit(node.argument)})`;
      case 'binary':
        return `(${emit(node.left)} ${node.operator} ${emit(node.right)})`;
      case 'conditional':
        return `(${emit(node.test)} ? ${emit(node.consequent)} : ${emit(node.alternate)})`;
      case 'assignment':
        return `(${emit(node.target)} = ${emit(node.value)})`;
      case 'array':
        return `[${node.elements.map(emit).join(', ')}]`;
    }
  };
  return emit(expression);
}
