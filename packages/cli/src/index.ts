#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkGtpl, emitGtplTemplateWithSourceMap, validateStCss } from '../../compiler/src/index.js';

export interface CliIO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  run(command: string, args: readonly string[]): { status: number | null; output: string };
  stdout(message: string): void;
  stderr(message: string): void;
}

const defaultIO: CliIO = {
  readFile: (path) => readFile(path, 'utf8'),
  writeFile: (path, content) => writeFile(path, content, 'utf8'),
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
  gef styles <input.scss> [output.css]
  gef new <project-name> [directory] [--type application|extension]
  gef generate component <Name> [directory]
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
  styles     Compile SCSS and validate GNOME theme CSS compatibility.
  new        Create a Node-GTK application or GNOME Shell extension project.
  generate   Generate a component class and GTPL template.
  build      Build the current project.
  test       Run the current project test suite.
  package    Package the current extension or native application for this host.
  watch      Rebuild and restage examples when source files change.
  doctor     Check Node.js, Sass and native GNOME prerequisites.
  ego-check  Validate a staged extension against basic EGO requirements.

Generated render modules receive the runtime and native renderer from the extension.`;

function reportCssDiagnostics(source: string, input: string, io: CliIO): number {
  const diagnostics = validateStCss(source);
  for (const item of diagnostics) {
    io.stderr(formatDiagnostic(source, input, {
      code: item.code,
      message: item.message,
      span: { start: item.start, end: item.end, line: item.line, column: item.column },
    }));
  }
  return diagnostics.length;
}

function formatDiagnostic(source: string, input: string, diagnostic: { code: string; message: string; span: { line: number; column: number; start: number; end: number } }): string {
  const lines = source.split(/\r\n|\r|\n/);
  const line = lines[diagnostic.span.line - 1] ?? '';
  const width = String(diagnostic.span.line).length;
  const markerLength = Math.max(1, Math.min(diagnostic.span.end - diagnostic.span.start, Math.max(1, line.length - diagnostic.span.column + 1)));
  return [
    `${input}:${diagnostic.span.line}:${diagnostic.span.column}: ${diagnostic.code}: ${diagnostic.message}`,
    `${String(diagnostic.span.line).padStart(width)} | ${line}`,
    `${' '.repeat(width)} | ${' '.repeat(Math.max(0, diagnostic.span.column - 1))}${'^'.repeat(markerLength)}`,
  ].join('\n');
}

export async function runCli(args: readonly string[] = process.argv.slice(2), io: CliIO = defaultIO): Promise<number> {
  const [command, inputArg, outputArg] = args;
  if (!command || command === '--help' || command === '-h') {
    io.stdout(usage);
    return 0;
  }

  if (command === 'ego-check') {
    if (!inputArg || inputArg.startsWith('-')) {
      io.stderr('Missing staged extension directory.');
      return 2;
    }
    const directory = resolve(inputArg);
    let metadata: Record<string, unknown>;
    let files: string[];
    try {
      metadata = JSON.parse(await io.readFile(resolve(directory, 'metadata.json'))) as Record<string, unknown>;
      files = await io.listFiles(directory);
    } catch (error) {
      io.stderr(`Unable to inspect staged extension: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    const errors: string[] = [];
    if (typeof metadata.uuid !== 'string' || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?))*$/.test(metadata.uuid)) errors.push('metadata.json: invalid or missing uuid.');
    if (!files.includes(resolve(directory, 'extension.js'))) errors.push('Package is missing the required extension.js entry point.');
    for (const field of ['name', 'description'] as const) {
      if (typeof metadata[field] !== 'string' || !metadata[field].trim()) errors.push(`metadata.json: missing required ${field}.`);
    }
    if (!Array.isArray(metadata['shell-version']) || metadata['shell-version'].length === 0 || metadata['shell-version'].some((version) => typeof version !== 'string' || !/^\d+(?:\.\d+)*$/.test(version))) {
      errors.push('metadata.json: shell-version must contain stable numeric GNOME Shell versions.');
    }
    if (Array.isArray(metadata['shell-version']) && new Set(metadata['shell-version']).size !== metadata['shell-version'].length) {
      errors.push('metadata.json: shell-version must not contain duplicate GNOME Shell versions.');
    }
    if (metadata.version !== undefined && (!Number.isInteger(metadata.version) || (metadata.version as number) < 1)) {
      errors.push('metadata.json: version must be a positive integer when provided.');
    }
    const schemaId = metadata['settings-schema'];
    if (schemaId !== undefined) {
      if (typeof schemaId !== 'string' || !/^[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:[.][A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(schemaId)) {
        errors.push('metadata.json: settings-schema must be a valid dotted GSettings schema ID.');
      } else {
        const schemaFiles = files.filter((file) => relative(directory, file).replaceAll('\\', '/').split('/').includes('schemas') && file.endsWith('.gschema.xml'));
        if (schemaFiles.length === 0 && !files.some((file) => relative(directory, file).replaceAll('\\', '/').endsWith('schemas/gschemas.compiled'))) {
          errors.push('metadata.json: settings-schema is set but no GSettings schema is packaged.');
        } else if (schemaFiles.length > 0) {
          let found = false;
          for (const file of schemaFiles) {
            try {
              const source = await io.readFile(file);
              const ids = [...source.matchAll(/<schema[^>]* id=["']([^"']+)["']/g)].map((match) => match[1]);
              if (ids.includes(schemaId)) found = true;
            } catch {
              errors.push(`Unable to read GSettings schema: ${file.slice(directory.length + 1)}`);
            }
          }
          if (!found) errors.push(`metadata.json: settings-schema "${schemaId}" does not match a packaged GSettings schema.`);
        }
      }
    }
    const javascriptSources = new Map<string, string>();
    const warnings: string[] = [];
    for (const file of files) {
      const relative = file.slice(directory.length + 1).replaceAll('\\', '/');
      if (/(^|\/)(node_modules|tests?|scripts|\.git)(\/|$)/.test(relative) || /\.(?:ts|map|md|lock)$/.test(relative) || /(^|\/)package\.json$/.test(relative)) {
        errors.push(`Package contains development-only file: ${relative}`);
      }
      if (file.endsWith('.js')) {
        let source: string;
        try { source = await io.readFile(file); } catch { errors.push(`Unable to read JavaScript file: ${relative}`); continue; }
        javascriptSources.set(file, source);
        if (/\bconsole\s*\.\s*debug\s*\(/.test(source)) {
          warnings.push(`${relative}: contains console.debug() logging; remove temporary debug output before submission.`);
        }
        if (relative === 'prefs.js' && /(?:gi:\/\/|from\s*['"])(?:St|Clutter|Meta|Shell)(?:['"/]|$)/.test(source)) {
          errors.push('prefs.js: preferences code must not import Shell-only libraries.');
        }
        if (relative === 'extension.js' && /(?:gi:\/\/|from\s*['"])(?:Gtk|Gdk|Adw)(?:['"/]|$)/.test(source)) {
          errors.push('extension.js: Shell code must not import GTK or libadwaita.');
        }
      }
    }
    const shellEntry = resolve(directory, 'extension.js');
    const shellSource = javascriptSources.get(shellEntry);
    if (shellSource !== undefined) {
      if (!/export\s+default\s+class\b/.test(shellSource)) {
        errors.push('extension.js: expected a default-exported extension class.');
      }
      for (const hook of ['enable', 'disable']) {
        if (!new RegExp('\\b' + hook + '\\s*\\(\\s*\\)\\s*\\{').test(shellSource)) {
          errors.push('extension.js: extension class must implement ' + hook + '().');
        }
      }
      const hasLifecycleSideEffects = /\b(?:connect|connectObject|timeout_add|idle_add)\s*\(|\bnew\s+(?:St|Clutter|Meta|Shell)\./;
      const constructorBody = shellSource.match(/\bconstructor\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n {2}(?:async\s+)?[A-Za-z_$][\w$]*\s*\()/)?.[1]
        ?? shellSource.match(/\bconstructor\s*\([^)]*\)\s*\{([\s\S]*?)\}/)?.[1]
        ?? '';
      if (hasLifecycleSideEffects.test(constructorBody)) {
        warnings.push('extension.js: constructor contains GNOME resource or signal side effects; move them into enable() and release them in disable().');
      }
      const classStart = shellSource.indexOf('export default class');
      const moduleSetup = classStart < 0 ? shellSource : shellSource.slice(0, classStart);
      if (hasLifecycleSideEffects.test(moduleSetup)) {
        warnings.push('extension.js: module-level code may create GNOME resources or connect signals before enable(); move setup into enable().');
      }
      const methodBody = (method: string): string => {
        const pattern = new RegExp('\\b' + method + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=\n {2}(?:async\\s+)?[A-Za-z_$][\\w$]*\\s*\\()/');
        return shellSource.match(pattern)?.[1]
          ?? shellSource.match(new RegExp('\\b' + method + '\\s*\\([^)]*\\)\\s*\\{([^}]*)\\}'))?.[1]
          ?? '';
      };
      const enableBody = methodBody('enable');
      const disableBody = methodBody('disable');
      if (hasLifecycleSideEffects.test(enableBody)
        && !/\b(?:destroy|disconnect|disconnectObject|clear|remove|source_remove|dispose|release)\s*\(/.test(disableBody)) {
        warnings.push('extension.js: enable() creates GNOME resources or connections but disable() has no obvious cleanup call.');
      }
    }
    const inspectImports = (entry: string, forbidden: RegExp, message: string): Set<string> => {
      const pending = [resolve(directory, entry)];
      const visited = new Set<string>();
      while (pending.length > 0) {
        const file = pending.pop()!;
        if (visited.has(file)) continue;
        visited.add(file);
        const source = javascriptSources.get(file);
        if (source === undefined) continue;
        for (const match of source.matchAll(/^\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
          const specifier = match[1]!;
          if (forbidden.test(specifier)) {
            const path = relative(directory, file).replaceAll('\\', '/');
            errors.push(`${path}: ${message}`);
          }
          if (specifier.startsWith('./') || specifier.startsWith('../')) {
            const dependency = resolve(dirname(file), specifier);
            if (files.includes(dependency) && dependency.endsWith('.js')) pending.push(dependency);
          }
        }
      }
      return new Set([...visited].map((file) => relative(directory, file).replaceAll('\\', '/')));
    };
    const reachableJavaScript = new Set(['extension.js', 'prefs.js']);
    for (const file of inspectImports('prefs.js', /^gi:\/\/(?:St|Clutter|Meta|Shell)(?:[/?]|$)/, 'preferences dependency imports a Shell-only library.')) reachableJavaScript.add(file);
    for (const file of inspectImports('extension.js', /^gi:\/\/(?:Gtk|Gdk|Adw)(?:[/?]|$)/, 'Shell dependency imports GTK or libadwaita.')) reachableJavaScript.add(file);
    for (const file of javascriptSources.keys()) {
      const path = relative(directory, file).replaceAll('\\', '/');
      if (!reachableJavaScript.has(path)) {
        errors.push(`JavaScript file is not imported by either extension entry point: ${path}`);
      }
    }
    for (const file of files.filter((path) => path.endsWith('.css'))) {
      let stylesheet: string;
      try { stylesheet = await io.readFile(file); } catch { continue; }
      for (const match of stylesheet.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
        const asset = match[2]!.trim();
        if (/^(?:data:|https?:|#|\/)/i.test(asset)) continue;
        const assetPath = resolve(dirname(file), asset.split(/[?#]/, 1)[0]!);
        if (!files.includes(assetPath)) {
          errors.push(relative(directory, file).replaceAll('\\', '/') + ': stylesheet references missing asset "' + asset + '".');
        }
      }
    }
    const resourceFiles = files.filter((file) => /\.(?:css|svg|png|jpe?g|webp|gif|woff2?|ttf|otf|gschema\.xml|gresource\.xml)$/i.test(file)
      || relative(directory, file).replaceAll('\\', '/').endsWith('schemas/gschemas.compiled'));
    const resourceSources = [...javascriptSources.values()];
    for (const file of files.filter((path) => path.endsWith('.css'))) {
      try { resourceSources.push(await io.readFile(file)); } catch { /* A failed optional asset read is reported as a possible unused resource. */ }
    }
    for (const file of resourceFiles) {
      const path = relative(directory, file).replaceAll('\\', '/');
      if (path === 'stylesheet.css') continue;
      let used = false;
      if (file.endsWith('.gschema.xml')) {
        const schema = await io.readFile(file).catch(() => '');
        const id = schema.match(/<schema\b[^>]*\bid=["']([^"']+)["']/)?.[1];
        used = Boolean(id && (metadata['settings-schema'] === id || [...javascriptSources.values()].some((source) => source.includes(id))));
      } else if (relative(directory, file).replaceAll('\\', '/').endsWith('schemas/gschemas.compiled')) {
        used = typeof schemaId === 'string';
      } else {
        const name = basename(file);
        used = resourceSources.some((source) => source.includes(path) || source.includes(name));
      }
      if (!used) warnings.push(`Possibly unused package resource: ${path}`);
    }
    if (errors.length) {
      errors.forEach((error) => io.stderr(error));
      warnings.forEach((warning) => io.stderr(warning));
      io.stderr(`EGO validation failed: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
      return 1;
    }
    warnings.forEach((warning) => io.stderr(warning));
    io.stdout(`EGO validation passed: ${files.length} file${files.length === 1 ? '' : 's'}, ${javascriptSources.size} JavaScript file${javascriptSources.size === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
    return 0;
  }

  if (command === 'doctor') {
    const checks = [
      { name: 'Node.js >= 22', ok: Number(process.versions.node.split('.')[0]) >= 22, detail: process.versions.node },
      ...([
        { name: 'Sass', command: 'npx', args: ['sass', '--version'] },
        { name: 'GJS', command: 'gjs', args: ['--version'] },
        { name: 'GNOME Shell 51', command: 'gnome-shell', args: ['--version'], matches: /GNOME Shell 51\./ },
        { name: 'GTK4', command: 'pkg-config', args: ['--modversion', 'gtk4'] },
        { name: 'libadwaita', command: 'pkg-config', args: ['--modversion', 'libadwaita-1'] },
        { name: 'GSettings schema compiler', command: 'glib-compile-schemas', args: ['--version'] },
        { name: 'ZIP archiver', command: 'zip', args: ['-v'] },
        { name: 'ZIP verifier', command: 'unzip', args: ['-v'] },
      ] as const).map((check) => {
        const result = io.run(check.command, check.args);
        const detail = result.output.trim() || (result.status === 0 ? 'available' : 'not installed');
        const ok = result.status === 0 && (!('matches' in check) || check.matches.test(detail));
        return { name: check.name, ok, detail };
      }),
    ];
    io.stdout(checks.map((check) => `${check.ok ? 'OK' : 'MISSING'}  ${check.name}: ${check.detail}`).join('\n'));
    return checks.every((check) => check.ok) ? 0 : 1;
  }

  if (command === 'build' || command === 'test' || command === 'package' || command === 'watch') {
    try {
      const config = JSON.parse(await io.readFile(resolve('gef.json'))) as {
        defaultProject?: string;
        projects?: Record<string, { projectType?: string }>;
      };
      const names = Object.keys(config.projects ?? {});
      const selected = config.defaultProject ?? (names.length === 1 ? names[0] : undefined);
      const project = selected ? config.projects?.[selected] : undefined;
      if (!project) throw new Error('gef.json must define a defaultProject or exactly one project.');
      if (project.projectType !== 'application' && project.projectType !== 'extension') {
        throw new Error('gef.json projectType must be "application" or "extension".');
      }
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
      io.stderr('Project name must use lowercase letters, digits and hyphens.');
      return 2;
    }
    const typeIndex = args.indexOf('--type');
    const projectType = typeIndex >= 0 ? args[typeIndex + 1] : 'extension';
    if (projectType !== 'application' && projectType !== 'extension') {
      io.stderr('Project type must be "application" or "extension".');
      return 2;
    }
    const positional = args.slice(2).filter((_value, index) =>
      typeIndex < 0 || (index + 2 !== typeIndex && index + 2 !== typeIndex + 1));
    const directory = resolve(positional[0] ?? name);
    const applicationId = `com.example.${name.replaceAll('-', '.')}`;
    const applicationTitle = name.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('');
    const projectConfig = JSON.stringify({
      version: 1,
      defaultProject: name,
      projects: {
        [name]: {
          projectType,
          root: '.',
          sourceRoot: projectType === 'application' ? 'src' : '.',
          entryPoint: projectType === 'application' ? 'src/main.ts' : 'extension.ts',
          outputPath: 'dist',
        },
      },
    }, null, 2) + '\n';
    const files: Readonly<Record<string, string>> = projectType === 'extension' ? {
      'gef.json': projectConfig,
      'metadata.json': JSON.stringify({ uuid: `${name}@example.com`, name, description: `A GEF extension: ${name}`, 'shell-version': ['51'], version: 1 }, null, 2) + '\n',
      'extension.ts': `// Generated with AI for personal use.\n// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript\n// and can maintain this code.\nimport St from 'gi://St';\nimport Main from 'resource:///org/gnome/shell/ui/main.js';\nimport { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';\n\nexport default class ${name.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('')}Extension extends Extension {\n  private indicator: InstanceType<typeof St.Button> | undefined;\n\n  override enable(): void {\n    const indicator = new St.Button({ style_class: 'panel-button', reactive: true, can_focus: true, track_hover: true });\n    indicator.set_child(new St.Label({ text: '${name}' }));\n    Main.panel.addToStatusArea('${name}', indicator);\n    this.indicator = indicator;\n  }\n\n  override disable(): void {\n    this.indicator?.destroy();\n    this.indicator = undefined;\n  }\n}\n`,
      'gjs.d.ts': `declare module 'gi://St' {\n  export class Button { constructor(properties?: Record<string, unknown>); set_child(child: Label): void; destroy(): void; }\n  export class Label { constructor(properties?: Record<string, unknown>); }\n  const St: { Button: typeof Button; Label: typeof Label };\n  export default St;\n}\ndeclare module 'resource:///org/gnome/shell/ui/main.js' { const Main: { panel: { addToStatusArea(name: string, actor: unknown): void } }; export default Main; }\ndeclare module 'resource:///org/gnome/shell/extensions/extension.js' { export class Extension { enable(): void; disable(): void; } }\n`,
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', experimentalDecorators: true, useDefineForClassFields: false, strict: true, skipLibCheck: true, rootDir: '.', outDir: 'dist', types: [] }, include: ['**/*.ts', '**/*.d.ts'], exclude: ['node_modules', 'dist'] }, null, 2) + '\n',
      'package.json': JSON.stringify({ name, version: '1.0.0', private: true, type: 'module', scripts: { build: 'tsc -p tsconfig.json', package: 'npm run build && node scripts/package.mjs' }, dependencies: { 'gnome-extension-framework': '^0.1.0-alpha.2' }, devDependencies: { typescript: '^5.9.3' } }, null, 2) + '\n',
      'README.md': `# ${name}\n\nA GNOME Shell 51 extension generated by GEF.\n\nInstall dependencies with \`npm install\`, build with \`gef build\`, and package with \`gef package\`.\n`,
      'scripts/package.mjs': `if (process.platform !== 'linux') throw new Error('GNOME Shell extension packages must be built on Linux.');\nimport { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';\nimport { spawnSync } from 'node:child_process';\nimport { dirname, relative, resolve } from 'node:path';\n\nconst root = process.cwd();\nconst output = resolve(root, 'dist');\nconst framework = resolve(root, 'node_modules/gnome-extension-framework/dist');\nawait mkdir(resolve(output, 'runtime'), { recursive: true });\nawait cp(resolve(framework, 'runtime/src'), resolve(output, 'runtime/src'), { recursive: true });\nawait cp(resolve(framework, 'shared/src'), resolve(output, 'shared/src'), { recursive: true });\nawait cp(resolve(root, 'metadata.json'), resolve(output, 'metadata.json'));\n\nasync function visit(directory) {\n  const entries = await readdir(directory, { withFileTypes: true });\n  for (const entry of entries) {\n    const path = resolve(directory, entry.name);\n    if (entry.isDirectory()) await visit(path);\n    else if (path.endsWith('.js')) {\n      const specifier = relative(dirname(path), resolve(output, 'runtime/src/index.js')).split('\\\\').join('/');\n      const importPath = specifier.startsWith('.') ? specifier : './' + specifier;\n      const source = await readFile(path, 'utf8');\n      await writeFile(path, source.replaceAll('gnome-extension-framework/runtime', importPath), 'utf8');\n    }\n  }\n}\nawait visit(output);\nconst result = spawnSync('gnome-extensions', ['pack', output], { cwd: root, stdio: 'inherit' });\nif (result.status !== 0) process.exitCode = 1;\n`,
    } : {
      'gef.json': projectConfig,
      'package.json': JSON.stringify({
        name, version: '1.0.0', private: true, type: 'module', main: 'dist/main.js',
        bundle: { name: applicationTitle, id: applicationId, entry: 'dist/main.js', gtk: 4 },
        scripts: {
          build: 'gef compile src/app/app.component.gtpl src/app/app.component.view.js && tsc -p tsconfig.json',
          start: 'node --import node-gtk/register dist/main.js',
          test: 'node --test',
          package: 'npm run build && node scripts/package.mjs',
        },
        dependencies: { 'gnome-extension-framework': '^0.1.0-alpha.2', 'node-gtk': '^4.1.1' },
        devDependencies: { typescript: '^5.9.3' },
      }, null, 2) + '\n',
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, allowJs: true, sourceMap: true, rootDir: 'src', outDir: 'dist', types: [] }, include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.js'], exclude: ['node_modules', 'dist'] }, null, 2) + '\n',
      'src/main.ts': `import Gtk from 'gi:Gtk-4.0';\nimport Adw from 'gi:Adw-1';\nimport { Injector, createGtkRenderHost, getComponentMetadata, mountComponent } from 'gnome-extension-framework/runtime';\nimport AppComponent from './app/app.component.js';\nimport renderApp from './app/app.component.view.js';\nimport { appConfig } from './app/app.config.js';\n\nconst app = new Adw.Application(appConfig.applicationId, 0);\n\napp.on('activate', () => {\n  const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });\n  const metadata = getComponentMetadata(AppComponent);\n  if (!metadata) throw new Error('The root component is missing @Component metadata.');\n  const view = mountComponent({\n    inputs: metadata.inputBindings,\n    outputs: metadata.outputBindings,\n    hostBindings: metadata.hostBindings,\n    create: () => new AppComponent(),\n    render: renderApp,\n  }, new Injector(), host);\n  const window = new Adw.ApplicationWindow(app);\n  window.setTitle('${name}');\n  window.setDefaultSize(appConfig.window.width, appConfig.window.height);\n  window.setContent(view.view.node);\n  window.on('close-request', () => {\n    window.setContent(null);\n    view.destroy();\n    return false;\n  });\n  window.present();\n});\n\napp.run([]);\n`,
      'src/app/app.component.ts': `import { Component } from 'gnome-extension-framework/runtime';\n\n@Component({ selector: 'app-root', templateUrl: './app.component.gtpl' })\nexport default class AppComponent {\n  readonly title = '${applicationTitle}';\n}\n`,
      'src/app/app.component.gtpl': '<GtkLabel label="Hello from GEF and node-gtk!" />\\n',\n      'src/app/app.config.ts': `export const appConfig = Object.freeze({\n  applicationId: '${applicationId}',\n  window: Object.freeze({ width: 640, height: 480 }),\n});\n`,\n      'src/app/app.component.css': '/* Root component styles. */\\n',
      'src/node-gtk.d.ts': `declare module 'gi:Gtk-4.0' { const Gtk: any; export default Gtk; }\ndeclare module 'gi:Adw-1' { const Adw: any; export default Adw; }\n`,
      'scripts/package.mjs': "import 'gnome-extension-framework/scripts/package-app.mjs';\n",
      'README.md': `# ${name}\n\nA native GTK4/libadwaita application for Node.js, generated by GEF and powered by node-gtk 4.\n\nInstall Node.js 22 or newer and the GTK4/libadwaita development libraries for your platform. Then run npm install, gef build, npm start, and gef package on the native target OS. Linux creates an AppImage, Windows creates a self-contained ZIP, and macOS creates an .app and .dmg. Build each package on its native OS.\n\nThe packages include the Node.js runtime and GTK dependencies. macOS packages are unsigned; public distribution still requires Developer ID signing and notarization. The app uses node-gtk gi: ESM imports and must run with node --import node-gtk/register. The application ID is ${applicationId}.\n`,
    };
    try {
      await io.mkdir(directory);
      await io.mkdir(resolve(directory, 'scripts'));
      if (projectType === 'application') {
        for (const folder of ['src', 'src/app', 'src/components', 'src/directives', 'src/pipes', 'src/services', 'src/models', 'src/assets', 'src/styles']) {\n          await io.mkdir(resolve(directory, folder));\n        }\n      }
      for (const [path, source] of Object.entries(files)) await io.writeFile(resolve(directory, path), source);
    } catch (error) {
      io.stderr(`Unable to generate project: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    io.stdout(`Created ${projectType} project: ${directory}`);
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
      await io.writeFile(resolve(directory, `${name}.ts`), `import { Component, Input } from 'gnome-extension-framework/runtime';\n\n@Component({ selector: '${name}', templateUrl: './${name}.gtpl' })\nexport class ${name} {\n  @Input() title = '${name}';\n}\n`);
      await io.writeFile(resolve(directory, `${name}.gtpl`), `<StBox>\n  <StLabel>{{ title }}</StLabel>\n</StBox>\n`);
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
    io.stderr(formatDiagnostic(source, input, diagnostic));
  }
  if (result.diagnostics.length > 0) return 1;
  if (command === 'check') {
    io.stdout(`GTPL validation passed: ${input}`);
    return 0;
  }

  const output = resolve(outputArg ?? (input + '.js'));
  const mapPath = output + '.map';
  const generated = emitGtplTemplateWithSourceMap(result.nodes, {
    source: relative(dirname(output), input).replaceAll('\\', '/'),
    sourceContent: source,
    file: basename(output),
  });
  const sourceMap = { ...generated.map, mappings: ';;' + generated.map.mappings };
  const moduleSource = '// Generated by GEF. Do not edit.\nexport default\n'
    + generated.code + ';\n//# sourceMappingURL=' + basename(mapPath) + '\n';
  try {
    await io.mkdir(dirname(output));
    await io.writeFile(output, moduleSource);
    await io.writeFile(mapPath, JSON.stringify(sourceMap) + '\n');
  } catch (error) {
    io.stderr('Unable to write compiled output: ' + (error instanceof Error ? error.message : String(error)));
    return 2;
  }
  io.stdout('Generated: ' + output);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().then((code) => { process.exitCode = code; });
}
