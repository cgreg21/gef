import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../compiler/src/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../compiler/src/index.js')>();
  return { ...actual, compileGtkNative: vi.fn() };
});

import { compileGtkNative } from '../../../compiler/src/index.js';
import { runCompileNative } from './compile-native.js';

const compile = vi.mocked(compileGtkNative);

function createIO(source = '<GtkLabel label="Hello" />') {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    io: {
      readFile: async () => source,
      stdout: (message: string) => output.push(message),
      stderr: (message: string) => errors.push(message),
    },
    output,
    errors,
  };
}

describe('gef compile-native', () => {
  beforeEach(() => compile.mockReset());

  it('compiles a static GTK template to the requested executable path', async () => {
    compile.mockResolvedValue({ success: true, outputFile: '/tmp/demo', diagnostics: [] });
    const { io, output, errors } = createIO();

    expect(await runCompileNative('view.gtpl', 'dist/demo', io)).toBe(0);
    expect(compile).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ kind: 'element', component: 'GtkLabel' })]),
      { outputFile: expect.stringMatching(/dist[/\\]demo$/) },
    );
    expect(output[0]).toContain('Generated native GTK4 executable');
    expect(errors).toHaveLength(0);
  });

  it('uses the template name as the default executable path', async () => {
    compile.mockResolvedValue({ success: true, outputFile: '/tmp/view', diagnostics: [] });
    const { io } = createIO();

    expect(await runCompileNative('view.gtpl', undefined, io)).toBe(0);
    expect(compile.mock.calls[0]?.[1].outputFile).toMatch(/view$/);
  });

  it('rejects invalid GTPL before invoking the native compiler', async () => {
    const { io, errors } = createIO('<GtkLabel [label]="invalid +" />');

    expect(await runCompileNative('view.gtpl', undefined, io)).toBe(1);
    expect(compile).not.toHaveBeenCalled();
    expect(errors.join('\\n')).toContain('GTPL');
  });

  it('reports native compiler diagnostics', async () => {
    compile.mockResolvedValue({ success: false, outputFile: '/tmp/demo', diagnostics: ['GTK4 development files not found'] });
    const { io, errors } = createIO();

    expect(await runCompileNative('view.gtpl', 'demo', io)).toBe(1);
    expect(errors.join('\\n')).toContain('GTK4 development files not found');
  });

  it('reports missing input files', async () => {
    const { io, errors } = createIO();
    io.readFile = async () => { throw new Error('missing'); };

    expect(await runCompileNative('missing.gtpl', undefined, io)).toBe(2);
    expect(errors.join('\\n')).toContain('Unable to read');
    expect(compile).not.toHaveBeenCalled();
  });

  it('requires an input template', async () => {
    const { io, errors } = createIO();

    expect(await runCompileNative(undefined, undefined, io)).toBe(2);
    expect(errors[0]).toContain('Usage: gef compile-native');
  });
});