import { basename, dirname, resolve } from 'node:path';
import { compileGtplToUiIr, compileGtkNative } from '../../../compiler/src/index.js';
import { formatDiagnostic } from '../validation.js';
import type { CliIO } from '../index.js';

const nativeElements = ['GtkBox', 'GtkLabel', 'GtkButton', 'GtkEntry', 'GtkCheckButton'];
const usage = 'Usage: gef compile-native <view.gtpl> [output-file] [--native-source file.c] [--callback method=symbol]';

export async function runCompileNative(
  args: readonly string[],
  io: Pick<CliIO, 'readFile' | 'stdout' | 'stderr'>,
): Promise<number> {
  let inputArg: string | undefined;
  let outputArg: string | undefined;
  const nativeSources: string[] = [];
  const callbacks: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) continue;
    if (argument === '--native-source') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) { io.stderr(usage); return 2; }
      nativeSources.push(resolve(value));
      index += 1;
    } else if (argument === '--callback') {
      const value = args[index + 1];
      const match = value?.match(/^([A-Za-z_$][A-Za-z0-9_$]*)=([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!match || Object.hasOwn(callbacks, match[1]!)) { io.stderr(usage); return 2; }
      callbacks[match[1]!] = match[2]!;
      index += 1;
    } else if (argument.startsWith('-')) {
      io.stderr(`Unexpected option: ${argument}\n${usage}`); return 2;
    } else if (!inputArg) inputArg = argument;
    else if (!outputArg) outputArg = argument;
    else { io.stderr(`Unexpected argument: ${argument}\n${usage}`); return 2; }
  }

  if (!inputArg) { io.stderr(usage); return 2; }
  const input = resolve(inputArg);
  let source: string;
  try { source = await io.readFile(input); }
  catch (error) {
    io.stderr(`Unable to read "${input}": ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  const ir = compileGtplToUiIr(source, { strictComponents: true, nativeElements });
  for (const diagnostic of ir.diagnostics) io.stderr(formatDiagnostic(source, input, diagnostic));
  if (!ir.success) return 1;

  const defaultName = basename(input).replace(/\\.gtpl$/i, '') || 'application';
  const outputFile = resolve(outputArg ?? resolve(dirname(input), defaultName));
  const result = await compileGtkNative(ir.nodes, {
    outputFile,
    ...(nativeSources.length ? { nativeSources } : {}),
    ...(Object.keys(callbacks).length ? { callbacks } : {}),
  });
  for (const diagnostic of result.diagnostics) io.stderr(diagnostic);
  if (!result.success) return 1;
  io.stdout(`Generated native GTK4 executable: ${result.outputFile}`);
  return 0;
}
