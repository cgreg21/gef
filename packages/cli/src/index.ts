#!/usr/bin/env node
import { access, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { executeGenerationPlan } from './generation/plan.js';
import { checkGtpl, emitGtplTemplateWithSourceMap } from '../../compiler/src/index.js';
import { formatDiagnostic, validateWorkspaceConfig } from './validation.js';
import { runDoctor } from './commands/doctor.js';

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

  if (command === 'doctor') return runDoctor(io);

  if (command === 'build' || command === 'test' || command === 'package' || command === 'watch') {
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

  if (command === 'styles') return runStyles(inputArg, outputArg, io);

  if (command === 'new') {
    const name = inputArg;
    if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
      io.stderr('Project name must use lowercase letters, digits and hyphens.');
      return 2;
    }
    let projectType: 'application' | 'extension' = 'extension';
    let directoryArg: string | undefined;
    let typeProvided = false;
    let dryRun = false;
    let force = false;
    for (let index = 2; index < args.length; index++) {
      const argument = args[index]!;
      if (argument === '--type') {
        const value = args[index + 1];
        if (typeProvided || value === undefined || (value !== 'application' && value !== 'extension')) {
          io.stderr('Usage: gef new <project-name> [directory] [--type application|extension] [--dry-run] [--force]');
          return 2;
        }
        projectType = value;
        typeProvided = true;
        index++;
      } else if (argument === '--dry-run') {
        if (dryRun) { io.stderr('Duplicate option: --dry-run'); return 2; }
        dryRun = true;
      } else if (argument === '--force') {
        if (force) { io.stderr('Duplicate option: --force'); return 2; }
        force = true;
      } else if (argument.startsWith('-') || directoryArg !== undefined) {
        io.stderr(`Unexpected argument: ${argument}`);
        return 2;
      } else {
        directoryArg = argument;
      }
    }
    const directory = resolve(directoryArg ?? name);
    const applicationId = `com.example.${name.replaceAll('-', '.')}`;
    const applicationTitle = name.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('');
    const extensionClassName = applicationTitle;
    const projectConfig = JSON.stringify({
      version: 1,
      defaultProject: name,
      projects: {
        [name]: {
          projectType,
          root: '.',
          sourceRoot: 'src',
          entryPoint: projectType === 'application' ? 'src/main.ts' : 'src/extension.ts',
          outputPath: 'dist',
        },
      },
    }, null, 2) + '\n';
    const files: Readonly<Record<string, string>> = projectType === 'extension' ? {
      'gef.json': projectConfig,
      'metadata.json': JSON.stringify({ uuid: `${name}@example.com`, name, description: `A GEF extension: ${name}`, 'shell-version': ['51'], version: 1 }, null, 2) + '\n',
      'src/extension.ts': [
        '// Do NOT upload to extensions.gnome.org unless you understand and can maintain this code.',
        "import St from 'gi://St';",
        "import Clutter from 'gi://Clutter';",
        "import Main from 'resource:///org/gnome/shell/ui/main.js';",
        "import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';",
        "import { Injector, ResourceScope, createApplicationRouter, createGtplRenderRuntime, renderRouterOutlet, createStRenderHost, mountDecoratedComponent, type StNamespace, type StClutterNamespace, type StActor, type ApplicationRouterConfig } from 'gnome-extension-framework/runtime';",
        "import AppComponent from './app/app.component.js';",
        "import renderApp from './app/app.component.view.js';",
        "import { appConfig } from './app/app.config.js';",
        '',
        'export default class ' + extensionClassName + 'Extension extends Extension {',
        '  private resources: ResourceScope | undefined;',
        '  override enable(): void {',
        '    if (this.resources) return;',
        '    const resources = new ResourceScope();',
        '    this.resources = resources;',
        '    try {',
        '      const injector = new Injector();',
        '      resources.add(() => injector.destroy());',
        '      const host = createStRenderHost(St as StNamespace, { clutter: Clutter as StClutterNamespace });',
        '      const component = mountDecoratedComponent(AppComponent, renderApp, injector, host);',
        '      resources.add(() => component.destroy());',
        '      const router = createApplicationRouter(appConfig.router, () => component.view.node);',
        '      const outlet = renderRouterOutlet(router, createGtplRenderRuntime(host));',
        '      resources.add(() => host.destroy(outlet));',
        "      Main.panel.addToStatusArea('" + name + "', outlet);",
        '    } catch (error) {',
        '      resources.dispose();',
        '      this.resources = undefined;',
        '      throw error;',
        '    }',
        '  }',
        '  override disable(): void {',
        '    const resources = this.resources;',
        '    this.resources = undefined;',
        '    resources?.dispose();',
        '  }',
        '}',
      ].join('\n') + '\n',
      'src/gjs.d.ts': `declare module 'gi://St' { const St: any; export default St; }\ndeclare module 'gi://Clutter' { const Clutter: any; export default Clutter; }\ndeclare module 'resource:///org/gnome/shell/ui/main.js' { const Main: any; export default Main; }\ndeclare module 'resource:///org/gnome/shell/extensions/extension.js' { export class Extension { enable(): void; disable(): void; } }\n`,
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', experimentalDecorators: true, useDefineForClassFields: false, strict: true, skipLibCheck: true, allowJs: true, rootDir: 'src', outDir: 'dist', types: [] }, include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.js'], exclude: ['node_modules', 'dist'] }, null, 2) + '\n',
      'package.json': JSON.stringify({ name, version: '1.0.0', private: true, type: 'module', scripts: { build: 'gef compile src/app/app.component.gtpl src/app/app.component.view.js && tsc -p tsconfig.json', package: 'npm run build && node scripts/package.mjs' }, dependencies: { 'gnome-extension-framework': '^0.1.0-alpha.2' }, devDependencies: { typescript: '^5.9.3' } }, null, 2) + '\n',
      'src/app/app.component.ts': `import { Component } from 'gnome-extension-framework/runtime';\n\n@Component({ selector: 'app-root', templateUrl: './app.component.gtpl' })\nexport default class AppComponent {\n  readonly title = '${name}';\n}\n`,
      'src/app/app.component.gtpl': '<StButton class="panel-button" reactive="true" can_focus="true" track_hover="true"><StLabel>{{ title }}</StLabel></StButton>\n',
      'src/app/app.config.ts': "import type { ApplicationRouterConfig, StActor } from 'gnome-extension-framework/runtime';\n\nexport const appConfig = Object.freeze({\n  shellVersion: '51',\n  router: { initialUrl: '/', routes: [{ path: '/' }] } satisfies ApplicationRouterConfig<StActor>,\n});\n",
      'README.md': `# ${name}\n\nA GNOME Shell 51 extension generated by GEF.\n\nThe router is configured in \`src/app/app.config.ts\`; its outlet is mounted into the panel status area and released with the extension lifecycle.\n\nInstall dependencies with \`npm install\`, build with \`gef build\`, then package on Linux with \`gef package\`. The decorated root component and GTPL template live in \`src/app/\`; \`src/extension.ts\` adapts them to the GNOME Shell lifecycle. Review and test the generated code on your target Shell version before distributing it.\n`,
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
      'src/main.ts': `import Gtk from 'gi:Gtk-4.0';\nimport Adw from 'gi:Adw-1';\nimport { Injector, createApplicationRouter, createGtplRenderRuntime, createGtkRenderHost, mountDecoratedComponent, renderRouterOutlet } from 'gnome-extension-framework/runtime';\nimport AppComponent from './app/app.component.js';\nimport renderApp from './app/app.component.view.js';\nimport { appConfig } from './app/app.config.js';\n\nconst app = new Adw.Application(appConfig.applicationId, 0);\n\napp.on('activate', () => {\n  const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });\n  const injector = new Injector();\n  const component = mountDecoratedComponent(AppComponent, renderApp, injector, host);\n  const router = createApplicationRouter(appConfig.router, () => component.view.node);\n  const outlet = renderRouterOutlet(router, createGtplRenderRuntime(host));\n  const window = new Adw.ApplicationWindow(app);\n  window.setTitle('${name}');\n  window.setDefaultSize(appConfig.window.width, appConfig.window.height);\n  window.setContent(outlet);\n  window.on('close-request', () => {\n    window.setContent(null);\n    host.destroy(outlet);\n    component.destroy();\n    injector.destroy();\n    return false;\n  });\n  window.present();\n});\n\napp.run([]);\n`,
      'src/app/app.component.ts': `import { Component } from 'gnome-extension-framework/runtime';\n\n@Component({ selector: 'app-root', templateUrl: './app.component.gtpl' })\nexport default class AppComponent {\n  readonly title = '${applicationTitle}';\n}\n`,
      'src/app/app.component.gtpl': '<GtkLabel label="Hello from GEF and node-gtk!" />\n',
      'src/app/app.config.ts': `import type { ApplicationRouterConfig, GtkActor } from 'gnome-extension-framework/runtime';\n\nexport const appConfig = Object.freeze({\n  applicationId: '${applicationId}',\n  window: Object.freeze({ width: 640, height: 480 }),\n  router: { initialUrl: '/', routes: [{ path: '/' }] } satisfies ApplicationRouterConfig<GtkActor>,\n});\n`,
      'src/app/app.component.css': '/* Root component styles. */\n',
      'src/node-gtk.d.ts': `declare module 'gi:Gtk-4.0' { const Gtk: any; export default Gtk; }\ndeclare module 'gi:Adw-1' { const Adw: any; export default Adw; }\n`,
      'scripts/package.mjs': "import 'gnome-extension-framework/scripts/package-app.mjs';\n",
      'README.md': `# ${name}\n\nA native GTK4/libadwaita application for Node.js, generated by GEF and powered by node-gtk 4.\n\nInstall Node.js 22 or newer and the GTK4/libadwaita development libraries for your platform. Then run npm install, gef build, npm start, and gef package on the native target OS. Linux creates an AppImage, Windows creates a self-contained ZIP, and macOS creates an .app and .dmg. Build each package on its native OS.\n\nThe packages include the Node.js runtime and GTK dependencies. macOS packages are unsigned; public distribution still requires Developer ID signing and notarization. The app uses node-gtk gi: ESM imports and must run with node --import node-gtk/register. The application ID is ${applicationId}.\n`,
    };
    try {
      await executeGenerationPlan(io, directory, files, {
        title: `Generation plan for ${projectType} project ${directory}`,
        target: 'project files',
        dryRun,
        force,
        directories: ['scripts', 'src', 'src/app', 'src/components', 'src/directives', 'src/pipes', 'src/services', 'src/models', 'src/assets', 'src/styles'],
      });
    } catch (error) {
      io.stderr(`Unable to generate project: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    io.stdout(`Created ${projectType} project: ${directory}`);
    return 0;
  }

  if (command === 'generate') {
    const type = inputArg;
    const name = outputArg;
    const suffix = type === 'directive' ? 'Directive' : type === 'service' ? 'Service' : type === 'pipe' ? 'Pipe' : '';
    const supported = type === 'component' || Boolean(suffix);
    const baseName = suffix && name?.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
    if (!supported || !name || !baseName || !/^[A-Z][A-Za-z0-9]*$/.test(baseName)) {
      io.stderr('Usage: gef generate <component|directive|service|pipe> <PascalCaseName> [directory]');
      return 2;
    }
    const className = type === 'component' ? name : baseName + suffix;
    const fileName = baseName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    let directoryArg: string | undefined;
    let dryRun = false;
    let force = false;
    for (const argument of args.slice(3)) {
      if (argument === '--dry-run') {
        if (dryRun) { io.stderr('Duplicate option: --dry-run'); return 2; }
        dryRun = true;
      } else if (argument === '--force') {
        if (force) { io.stderr('Duplicate option: --force'); return 2; }
        force = true;
      } else if (argument.startsWith('-') || directoryArg !== undefined) {
        io.stderr(`Unexpected argument: ${argument}`);
        return 2;
      } else {
        directoryArg = argument;
      }
    }
    const directory = resolve(directoryArg ?? '.');
    const files: Readonly<Record<string, string>> = type === 'component' ? {
      [`${fileName}.ts`]: `import { Component, Input } from 'gnome-extension-framework/runtime';

@Component({ selector: '${fileName}', templateUrl: './${fileName}.gtpl' })
export class ${className} {
  @Input() title = '${className}';
}
`,
      [`${fileName}.gtpl`]: `<StBox>
  <StLabel>{{ title }}</StLabel>
</StBox>
`,
    } : type === 'directive' ? {
      [`${fileName}.directive.ts`]: `import { Directive } from 'gnome-extension-framework/runtime';

@Directive({ selector: '[app${baseName}]' })
export class ${className} {}
`,
    } : type === 'service' ? {
      [`${fileName}.service.ts`]: `export class ${className} {}
`,
    } : {
      [`${fileName}.pipe.ts`]: `import { Pipe } from 'gnome-extension-framework/runtime';

@Pipe({ name: '${baseName[0]!.toLowerCase() + baseName.slice(1)}' })
export class ${className} {
  transform(value: unknown): string {
    return String(value);
  }
}
`,
    };
    try {
      await executeGenerationPlan(io, directory, files, {
        title: `Generation plan for ${type} ${className}`,
        target: 'generated files',
        dryRun,
        force,
      });
    } catch (error) {
      io.stderr(`Unable to generate ${type}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    io.stdout(`Generated ${type} ${className} in ${directory}`);
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
