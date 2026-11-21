import { describe, expect, it } from 'vitest';
import { runCli, type CliIO } from './index.js';

function createIO(source: string) {
  const output: string[] = [];
  const errors: string[] = [];
  const writes: Array<{ path: string; content: string }> = [];
  const io: CliIO = {
    readFile: async () => source,
    writeFile: async (path, content) => { writes.push({ path, content }); },
    mkdir: async () => {},
    run: () => ({ status: 0, output: '' }),
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
  return { io, output, errors, writes };
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

  it('reports compiler diagnostics and returns a failure code', async () => {
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
    expect(writes.map((item) => item.path)).toEqual(expect.arrayContaining([expect.stringContaining('metadata.json'), expect.stringContaining('extension.js')]));
    expect(output[0]).toContain('Created extension project');
  });

  it('reports file read and write errors', async () => {
    const readFailure: CliIO = {
      readFile: async () => { throw new Error('missing'); },
      writeFile: async () => {},
      stdout: () => {},
      stderr: () => {},
    };
    const messages: string[] = [];
    const io = { ...readFailure, stderr: (message: string) => messages.push(message) };
    expect(await runCli(['check', 'missing.gtpl'], io)).toBe(2);
    expect(messages.join()).toContain('Unable to read');
  });
});
