import { describe, expect, it } from 'vitest';
import { runCli, type CliIO } from './index.js';

function createIO(source: string, commandStatus = 0) {
  const output: string[] = [];
  const errors: string[] = [];
  const writes: Array<{ path: string; content: string }> = [];
  const commands: Array<{ command: string; args: readonly string[] }> = [];
  const io: CliIO = {
    readFile: async () => source,
    writeFile: async (path, content) => { writes.push({ path, content }); },
    mkdir: async () => {},
    run: (command, args) => { commands.push({ command, args }); return { status: commandStatus, output: '' }; },
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
  return { io, output, errors, writes, commands };
}

describe('GEF CLI', () => {
  it('prints help without reading a file', async () => {
    const { io, output } = createIO('');
    expect(await runCli(['--help'], io)).toBe(0);
    expect(output[0]).toContain('gef check');
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

  it('emits a JavaScript render module', async () => {
    const { io, output, writes } = createIO('<StLabel>Hello {{name}}</StLabel>');
    expect(await runCli(['compile', 'view.gtpl', 'view.js'], io)).toBe(0);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.path).toContain('view.js');
    expect(writes[0]?.content).toContain('export default (ctx, runtime) =>');
    expect(writes[0]?.content).toContain('runtime.bind');
    expect(output[0]).toContain('Generated:');
  });

  it('creates a minimal extension project', async () => {
    const { io, output, writes } = createIO('');
    expect(await runCli(['new', 'hello-world', 'out'], io)).toBe(0);
    expect(writes.map((item) => item.path)).toEqual(expect.arrayContaining([expect.stringContaining('metadata.json'), expect.stringContaining('extension.ts')]));
    expect(output[0]).toContain('Created extension project');
  });

  it('generates a component class and template', async () => {
    const { io, writes } = createIO('');
    expect(await runCli(['generate', 'component', 'UserCard', 'src/components'], io)).toBe(0);
    expect(writes.map((item) => item.path)).toEqual(expect.arrayContaining([expect.stringContaining('UserCard.ts'), expect.stringContaining('UserCard.gtpl')]));
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
