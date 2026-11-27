import { dirname, resolve } from 'node:path';
import * as ts from 'typescript';

export interface TypeScriptProjectOptions {
  configFilePath?: string;
  outDir?: string;
}

export interface TypeScriptProjectResult {
  success: boolean;
  emittedFiles: string[];
  diagnostics: readonly ts.Diagnostic[];
}

export function compileTypeScriptProject(
  options: TypeScriptProjectOptions = {},
): TypeScriptProjectResult {
  const configFilePath = resolve(options.configFilePath ?? 'tsconfig.json');
  const config = ts.readConfigFile(configFilePath, ts.sys.readFile);

  if (config.error) {
    return { success: false, emittedFiles: [], diagnostics: [config.error] };
  }

  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(configFilePath),
    {
      noEmit: false,
      noEmitOnError: true,
      emitDeclarationOnly: false,
      declaration: false,
      declarationMap: false,
      ...(options.outDir ? { outDir: resolve(options.outDir) } : {}),
    },
    configFilePath,
  );

  if (parsed.errors.length > 0) {
    return { success: false, emittedFiles: [], diagnostics: parsed.errors };
  }

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = [...ts.getPreEmitDiagnostics(program)];

  if (diagnostics.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
    return { success: false, emittedFiles: [], diagnostics };
  }

  const emittedFiles: string[] = [];
  const emit = program.emit(undefined, (fileName, content) => {
    ts.sys.writeFile(fileName, content);
    emittedFiles.push(fileName);
  });
  diagnostics.push(...emit.diagnostics);

  return {
    success: !emit.emitSkipped
      && !diagnostics.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error),
    emittedFiles,
    diagnostics,
  };
}
