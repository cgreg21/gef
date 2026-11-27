import { resolve } from 'node:path';
import * as ts from 'typescript';
import { compileTypeScriptProject } from '../../../compiler/src/index.js';

export async function runCompileTypeScript(
  args: readonly string[],
  io: Pick<import('../index.js').CliIO, 'stdout' | 'stderr'>,
): Promise<number> {
  let projectPath = 'tsconfig.json';
  let outDir: string | undefined;
  let projectProvided = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--project' || argument === '-p') {
      const value = args[index + 1];
      if (!value || value.startsWith('-') || projectProvided) {
        io.stderr('Usage: gef compile-ts [tsconfig.json] [--project tsconfig.json] [--out-dir directory]');
        return 2;
      }
      projectPath = value;
      projectProvided = true;
      index += 1;
    } else if (argument === '--out-dir') {
      const value = args[index + 1];
      if (!value || value.startsWith('-') || outDir !== undefined) {
        io.stderr('Usage: gef compile-ts [tsconfig.json] [--project tsconfig.json] [--out-dir directory]');
        return 2;
      }
      outDir = value;
      index += 1;
    } else if (argument.startsWith('-') || projectProvided || args.slice(0, index).some((item) => !item.startsWith('-') && item !== '')) {
      io.stderr(`Unexpected argument: ${argument}`);
      return 2;
    } else {
      projectPath = argument;
      projectProvided = true;
    }
  }

  try {
    const result = compileTypeScriptProject({
      configFilePath: resolve(projectPath),
      ...(outDir ? { outDir: resolve(outDir) } : {}),
    });
    if (result.diagnostics.length > 0) {
      const host: ts.FormatDiagnosticsHost = {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      };
      io.stderr(ts.formatDiagnostics(result.diagnostics, host).trimEnd());
    }
    if (!result.success) return 1;

    io.stdout(`TypeScript compilation succeeded: ${result.emittedFiles.length} files emitted.`);
    return 0;
  } catch (error) {
    io.stderr(`TypeScript compilation failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
