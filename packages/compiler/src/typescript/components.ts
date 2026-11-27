import { dirname, resolve } from 'node:path';
import * as ts from 'typescript';

export interface TypeScriptComponentDiscoveryOptions {
  readonly configFilePath?: string;
}

export interface TypeScriptComponentDescriptor {
  readonly className: string;
  readonly fileName: string;
  readonly selector: string;
  readonly template?: string;
  readonly templateUrl?: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly componentMembers: readonly string[];
}

export interface TypeScriptComponentDiscoveryResult {
  readonly success: boolean;
  readonly components: readonly TypeScriptComponentDescriptor[];
  readonly diagnostics: readonly ts.Diagnostic[];
}

const DISCOVERY_DIAGNOSTIC = 99001;

function diagnostic(node: ts.Node, sourceFile: ts.SourceFile, message: string): ts.Diagnostic {
  return {
    category: ts.DiagnosticCategory.Error,
    code: DISCOVERY_DIAGNOSTIC,
    file: sourceFile,
    start: node.pos,
    length: node.end - node.pos,
    messageText: message,
  };
}

function decorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

function decoratorCall(node: ts.Decorator): ts.CallExpression | undefined {
  return ts.isCallExpression(node.expression) ? node.expression : undefined;
}

function decoratorName(call: ts.CallExpression): string | undefined {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return undefined;
}

function stringValue(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function propertyValue(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  const property = object.properties.find((item) =>
    ts.isPropertyAssignment(item)
    && ((ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name));
  return property && ts.isPropertyAssignment(property) ? property.initializer : undefined;
}

function memberName(member: ts.ClassElement): string | undefined {
  if (!('name' in member) || !member.name) return undefined;
  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name)) {
    return member.name.text;
  }
  return undefined;
}

function isUnavailableMember(member: ts.ClassElement): boolean {
  if (!ts.canHaveModifiers(member)) return false;
  return (ts.getModifiers(member) ?? []).some((modifier) =>
    modifier.kind === ts.SyntaxKind.StaticKeyword
    || modifier.kind === ts.SyntaxKind.PrivateKeyword
    || modifier.kind === ts.SyntaxKind.ProtectedKeyword);
}

function collectBindings(
  declaration: ts.ClassDeclaration,
  kind: 'Input' | 'Output',
): string[] {
  const bindings: string[] = [];
  for (const member of declaration.members) {
    if (!ts.isPropertyDeclaration(member)) continue;
    const name = memberName(member);
    if (!name) continue;
    for (const decorator of decorators(member)) {
      const call = decoratorCall(decorator);
      if (!call || decoratorName(call) !== kind) continue;
      bindings.push(stringValue(call.arguments[0]) ?? name);
    }
  }
  return bindings;
}

function discoverComponent(
  declaration: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  diagnostics: ts.Diagnostic[],
): TypeScriptComponentDescriptor | undefined {
  const componentDecorator = decorators(declaration).find((decorator) => {
    const call = decoratorCall(decorator);
    return call !== undefined && decoratorName(call) === 'Component';
  });
  if (!componentDecorator) return undefined;

  const call = decoratorCall(componentDecorator);
  const options = call?.arguments[0];
  if (!options || !ts.isObjectLiteralExpression(options)) {
    diagnostics.push(diagnostic(componentDecorator, sourceFile, '@Component requires a static object literal.'));
    return undefined;
  }

  const selector = stringValue(propertyValue(options, 'selector'));
  const template = stringValue(propertyValue(options, 'template'));
  const templateUrl = stringValue(propertyValue(options, 'templateUrl'));
  if (!selector || Boolean(template) === Boolean(templateUrl)) {
    diagnostics.push(diagnostic(
      options,
      sourceFile,
      '@Component requires a static selector and exactly one non-empty template or templateUrl.',
    ));
    return undefined;
  }

  const componentMembers = declaration.members
    .filter((member) => !isUnavailableMember(member))
    .map(memberName)
    .filter((name): name is string => name !== undefined);
  const inputs = collectBindings(declaration, 'Input');
  const outputs = collectBindings(declaration, 'Output');

  return {
    className: declaration.name?.text ?? 'default',
    fileName: sourceFile.fileName,
    selector,
    ...(template !== undefined ? { template } : {}),
    ...(templateUrl !== undefined ? { templateUrl } : {}),
    inputs,
    outputs,
    componentMembers,
  };
}

/**
 * Finds statically declared @Component classes in the files selected by tsconfig.
 * This reads TypeScript syntax only; it does not import or instantiate application code.
 */
export function discoverTypeScriptComponents(
  options: TypeScriptComponentDiscoveryOptions = {},
): TypeScriptComponentDiscoveryResult {
  const configFilePath = resolve(options.configFilePath ?? 'tsconfig.json');
  const config = ts.readConfigFile(configFilePath, ts.sys.readFile);
  if (config.error) {
    return { success: false, components: [], diagnostics: [config.error] };
  }

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(configFilePath),
    undefined,
    configFilePath,
  );
  if (parsed.errors.length > 0) {
    return { success: false, components: [], diagnostics: parsed.errors };
  }

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = [...program.getSyntacticDiagnostics()];
  const components: TypeScriptComponentDescriptor[] = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !parsed.fileNames.includes(sourceFile.fileName)) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node)) {
        const component = discoverComponent(node, sourceFile, diagnostics);
        if (component) components.push(component);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return {
    success: !diagnostics.some((item) => item.category === ts.DiagnosticCategory.Error),
    components,
    diagnostics,
  };
}
