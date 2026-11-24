import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import { runCli } from './index.js';

describe('generated project smoke tests', () => {
  it.each([
    ['application', 'desktop-smoke'],
    ['extension', 'shell-smoke'],
  ] as const)('creates and compiles a real %s project', async (projectType, name) => {
    const root = await mkdtemp(join(tmpdir(), 'gef-generated-'));
    const project = join(root, name);
    try {
      expect(await runCli(['new', name, project, '--type', projectType])).toBe(0);

      const config = JSON.parse(await readFile(join(project, 'gef.json'), 'utf8')) as {
        defaultProject: string;
        projects: Record<string, { projectType: string; entryPoint: string }>;
      };
      expect(config.defaultProject).toBe(name);
      expect(config.projects[name]).toMatchObject({ projectType, sourceRoot: 'src' });

      const template = join(project, 'src/app/app.component.gtpl');
      expect(await runCli(['check', template])).toBe(0);
      const compiled = join(project, 'src/app/app.component.view.js');
      expect(await runCli(['compile', template, compiled])).toBe(0);
      const renderModule = await import(pathToFileURL(compiled).href) as { default: unknown };
      expect(typeof renderModule.default).toBe('function');

      const sourceFiles = async (directory: string): Promise<string[]> => {
        const entries = await readdir(directory, { withFileTypes: true });
        const nested = await Promise.all(entries.map((entry) => {
          const path = join(directory, entry.name);
          return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') && !path.endsWith('.d.ts') ? [path] : [];
        }));
        return nested.flat();
      };
      for (const file of await sourceFiles(join(project, 'src'))) {
        const source = await readFile(file, 'utf8');
        const result = ts.transpileModule(source, {
          fileName: file,
          reportDiagnostics: true,
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            experimentalDecorators: true,
            useDefineForClassFields: false,
          },
        });
        expect(result.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error), file).toEqual([]);
      }

      if (projectType === 'application') {
        const source = await readFile(join(project, 'src/app/app.config.ts'), 'utf8');
        const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
        const configModule = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`) as {
          appConfig: { applicationId: string; window: { width: number; height: number } };
        };
        expect(configModule.appConfig).toMatchObject({
          applicationId: 'com.example.desktop.smoke',
          window: { width: 640, height: 480 },
        });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
