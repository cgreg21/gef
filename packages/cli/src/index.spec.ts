import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { runCli, type CliIO } from './index.js';

function createIO(source: string, commandStatus = 0) {
  const output: string[] = [];
  const errors: string[] = [];
  const writes: Array<{ path: string; content: string }> = [];
  const directories: string[] = [];
  const commands: Array<{ command: string; args: readonly string[] }> = [];
  const io: CliIO = {
    readFile: async () => source,
    writeFile: async (path, content) => { writes.push({ path, content }); },
    mkdir: async (path) => { directories.push(path); },
    listFiles: async () => [],
    run: (command, args) => { commands.push({ command, args }); return { status: commandStatus, output: '' }; },
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
  return { io, output, errors, writes, commands, directories };
}

describe('GEF CLI', () => {
  it('prints help without reading a file', async () => {
    const { io, output } = createIO('');
    expect(await runCli(['--help'], io)).toBe(0);
    expect(output[0]).toContain('gef check');
  });

  it('prints doctor and ego-check as separate help commands', async () => {
    const { io, output } = createIO('');
    expect(await runCli(['--help'], io)).toBe(0);
    expect(output[0]).toMatch(/^\s+doctor\s+Check local Node\.js and Sass prerequisites\.\n\s+ego-check\s+Validate a staged extension against basic EGO requirements\./m);
  });

  it('validates a GTPL file', async () => {
    const { io, output, errors } = createIO('<StLabel>Hello</StLabel>');
    expect(await runCli(['check', 'view.gtpl'], io)).toBe(0);
    expect(output[0]).toContain('validation passed');
    expect(errors).toHaveLength(0);
  });

  it('reports compiler diagnostics and does not emit invalid templates', async () => {
    const { io, errors, writes } = createIO('<StLabel *for="let item in items" />');
    expect(await runCli(['compile', 'view.gtpl'], io)).toBe(1);
    expect(errors.join('\n')).toContain('GTPL4203');
    expect(writes).toHaveLength(0);
  });

  it('prints source context and a caret for diagnostics', async () => {
    const source = '<StLabel *for="let item in items" />';
    const { io, errors } = createIO(source);
    expect(await runCli(['check', 'view.gtpl'], io)).toBe(1);
    expect(errors.join('\n')).toContain('view.gtpl:1:');
    expect(errors.join('\n')).toContain('| <StLabel');
    expect(errors.join('\n')).toContain('^');
  });

  it('prints the correct source line for standalone CR line endings', async () => {
    const source = '<StLabel />\r<StLabel *for="let item in items" />';
    const { io, errors } = createIO(source);
    expect(await runCli(['check', 'view.gtpl'], io)).toBe(1);
    expect(errors.join('\n')).toContain('view.gtpl:2:');
    expect(errors.join('\n')).toContain('| <StLabel *for="let item in items" />');
  });

  it('emits a JavaScript render module', async () => {
    const { io, output, writes } = createIO('<StLabel>Hello {{name}}</StLabel>');
    expect(await runCli(['compile', 'view.gtpl', 'view.js'], io)).toBe(0);
    expect(writes).toHaveLength(2);
    const module = writes.find((item) => item.path.endsWith('view.js'))?.content ?? '';
    const map = writes.find((item) => item.path.endsWith('view.js.map'));
    expect(module).toContain('export default\n(ctx, runtime) =>');
    expect(module).toContain('runtime.bind');
    expect(module).toContain('sourceMappingURL=view.js.map');
    expect(JSON.parse(map?.content ?? '{}')).toMatchObject({
      version: 3,
      file: 'view.js',
      sourcesContent: ['<StLabel>Hello {{name}}</StLabel>'],
    });
    expect(JSON.parse(map?.content ?? '{}').mappings).toMatch(/^;;.+/);
    expect(output[0]).toContain('Generated:');
  });

  it('creates parent directories for compiled output files', async () => {
    const { io, directories, writes } = createIO('<StLabel>Hello</StLabel>');
    expect(await runCli(['compile', 'view.gtpl', 'dist/generated/view.js'], io)).toBe(0);
    expect(directories).toContain(resolve('dist/generated'));
    expect(writes.some((item) => item.path.endsWith('dist/generated/view.js'))).toBe(true);
    expect(writes.some((item) => item.path.endsWith('dist/generated/view.js.map'))).toBe(true);
  });

  it('creates a minimal extension project', async () => {
    const { io, output, writes, directories } = createIO('');
    expect(await runCli(['new', 'hello-world', 'out'], io)).toBe(0);
    expect(writes.map((item) => item.path)).toEqual(expect.arrayContaining([expect.stringContaining('metadata.json'), expect.stringContaining('extension.ts'), expect.stringContaining('package.json'), expect.stringContaining('tsconfig.json'), expect.stringContaining('scripts/package.mjs')]));
    const extension = writes.find((item) => item.path.endsWith('extension.ts'))?.content ?? '';
    expect(extension).toContain('override enable(): void');
    expect(extension).toContain('Main.panel.addToStatusArea');
    expect(extension).toContain('this.indicator?.destroy()');
    expect(extension).toContain('InstanceType<typeof St.Button>');
    expect(extension).not.toContain('StButton');
    const packageScript = writes.find((item) => item.path.endsWith('scripts/package.mjs'))?.content ?? '';
    expect(packageScript).toContain("import { spawnSync } from 'node:child_process'");
    expect(packageScript).not.toContain("await import('node:child_process')");
    expect(extension).toContain('Do NOT upload to extensions.gnome.org');
    expect(directories).toEqual(expect.arrayContaining([expect.stringContaining('out/scripts')]));
    expect(output[0]).toContain('Created extension project');
  });

  it('generates a component class and template', async () => {
    const { io, writes } = createIO('');
    expect(await runCli(['generate', 'component', 'UserCard', 'src/components'], io)).toBe(0);
    expect(writes.map((item) => item.path)).toEqual(expect.arrayContaining([expect.stringContaining('UserCard.ts'), expect.stringContaining('UserCard.gtpl')]));
    const component = writes.find((item) => item.path.endsWith('UserCard.ts'))?.content ?? '';
    const template = writes.find((item) => item.path.endsWith('UserCard.gtpl'))?.content ?? '';
    expect(component).toContain("import { Component, Input } from 'gnome-extension-framework/runtime'");
    expect(component).toContain("templateUrl: './UserCard.gtpl'");
    expect(component).toContain("@Input() title = 'UserCard'");
    expect(template).toContain('<StLabel>{{ title }}</StLabel>');
  });

  it('compiles and validates SCSS output', async () => {
    const { io, output, commands } = createIO('.panel { padding: 4px; }');
    expect(await runCli(['styles', 'panel.scss', 'panel.css'], io)).toBe(0);
    expect(commands[0]).toMatchObject({ command: 'npx', args: ['sass', '--no-source-map', expect.stringContaining('panel.scss'), expect.stringContaining('panel.css')] });
    expect(output[0]).toContain('Compiled and validated');
  });

  it('fails style compilation when browser-only layout is present', async () => {
    const { io, errors } = createIO('.panel { display: grid; }');
    expect(await runCli(['styles', 'panel.scss'], io)).toBe(1);
    expect(errors.join('\n')).toContain('GEFCSS1003');
  });

  it('prints source context and a caret for stylesheet diagnostics', async () => {
    const source = '.panel {\n  display: flex;\n}';
    const { io, errors } = createIO(source);
    expect(await runCli(['styles', 'panel.scss'], io)).toBe(1);
    expect(errors.join('\n')).toContain('panel.css:2:3: GEFCSS1003');
    expect(errors.join('\n')).toContain('|   display: flex;');
    expect(errors.join('\n')).toContain('^');
  });

  it('validates staged extension metadata and rejects development files', async () => {
    const base = createIO(JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] }));
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js', '/tmp/demo/src.ts'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : 'export default class Demo {}',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\n')).toContain('development-only file: src.ts');
  });

  it('rejects duplicate Shell versions and invalid optional metadata versions', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json'],
      readFile: async () => JSON.stringify({
        uuid: 'demo@example.com',
        name: 'Demo',
        description: 'A demo',
        'shell-version': ['51', '51'],
        version: '1',
      }),
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\\n')).toContain('shell-version must not contain duplicate');
    expect(base.errors.join('\\n')).toContain('version must be a positive integer');
  });

  it('rejects JavaScript files that are not reachable from either entry point', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js', '/tmp/demo/orphan.js'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : 'export default class Demo { enable() {} disable() {} }',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\\n')).toContain('not imported by either extension entry point: orphan.js');
  });

  it('rejects malformed extension UUIDs and a missing Shell entry point', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json'],
      readFile: async () => JSON.stringify({ uuid: 'demo@@example..com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] }),
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\\n')).toContain('invalid or missing uuid');
    expect(base.errors.join('\\n')).toContain('missing the required extension.js entry point');
  });

  it('rejects a Shell entry point without lifecycle hooks', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : 'export default class Demo {}',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\\n')).toContain('extension class must implement enable()');
    expect(base.errors.join('\\n')).toContain('extension class must implement disable()');
  });

  it('rejects Shell imports from preferences code', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/prefs.js'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : "import St from 'gi://St';",
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\n')).toContain('preferences code must not import Shell-only libraries');
  });

  it('rejects Shell imports in transitive preferences dependencies', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js', '/tmp/demo/prefs.js', '/tmp/demo/lib/prefs-helper.js'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : path.endsWith('prefs.js') ? "import './lib/prefs-helper.js';"
          : path.endsWith('prefs-helper.js') ? "import St from 'gi://St';" : '',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\\n')).toContain('preferences dependency imports a Shell-only library');
  });

  it('rejects GTK imports in transitive Shell dependencies', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js', '/tmp/demo/lib/shell-helper.js'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : path.endsWith('extension.js') ? "import './lib/shell-helper.js';"
          : "import Gtk from 'gi://Gtk?version=4.0';",
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\\n')).toContain('Shell dependency imports GTK or libadwaita');
  });

  it('rejects a declared settings schema that is not packaged', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'], 'settings-schema': 'org.example.demo' })
        : '',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(1);
    expect(base.errors.join('\\n')).toContain('no GSettings schema is packaged');
  });

  it('accepts a matching packaged settings schema', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js', '/tmp/demo/schemas/org.example.demo.gschema.xml'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'], 'settings-schema': 'org.example.demo' })
        : path.endsWith('.gschema.xml') ? '<schemalist><schema id="org.example.demo" path="/org/example/demo/"></schema></schemalist>' : 'export default class Demo { enable() {} disable() {} }',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io), base.errors.join('\n')).toBe(0);
  });

  it('warns about unreferenced assets without failing the EGO check', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js', '/tmp/demo/stylesheet.css', '/tmp/demo/icons/unused.png', '/tmp/demo/icons/used.svg'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : path.endsWith('extension.js')
          ? "export default class Demo { enable() { this.icon = 'icons/used.svg'; } disable() {} }"
          : path.endsWith('stylesheet.css') ? ".icon { background-image: url('icons/used.svg'); }" : '',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(0);
    expect(base.errors.join('\\n')).toContain('Possibly unused package resource: icons/unused.png');
    expect(base.errors.join('\\n')).not.toContain('icons/used.svg');
    expect(base.output[0]).toContain('EGO checks passed');
  });

  it('accepts a clean staged extension', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      listFiles: async () => ['/tmp/demo/metadata.json', '/tmp/demo/extension.js', '/tmp/demo/stylesheet.css'],
      readFile: async (path) => path.endsWith('metadata.json')
        ? JSON.stringify({ uuid: 'demo@example.com', name: 'Demo', description: 'A demo', 'shell-version': ['51'] })
        : 'export default class Demo { enable() {} disable() {} }',
    };
    expect(await runCli(['ego-check', '/tmp/demo'], io)).toBe(0);
    expect(base.output[0]).toContain('EGO checks passed');
  });

  it('checks compiler and native GNOME prerequisites', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      run: (command, args) => {
        const output = command === 'gnome-shell' ? 'GNOME Shell 51.2'
          : command === 'npx' ? '1.89.0'
          : command === 'gjs' ? 'gjs 1.86.0'
          : command === 'pkg-config' ? (args[0] === '--modversion' ? '4.0.0' : '')
          : '2.80.0';
        return { status: 0, output };
      },
    };
    expect(await runCli(['doctor'], io)).toBe(0);
    expect(base.output[0]).toContain('GNOME Shell 51: GNOME Shell 51.2');
    expect(base.output[0]).toContain('GSettings schema compiler');
  });

  it('fails doctor when a required native tool is missing', async () => {
    const base = createIO('');
    const io: CliIO = {
      ...base.io,
      run: (command) => ({ status: command === 'gnome-shell' ? 1 : 0, output: '' }),
    };
    expect(await runCli(['doctor'], io)).toBe(1);
    expect(base.output[0]).toContain('MISSING  GNOME Shell 51');
  });

  it('runs the build command', async () => {
    const { io, commands } = createIO('');
    expect(await runCli(['build'], io)).toBe(0);
    expect(commands[0]).toEqual({ command: 'npm', args: ['run', 'build'] });
  });

  it('runs the package workflow', async () => {
    const { io, commands } = createIO('');
    expect(await runCli(['package'], io)).toBe(0);
    expect(commands).toEqual([
      { command: 'npm', args: ['run', 'build'] },
      { command: 'npm', args: ['run', 'package:example'] },
    ]);
  });

  it('reports missing files', async () => {
    const base = createIO('');
    const io: CliIO = { ...base.io, readFile: async () => { throw new Error('missing'); } };
    expect(await runCli(['check', 'missing.gtpl'], io)).toBe(2);
    expect(base.errors.join()).toContain('Unable to read');
  });
});
