#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkGtpl, emitGtplTemplate, validateStCss } from '../../compiler/src/index.js';

export interface CliIO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  run(command: string, args: readonly string[]): { status: number | null; output: string };
  stdout(message: string): void;
  stderr(message: string): void;
}

const defaultIO: CliIO = {
  readFile: (path) => readFile(path, 'utf8'),
  writeFile: (path, content) => writeFile(path, content, 'utf8'),
  mkdir: async (path) => mkdir(path, { recursive: true }).then(() => undefined),
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
  gef styles <input.scss> [output.css]
  gef new <extension-name> [directory]
  gef generate component <Name> [directory]
  gef build
  gef test
  gef package
  gef watch
  gef doctor
  gef --help

Commands:
  check      Parse, lower and validate a GTPL template.
  compile    Emit a JavaScript render-function module.
  styles     Compile SCSS and validate GNOME theme CSS compatibility.
  new        Create a minimal GNOME Shell 51 extension project.
  generate   Generate a component class and GTPL template.
  build      Build the current project.
  test       Run the current project test suite.
  package    Build and stage the GNOME Shell example.
  watch      Rebuild and restage examples when source files change.
  doctor     Check local Node.js and Sass prerequisites.

Generated render modules receive the runtime and native renderer from the extension.`;

function reportCssDiagnostics(source: string, input: string, io: CliIO): number {
  const diagnostics = validateStCss(source);
  for (const item of diagnostics) io.stderr(`${input}:${item.line}:${item.column}: ${item.code}: ${item.message}`);
  return diagnostics.length;
}

export async function runCli(args: readonly string[] = process.argv.slice(2), io: CliIO = defaultIO): Promise<number> {
  const [command, inputArg, outputArg] = args;
  if (!command || command === '--help' || command === '-h') {
    io.stdout(usage);
    return 0;
  }

  if (command === 'doctor') {
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    const sass = io.run('npx', ['sass', '--version']);
    io.stdout(`Node.js: ${process.versions.node}\nSass: ${sass.status === 0 ? sass.output.trim() : 'not installed'}`);
    return nodeMajor >= 22 && sass.status === 0 ? 0 : 1;
  }

  if (command === 'build' || command === 'test' || command === 'package' || command === 'watch') {
    let scripts: string[][];
    if (command === 'build') scripts = [['build']];
    else if (command === 'test') scripts = [['test']];
    else if (command === 'watch') scripts = [['dev:watch']];
    else {
      try {
        const project = JSON.parse(await io.readFile(resolve('package.json'))) as { scripts?: { package?: string } };
        scripts = project.scripts?.package ? [['package']] : [['build'], ['package:example']];
      } catch {
        scripts = [['build'], ['package:example']];
      }
    }
    for (const [script] of scripts) {
      const result = io.run('npm', ['run', script!]);
      if (result.output) io.stdout(result.output.trimEnd());
      if (result.status !== 0) return 1;
    }
    return 0;
  }

  if (command === 'styles') {
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
      const count = reportCssDiagnostics(css, output, io);
      if (count > 0) return 1;
    } catch (error) {
      io.stderr(`Unable to read compiled stylesheet: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    io.stdout(`Compiled and validated stylesheet: ${output}`);
    return 0;
  }

  if (command === 'new') {
    const name = inputArg;
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      io.stderr('Extension name must use lowercase letters, digits and hyphens.');
      return 2;
    }
    const directory = resolve(outputArg ?? name);
    const className = name.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('');
    const files: Readonly<Record<string, string>> = {
      'metadata.json': JSON.stringify({ uuid: `${name}@example.com`, name, description: `A GEF extension: ${name}`, 'shell-version': ['51'], version: 1 }, null, 2) + '\n',
      'extension.ts': `import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';\n\nexport default class ${className}Extension extends Extension {\n  enable(): void {}\n  disable(): void {}\n}\n`,
      'gjs.d.ts': `declare module 'resource:///org/gnome/shell/extensions/extension.js' {\n  export class Extension { enable(): void; disable(): void; }\n}\n`,
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, rootDir: '.', outDir: 'dist', types: [] }, include: ['extension.ts', 'gjs.d.ts'] }, null, 2) + '\n',
      'package.json': JSON.stringify({ name, version: '1.0.0', private: true, type: 'module', scripts: { build: 'tsc -p tsconfig.json', package: 'npm run build && cp metadata.json dist/metadata.json && gnome-extensions pack dist' }, dependencies: { 'gnome-extension-framework': '^0.1.0' }, devDependencies: { typescript: '^5.9.3' } }, null, 2) + '\n',
      'README.md': `# ${name}\n\nA GNOME Shell 51 extension generated by GEF.\n\nInstall dependencies with \`npm install\`, build with \`gef build\`, and package with \`gef package\`.\n`,
    };
    try {
      await io.mkdir(directory);
      for (const [path, source] of Object.entries(files)) await io.writeFile(resolve(directory, path), source);
    } catch (error) {
      io.stderr(`Unable to generate project: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    io.stdout(`Created extension project: ${directory}`);
    return 0;
  }

  if (command === 'generate') {
    if (inputArg !== 'component' || !outputArg || !/^[A-Z][A-Za-z0-9]*$/.test(outputArg)) {
      io.stderr('Usage: gef generate component <PascalCaseName> [directory]');
      return 2;
    }
    const name = outputArg;
    const directory = resolve(args[3] ?? '.');
    try {
      await io.mkdir(directory);
      const template = `<StBox>\\n  <StLabel>${name}</StLabel>\\n</StBox>`;
      await io.writeFile(resolve(directory, `${name}.ts`), `import { Component } from 'gnome-extension-framework';\n\n@Component({ selector: '${name}', template: ${JSON.stringify(template)} })\nexport class ${name} {}\n`);
      await io.writeFile(resolve(directory, `${name}.gtpl`), `<StBox>\n  <StLabel>${name}</StLabel>\n</StBox>\n`);
    } catch (error) {
      io.stderr(`Unable to generate component: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    io.stdout(`Generated component ${name} in ${directory}`);
    return 0;
  }

  if (command !== 'check' && command !== 'compile') {
    io.stderr(`Unknown command "${command}".\n\n${usage}`);
    return 2;
  }
  if (!inputArg || inputArg.startsWith('-')) {
    io.stderr(`Missing template path.\n\n${usage}`);
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

  const result = checkGtpl(source);
  for (const diagnostic of result.diagnostics) {
    io.stderr(`${input}:${diagnostic.span.line}:${diagnostic.span.column}: ${diagnostic.code}: ${diagnostic.message}`);
  }
  if (result.diagnostics.length > 0) return 1;
  if (command === 'check') {
    io.stdout(`GTPL validation passed: ${input}`);
    return 0;
  }

  const output = resolve(outputArg ?? `${input}.js`);
  const generated = `// Generated by GEF. Do not edit.\nexport default ${emitGtplTemplate(result.nodes)};\n`;
  try {
    await io.writeFile(output, generated);
  } catch (error) {
    io.stderr(`Unable to write "${output}": ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  io.stdout(`Generated: ${output}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().then((code) => { process.exitCode = code; });
}
