import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { compileGtplToUiIr } from '../../ir/ui.js';
import { compileGtkNative } from './compile.js';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const run = vi.mocked(spawnSync);
const nodes = compileGtplToUiIr('<GtkLabel label="Native GEF" />').nodes;
let directory = '';

afterEach(async () => {
  run.mockReset();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = '';
});

describe('GTK4 native compiler', () => {
  it('compiles generated C with GTK4 flags into the requested executable', async () => {
    directory = await mkdtemp(join(tmpdir(), 'gef-native-test-'));
    run.mockReturnValueOnce({ status: 0, stdout: '-I/usr/include/gtk-4.0 -lgtk-4', stderr: '', error: undefined } as never);
    run.mockReturnValueOnce({ status: 0, stdout: '', stderr: '', error: undefined } as never);

    const outputFile = join(directory, 'bin', 'application');
    const result = await compileGtkNative(nodes, { outputFile });

    expect(result).toEqual({ success: true, outputFile, diagnostics: [] });
    expect(run).toHaveBeenNthCalledWith(1, 'pkg-config', ['--cflags', '--libs', 'gtk4'], { encoding: 'utf8' });
    expect(run).toHaveBeenNthCalledWith(2, 'cc', expect.arrayContaining([
      '-std=gnu11', '-o', outputFile, '-I/usr/include/gtk-4.0', '-lgtk-4',
    ]), { encoding: 'utf8' });
  });

  it('returns a diagnostic when GTK4 development files are missing', async () => {
    run.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'gtk4.pc not found', error: undefined } as never);
    const result = await compileGtkNative(nodes, { outputFile: '/tmp/gef-native-test' });
    expect(result.success).toBe(false);
    expect(result.diagnostics).toEqual(['gtk4.pc not found']);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not invoke native tools for unsupported UI nodes', async () => {
    const invalid = compileGtplToUiIr('<GtkEntry />');
    const result = await compileGtkNative(invalid.nodes, { outputFile: '/tmp/gef-native-test' });
    expect(result.success).toBe(false);
    expect(result.diagnostics[0]).toContain('Unsupported GTK element');
    expect(run).not.toHaveBeenCalled();
  });
});
