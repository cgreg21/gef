import { basename, dirname, resolve } from 'node:path';
import { compileGtplToUiIr, compileGtkNative } from '../../../compiler/src/index.js';
import { formatDiagnostic } from '../validation.js';
import type { CliIO } from '../index.js';

const nativeElements = ['GtkBox', 'GtkLabel', 'GtkButton'];

export async function runCompileNative(
  inputArg: string | undefined,
  outputArg: string | undefined,
  io: Pick<CliIO, 'readFile' | 'stdout' | 'stderr'>,
): Promise<number> {
  if (!inputArg || inputArg.startsWith('-')) {
    io.stderr('Usage: gef compile-native <view.gtpl> [output-file]');
    return 2;
  }

  const input = resolve(inputArg);
  let source: string;
  try {
    source = await io.readFile(input);
  } catch (error) {
    io.stderr(`Unable to read "${input}": ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  const ir = compileGtplToUiIr(source, { strictComponents: true, nativeElements });
  for (const diagnostic of ir.diagnostics) io.stderr(formatDiagnostic(source, input, diagnostic));
  if (!ir.success) return 1;

  const defaultName = basename(input).replace(/\.gtpl$/i, '') || 'application';
  const outputFile = resolve(outputArg ?? resolve(dirname(input), defaultName));
  const result = await compileGtkNative(ir.nodes, { outputFile });
  for (const diagnostic of result.diagnostics) io.stderr(diagnostic);
  if (!result.success) return 1;

  io.stdout(`Generated native GTK4 executable: ${result.outputFile}`);
  return 0;
}