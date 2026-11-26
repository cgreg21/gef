import { resolve } from 'node:path';
import type { CliIO } from '../index.js';
import { validateWorkspaceConfig } from '../validation.js';

type WorkspaceCommand = 'build' | 'test' | 'package' | 'watch';

export async function runWorkspaceCommand(
  command: WorkspaceCommand,
  io: Pick<CliIO, 'readFile' | 'run' | 'stdout' | 'stderr'>,
): Promise<number> {
  try {
    const error = validateWorkspaceConfig(await io.readFile(resolve('gef.json')));
    if (error) throw new Error(error);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      io.stderr(`Invalid project configuration: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }

  let scripts: string[][];
  if (command === 'build') scripts = [['build']];
  else if (command === 'test') scripts = [['test']];
  else if (command === 'watch') scripts = [['dev:watch']];
  else {
    try {
      const project = JSON.parse(await io.readFile(resolve('package.json'))) as { scripts?: { package?: string } };
      scripts = project.scripts?.package ? [['npm', 'run', 'package']] : [['npm', 'run', 'build'], ['npm', 'run', 'package:example']];
    } catch {
      scripts = [['npm', 'run', 'build'], ['npm', 'run', 'package:example']];
    }
  }

  for (const script of scripts) {
    const executable = script[0]!;
    const scriptArgs = script.slice(1);
    const result = executable === 'node-gtk'
      ? io.run('npx', ['--no-install', 'node-gtk', ...scriptArgs])
      : io.run(executable === 'npm' ? executable : 'npm', executable === 'npm' ? scriptArgs : ['run', executable]);
    if (result.output) io.stdout(result.output.trimEnd());
    if (result.status !== 0) return 1;
  }
  return 0;
}
