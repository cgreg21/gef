#!/usr/bin/env node
import { access, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runGenerate } from './commands/generate.js';
import { runNew } from './commands/new.js';
import { runDoctor } from './commands/doctor.js';
import { runStyles } from './commands/styles.js';
import { runWorkspaceCommand } from './commands/workspace.js';
import { runEgoCheck } from './commands/ego-check.js';
import { runTemplateCommand } from './commands/template.js';
import { runCompileTypeScript } from './commands/compile-ts.js';
import { runCompileNative } from './commands/compile-native.js';

export interface CliIO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  fileExists?(path: string): Promise<boolean>;
  run(command: string, args: readonly string[]): { status: number | null; output: string };
  stdout(message: string): void;
  stderr(message: string): void;
}

const defaultIO: CliIO = {
  readFile: (path) => readFile(path, 'utf8'),
  writeFile: (path, content) => writeFile(path, content, 'utf8'),
  fileExists: async (path) => access(path).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  }),
  mkdir: async (path) => mkdir(path, { recursive: true }).then(() => undefined),
  listFiles: async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? defaultIO.listFiles(path) : [path];
    }));
    return nested.flat();
  },
  run: (command, args) => {
    const result = spawnSync(command, [...args], { encoding: 'utf8' });
    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  },
  stdout: (message) => process.stdout.write(`${message}\n`),
  stderr: (message) => process.stderr.write(`${message}\n`),
};

const usage = `GEF - GNOME Extension Framework

Usage:
  gef check <template.gtpl>
  gef compile <template.gtpl> [output.js]
  gef compile-ts [tsconfig.json] [--project tsconfig.json] [--out-dir directory]
  gef styles <input.scss> [output.css]
  gef new <project-name> [directory] [--type application|extension]
  gef generate component <Name> [directory]
  gef generate directive <Name> [directory]
  gef generate service <Name> [directory]
  gef generate pipe <Name> [directory]
  gef build
  gef test
  gef package
  gef watch
  gef doctor
  gef ego-check <staged-extension-directory>
  gef --help

Commands:
  check      Parse, lower and validate a GTPL template.
  compile    Emit a JavaScript render-function module.
  compile-ts Compile a TypeScript project and report type diagnostics.
  styles     Compile SCSS and validate GNOME theme CSS compatibility.
  new        Create a Node-GTK application or GNOME Shell extension project.
  generate   Generate a component, directive, service or pipe.
  build      Build the current project.
  test       Run the current project test suite.
  package    Package the current extension or native application for this host.
  watch      Rebuild and restage examples when source files change.
  doctor     Check Node.js, Sass and native GNOME prerequisites.
  ego-check  Validate a staged extension against basic EGO requirements.

Generated render modules receive the runtime and native renderer from the extension.`;

export async function runCli(args: readonly string[] = process.argv.slice(2), io: CliIO = defaultIO): Promise<number> {
  const [command, inputArg, outputArg] = args;
  if (!command || command === '--help' || command === '-h') {
    io.stdout(usage);
    return 0;
  }

  if (command === 'ego-check') return runEgoCheck(inputArg, io);
  if (command === 'doctor') return runDoctor(io);

  if (command === 'build' || command === 'test' || command === 'package' || command === 'watch') {
    return runWorkspaceCommand(command, io);
  }

  if (command === 'compile-ts') return runCompileTypeScript(args.slice(1), io);
  if (command === 'compile-native') return runCompileNative(inputArg, outputArg, io);

  if (command === 'styles') return runStyles(inputArg, outputArg, io);

  if (command === 'new') return runNew(inputArg, args, io);

  if (command === 'generate') return runGenerate(inputArg, outputArg, args, io);

  if (command === 'check' || command === 'compile') return runTemplateCommand(command, inputArg, outputArg, io, usage);

  io.stderr(`Unknown command: ${command}\n\n${usage}`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().then((code) => { process.exitCode = code; });
}
