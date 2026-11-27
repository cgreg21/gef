import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCompileTypeScript } from './compile-ts.js';

const directories: string[] = [];

async function createProject(source: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'gef-cli-compile-ts-'));
  directories.push(directory);
  await mkdir(join(directory, 'src'));
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      noEmit: true,
      sourceMap: true,
      outDir: 'dist',
    },
    include: ['src/**/*.ts'],
  }));
  await writeFile(join(directory, 'src', 'index.ts'), source);
  return directory;
}

function createIO() {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    io: {
      stdout: (message: string) => output.push(message),
      stderr: (message: string) => errors.push(message),
    },
    output,
    errors,
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('gef compile-ts', () => {
  it('compiles a project and supports an output directory override', async () => {
    const directory = await createProject('export const answer: number = 42;');
    const { io, output, errors } = createIO();

    expect(await runCompileTypeScript([
      '--project', join(directory, 'tsconfig.json'),
      '--out-dir', join(directory, 'build'),
    ], io)).toBe(0);
    expect(output[0]).toContain('1 files emitted');
    expect(errors).toHaveLength(0);
    expect(await readFile(join(directory, 'build', 'index.js'), 'utf8')).toContain('answer = 42');
    expect(await readFile(join(directory, 'build', 'index.js.map'), 'utf8')).toContain('"version":3');
  });

  it('prints TypeScript diagnostics and emits nothing for invalid projects', async () => {
    const directory = await createProject('export const answer: number = "wrong";');
    const { io, output, errors } = createIO();

    expect(await runCompileTypeScript([join(directory, 'tsconfig.json')], io)).toBe(1);
    expect(output).toHaveLength(0);
    expect(errors.join('\n')).toContain('TS2322');
    await expect(readFile(join(directory, 'dist', 'index.js'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects duplicate and incomplete options', async () => {
    const { io, errors } = createIO();

    expect(await runCompileTypeScript(['--project'], io)).toBe(2);
    expect(errors[0]).toContain('Usage: gef compile-ts');
    expect(await runCompileTypeScript(['one.json', 'two.json'], io)).toBe(2);
    expect(await runCompileTypeScript(['--out-dir'], io)).toBe(2);
  });

  it('reports a missing project configuration', async () => {
    const { io, errors } = createIO();

    expect(await runCompileTypeScript(['--project', join(tmpdir(), 'gef-cli-missing.json')], io)).toBe(1);
    expect(errors.join('\n')).toContain('TS5083');
  });
});
