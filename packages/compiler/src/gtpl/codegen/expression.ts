import type { ExpressionNode } from '../ast/expression.js';

/**
 * Emits a JavaScript expression from the GTPL expression AST.
 *
 * Every composite expression is parenthesized so the generated source keeps
 * the AST's grouping without maintaining a second precedence table.
 */
export function emitGtplExpression(expression: ExpressionNode): string {
  switch (expression.kind) {
    case 'literal':
      return JSON.stringify(expression.value);
    case 'identifier':
      return expression.name;
    case 'member': {
      const object = emitGtplExpression(expression.object);
      if (expression.computed) {
        const property = typeof expression.property === 'string'
          ? JSON.stringify(expression.property)
          : emitGtplExpression(expression.property);
        return expression.optional
          ? `(${object}?.[${property}])`
          : `(${object}[${property}])`;
      }
      const property = String(expression.property);
      return expression.optional
        ? `(${object}?.${property})`
        : `(${object}.${property})`;
    }
    case 'call': {
      const callee = emitGtplExpression(expression.callee);
      const optional = expression.optional ? '?.' : '';
      const args = expression.arguments.map(emitGtplExpression).join(', ');
      return `(${callee}${optional}(${args}))`;
    }
    case 'unary':
      return `(${expression.operator}${emitGtplExpression(expression.argument)})`;
    case 'binary':
      return `(${emitGtplExpression(expression.left)} ${expression.operator} ${emitGtplExpression(expression.right)})`;
    case 'conditional':
      return `(${emitGtplExpression(expression.test)} ? ${emitGtplExpression(expression.consequent)} : ${emitGtplExpression(expression.alternate)})`;
    case 'array':
      return `[${expression.elements.map(emitGtplExpression).join(', ')}]`;
  }
}
