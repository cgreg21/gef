import { resolve } from 'node:path';
import type { CliIO } from '../index.js';
import { reportCssDiagnostics } from '../validation.js';

export async function runStyles(
  inputArg: string | undefined,
  outputArg: string | undefined,
  io: Pick<CliIO, 'run' | 'readFile' | 'stderr' | 'stdout'>,
): Promise<number> {
  if (!inputArg || inputArg.startsWith('-')) {
    io.stderr('Missing SCSS input path.');
    return 2;
  }

  const input = resolve(inputArg);
  const output = resolve(outputArg ?? (input.replace(/\.scss$/i, '') + '.css'));
  const result = io.run('npx', ['sass', '--no-source-map', input, output]);
  if (result.status !== 0) {
    io.stderr(result.output || 'Sass compiler failed. Install project dependencies.');
    return 1;
  }

  try {
    const css = await io.readFile(output);
    if (reportCssDiagnostics(css, output, io.stderr) > 0) return 1;
  } catch (error) {
    io.stderr(`Unable to read compiled stylesheet: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  io.stdout(`Compiled and validated stylesheet: ${output}`);
  return 0;
}
