import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileTypeScriptProject } from './project.js';

const directories: string[] = [];

async function createProject(source: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'gef-typescript-'));
  directories.push(directory);
  await mkdir(join(directory, 'src'));
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
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

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('compileTypeScriptProject', () => {
  it('type-checks and emits JavaScript with source maps', async () => {
    const directory = await createProject('export const answer: number = 42;');
    const result = compileTypeScriptProject({ configFilePath: join(directory, 'tsconfig.json') });

    expect(result.success).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
    expect(new Set(result.emittedFiles.map((file) => file.split('/').at(-1))))
      .toEqual(new Set(['index.js', 'index.js.map']));
    expect(await readFile(join(directory, 'dist', 'index.js'), 'utf8')).toContain('answer = 42');
    expect(await readFile(join(directory, 'dist', 'index.js.map'), 'utf8')).toContain('"version":3');
  });

  it('does not emit files when type checking fails', async () => {
    const directory = await createProject('export const answer: number = "wrong";');
    const result = compileTypeScriptProject({ configFilePath: join(directory, 'tsconfig.json') });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 2322)).toBe(true);
    await expect(readFile(join(directory, 'dist', 'index.js'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports a missing tsconfig without throwing', () => {
    const result = compileTypeScriptProject({ configFilePath: join(tmpdir(), 'gef-missing-tsconfig.json') });

    expect(result.success).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe(5083);
  });
});
