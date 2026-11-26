import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
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
      const renderSource = await readFile(compiled, 'utf8');
      const renderModule = await import(`data:text/javascript;base64,${Buffer.from(renderSource).toString('base64')}`) as { default: unknown };
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

      if (projectType === 'extension') {
        const config = await readFile(join(project, 'src/app/app.config.ts'), 'utf8');
        expect(config).toContain('ApplicationRouterConfig<StActor>');
        expect(await readFile(join(project, 'src/extension.ts'), 'utf8')).toContain('renderRouterOutlet');

        const frameworkBuild = spawnSync(process.execPath, [
          resolve(process.cwd(), 'node_modules/typescript/bin/tsc'),
          '-p',
          resolve(process.cwd(), 'tsconfig.build.json'),
        ], { cwd: process.cwd(), encoding: 'utf8' });
        expect(frameworkBuild.status, frameworkBuild.stdout + frameworkBuild.stderr).toBe(0);

        const frameworkPackage = join(project, 'node_modules/gnome-extension-framework');
        await mkdir(frameworkPackage, { recursive: true });
        await cp(resolve(process.cwd(), 'package.json'), join(frameworkPackage, 'package.json'));
        await cp(resolve(process.cwd(), 'dist'), join(frameworkPackage, 'dist'), { recursive: true });

        const build = spawnSync(process.execPath, [
          resolve(process.cwd(), 'node_modules/typescript/bin/tsc'),
          '-p',
          'tsconfig.json',
        ], { cwd: project, encoding: 'utf8' });
        expect(build.status, build.stdout + build.stderr).toBe(0);

        const staged = join(project, 'dist');
        await cp(join(project, 'metadata.json'), join(staged, 'metadata.json'));
        expect(await runCli(['ego-check', staged])).toBe(0);
      }

      if (projectType === 'application') {
        const source = await readFile(join(project, 'src/app/app.config.ts'), 'utf8');
        expect(await readFile(join(project, 'src/main.ts'), 'utf8')).toContain('renderRouterOutlet');
        const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
        const configModule = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`) as {
          appConfig: { applicationId: string; window: { width: number; height: number }; router: { initialUrl: string; routes: { path: string }[] } };
        };
        expect(configModule.appConfig).toMatchObject({
          applicationId: 'com.example.desktop.smoke',
          window: { width: 640, height: 480 },
          router: { initialUrl: '/', routes: [{ path: '/' }] },
        });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('generates a component with a matching GTPL template and compilable render module', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gef-component-'));
    try {
      const output = join(root, 'src', 'components');
      expect(await runCli(['generate', 'component', 'UserProfile', output])).toBe(0);

      const componentPath = join(output, 'user-profile.ts');
      const templatePath = join(output, 'user-profile.gtpl');
      const component = await readFile(componentPath, 'utf8');
      const template = await readFile(templatePath, 'utf8');

      expect(component).toContain("import { Component, Input } from 'gnome-extension-framework/runtime'");
      expect(component).toContain("@Component({ selector: 'user-profile', templateUrl: './user-profile.gtpl' })");
      expect(component).toContain('@Input() title =');
      expect(template).toContain('{{ title }}');

      const parsed = ts.createSourceFile(componentPath, component, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      expect((parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics).toHaveLength(0);
      const result = ts.transpileModule(component, {
        fileName: componentPath,
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      });
      expect(result.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error)).toEqual([]);

      const compiled = join(output, 'user-profile.view.js');
      expect(await runCli(['compile', templatePath, compiled])).toBe(0);
      const renderModule = await import(pathToFileURL(compiled).href) as { default: unknown };
      expect(typeof renderModule.default).toBe('function');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['directive', 'Highlight', 'highlight.directive.ts'],
    ['service', 'User', 'user.service.ts'],
    ['pipe', 'Truncate', 'truncate.pipe.ts'],
  ] as const)('generates and compiles a %s with Angular-style naming', async (type, name, fileName) => {
    const root = await mkdtemp(join(tmpdir(), 'gef-generate-'));
    try {
      const output = join(root, 'src');
      expect(await runCli(['generate', type, name, output])).toBe(0);
      const source = await readFile(join(output, fileName), 'utf8');
      const parsed = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      expect((parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics).toHaveLength(0);
      const result = ts.transpileModule(source, {
        fileName,
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      });
      expect(result.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error)).toEqual([]);
      if (type === 'directive') expect(source).toContain("@Directive({ selector: '[appHighlight]' })");
      if (type === 'service') expect(source).toContain('export class UserService');
      if (type === 'pipe') expect(source).toContain("@Pipe({ name: 'truncate' })");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

});
