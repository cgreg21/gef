import { resolve } from 'node:path';
import { executeGenerationPlan } from '../generation/plan.js';
import type { CliIO } from '../index.js';

export async function runNew(
  inputArg: string | undefined,
  args: readonly string[],
  io: Pick<CliIO, 'mkdir' | 'writeFile' | 'fileExists' | 'stdout' | 'stderr'>,
): Promise<number> {
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
        "import * as Main from 'resource:///org/gnome/shell/ui/main.js';",
        "import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';",
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
        "      const panelButton = new PanelMenu.Button(0, '" + name + "');",
        '      panelButton.add_child(outlet);',
        '      resources.add(() => panelButton.destroy());',
        '      resources.add(() => host.destroy(outlet));',
        "      Main.panel.addToStatusArea('" + name + "', panelButton);",
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
      'src/gjs.d.ts': `declare module 'gi://St' { const St: any; export default St; }\ndeclare module 'gi://Clutter' { const Clutter: any; export default Clutter; }\ndeclare module 'resource:///org/gnome/shell/ui/main.js' { export const panel: any; }\ndeclare module 'resource:///org/gnome/shell/ui/panelMenu.js' { export class Button { constructor(alignment: number, name: string); add_child(child: any): void; destroy(): void; } }\ndeclare module 'resource:///org/gnome/shell/extensions/extension.js' { export class Extension { enable(): void; disable(): void; } }\n`,
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', experimentalDecorators: true, useDefineForClassFields: false, strict: true, skipLibCheck: true, allowJs: true, rootDir: 'src', outDir: 'dist', types: [] }, include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.js'], exclude: ['node_modules', 'dist'] }, null, 2) + '\n',
      'package.json': JSON.stringify({ name, version: '1.0.0', private: true, type: 'module', scripts: { build: 'gef compile src/app/app.component.gtpl src/app/app.component.view.js && gef compile-ts --project tsconfig.json', package: 'npm run build && node scripts/package.mjs' }, dependencies: { 'gnome-extension-framework': '^0.1.0-alpha.2' }, devDependencies: { typescript: '^5.9.3' } }, null, 2) + '\n',
      'src/app/app.component.ts': `import { Component } from 'gnome-extension-framework/runtime';\n\n@Component({ selector: 'app-root', templateUrl: './app.component.gtpl' })\nexport default class AppComponent {\n  readonly title = '${name}';\n}\n`,
      'src/app/app.component.gtpl': '<StButton class="panel-button" reactive="true" can_focus="true" track_hover="true"><StLabel>{{ title }}</StLabel></StButton>\n',
      'src/app/app.config.ts': "import type { ApplicationRouterConfig, StActor } from 'gnome-extension-framework/runtime';\n\nexport const appConfig = Object.freeze({\n  shellVersion: '51',\n  router: { initialUrl: '/', routes: [{ path: '/' }] } satisfies ApplicationRouterConfig<StActor>,\n});\n",
      'README.md': `# ${name}\n\nA GNOME Shell 51 extension generated by GEF.\n\nThe router is configured in \`src/app/app.config.ts\`; its outlet is mounted into the panel status area and released with the extension lifecycle.\n\nInstall dependencies with \`npm install\`, build with \`gef build\`, then package on Linux with \`gef package\`. The decorated root component and GTPL template live in \`src/app/\`; \`src/extension.ts\` adapts them to the GNOME Shell lifecycle. Review and test the generated code on your target Shell version before distributing it.\n`,
      'scripts/package.mjs': `if (process.platform !== 'linux') throw new Error('GNOME Shell extension packages must be built on Linux.');\nimport { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';\nimport { spawnSync } from 'node:child_process';\nimport { dirname, relative, resolve } from 'node:path';\n\nconst root = process.cwd();\nconst output = resolve(root, 'dist');\nconst framework = resolve(root, 'node_modules/gnome-extension-framework/dist');\nawait mkdir(resolve(output, 'runtime'), { recursive: true });\nawait cp(resolve(framework, 'runtime/src'), resolve(output, 'runtime/src'), { recursive: true });\nawait cp(resolve(framework, 'shared/src'), resolve(output, 'shared/src'), { recursive: true });\nawait cp(resolve(root, 'metadata.json'), resolve(output, 'metadata.json'));\n\nasync function visit(directory) {\n  const entries = await readdir(directory, { withFileTypes: true });\n  for (const entry of entries) {\n    const path = resolve(directory, entry.name);\n    if (entry.isDirectory()) await visit(path);\n    else if (path.endsWith('.js')) {\n      const specifier = relative(dirname(path), resolve(output, 'runtime/src/index.js')).split('\\\\').join('/');\n      const importPath = specifier.startsWith('.') ? specifier : './' + specifier;\n      const source = await readFile(path, 'utf8');\n      await writeFile(path, source.replaceAll('gnome-extension-framework/runtime', importPath), 'utf8');\n    }\n  }\n}\nawait visit(output);\nconst result = spawnSync('gnome-extensions', ['pack', '--force', '--out-dir', root, '--extra-source', 'app', '--extra-source', 'runtime', '--extra-source', 'shared', output], { cwd: root, stdio: 'inherit' });\nif (result.status !== 0) process.exitCode = 1;\n`,
    } : {
      'gef.json': projectConfig,
      'package.json': JSON.stringify({
        name, version: '1.0.0', private: true, type: 'module', main: 'dist/main.js',
        bundle: { name: applicationTitle, id: applicationId, entry: 'dist/main.js', gtk: 4 },
        scripts: {
          build: 'gef compile src/app/app.component.gtpl src/app/app.component.view.js && gef compile-ts --project tsconfig.json',
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
