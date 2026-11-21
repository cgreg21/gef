import * as ts from 'typescript';
import type { GtplNode } from '../ast/types.js';
import type { ExpressionNode } from '../ast/expression.js';
import type { SourceSpan } from '../source/span.js';
import type { Diagnostic } from '../diagnostics/diagnostic.js';
import { emitGtplExpression } from '../codegen/expression.js';

interface TemplateExpression {
  readonly expression: ExpressionNode;
  readonly span: SourceSpan;
}

function collectExpressions(nodes: readonly GtplNode[], output: TemplateExpression[] = []): TemplateExpression[] {
  for (const node of nodes) {
    if (node.kind === 'text') {
      for (const part of node.parts) if (part.kind === 'interpolation' && part.parsedExpression) {
        output.push({ expression: part.parsedExpression, span: part.expressionSpan });
      }
    } else if (node.kind === 'element') {
      for (const attribute of node.attributes) if (attribute.parsedExpression) {
        output.push({ expression: attribute.parsedExpression, span: attribute.valueSpan });
      }
      collectExpressions(node.children, output);
    } else if (node.kind === 'if-block') {
      for (const branch of node.branches) {
        if (branch.parsedCondition) output.push({ expression: branch.parsedCondition, span: branch.span });
        collectExpressions(branch.children, output);
      }
    } else if (node.kind === 'for-block') {
      if (node.parsedCollection) output.push({ expression: node.parsedCollection, span: node.span });
      if (node.parsedTrack) output.push({ expression: node.parsedTrack, span: node.span });
      collectExpressions(node.children, output);
      collectExpressions(node.empty, output);
    } else if (node.kind === 'switch-block') {
      if (node.parsedExpression) output.push({ expression: node.parsedExpression, span: node.span });
      for (const branch of node.cases) {
        for (const expression of branch.parsedExpressions) output.push({ expression, span: branch.span });
        collectExpressions(branch.children, output);
      }
      if (node.defaultCase?.parsedNeverExpression) output.push({ expression: node.defaultCase.parsedNeverExpression, span: node.defaultCase.span });
      if (node.defaultCase) collectExpressions(node.defaultCase.children, output);
    } else if (node.kind === 'let-declaration' && node.parsedExpression) {
      output.push({ expression: node.parsedExpression, span: node.span });
    }
  }
  return output;
}

function collectLocals(nodes: readonly GtplNode[], locals = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.kind === 'for-block') {
      locals.add(node.item);
      locals.add('$index'); locals.add('$count'); locals.add('$first');
      locals.add('$last'); locals.add('$even'); locals.add('$odd');
      for (const alias of node.aliases) locals.add(alias.name);
      collectLocals(node.children, locals);
      collectLocals(node.empty, locals);
    } else if (node.kind === 'if-block') {
      for (const branch of node.branches) {
        if (branch.alias) locals.add(branch.alias);
        collectLocals(branch.children, locals);
      }
    } else if (node.kind === 'element') collectLocals(node.children, locals);
    else if (node.kind === 'switch-block') {
      for (const branch of node.cases) collectLocals(branch.children, locals);
      if (node.defaultCase) collectLocals(node.defaultCase.children, locals);
    } else if (node.kind === 'let-declaration') locals.add(node.name);
  }
  return locals;
}

/** Type-checks every parsed template expression against a TypeScript context type literal. */
export function validateGtplExpressionTypes(
  nodes: readonly GtplNode[],
  contextType: string,
): readonly Diagnostic[] {
  const expressions = collectExpressions(nodes);
  if (expressions.length === 0) return [];
  const locals = collectLocals(nodes);
  locals.add('$event');
  const declarations = [...locals]
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'ctx')
    .map((name) => `const ${name}: any = undefined;`)
    .join(' ');
  const context = `type __GefContext = ${contextType};\ndeclare const runtime: { pipe(name: string, value: unknown, ...args: unknown[]): unknown };\n`;
  const lines = expressions.map(({ expression }, index) => {
    const emitted = emitGtplExpression(expression, { contextIdentifiers: contextMembers(contextType), localIdentifiers: [...locals] });
    return `const __gefCheck${index} = (ctx: __GefContext) => { ${declarations} return ${emitted}; };`;
  });
  const fileName = '/__gef_template_typecheck__.ts';
  const source = context + lines.join('\n');
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
    name === fileName ? ts.createSourceFile(name, source, languageVersion, true)
      : originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
  const originalFileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name === fileName || originalFileExists(name);
  const originalReadFile = host.readFile.bind(host);
  host.readFile = (name) => name === fileName ? source : originalReadFile(name);
  const program = ts.createProgram([fileName], options, host);
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) return [];
  const diagnostics: Diagnostic[] = [];
  for (const diagnostic of program.getSemanticDiagnostics(sourceFile)) {
    if (!diagnostic.start) continue;
    const line = sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line;
    const expressionIndex = line - 2;
    const target = expressions[Math.max(0, Math.min(expressions.length - 1, expressionIndex))];
    if (!target) continue;
    diagnostics.push({
      code: 'GTPL5001',
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      span: target.span,
    });
  }
  return diagnostics;
}

function contextMembers(contextType: string): readonly string[] {
  const source = ts.createSourceFile('context.ts', `type __GefContext = ${contextType};`, ts.ScriptTarget.Latest, true);
  const declaration = source.statements[0];
  if (!declaration || !ts.isTypeAliasDeclaration(declaration) || !ts.isTypeLiteralNode(declaration.type)) return [];
  return declaration.type.members.flatMap((member) => {
    if (!('name' in member) || !member.name) return [];
    if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) return [member.name.text];
    return [];
  });
}
