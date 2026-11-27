import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileTypeScriptComponentsToUiIr } from './compile-components.js';

const directories: string[] = [];

async function createProject(source: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'gef-ts-ui-project-'));
  directories.push(directory);
  await mkdir(join(directory, 'src'));
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
    include: ['src/**/*.ts'],
  }));
  await writeFile(join(directory, 'src', 'components.ts'), source);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('compileTypeScriptComponentsToUiIr', () => {
  it('discovers and compiles a shared component registry without loading application code', async () => {
    const directory = await createProject(`
      const Component = (_options: object): ClassDecorator => () => {};
      const Input = (_name?: string): PropertyDecorator => () => {};
      const Output = (_name?: string): PropertyDecorator => () => {};
      @Component({ selector: 'GefButton', template: '<StLabel>{{label}}</StLabel>' })
      class Button {
        label = 'Save';
        @Input() disabled = false;
        @Output() clicked = false;
      }
      @Component({ selector: 'GefEditor', template: '<GefButton [disabled]="busy" (clicked)="save()" />' })
      class Editor {
        busy = false;
        save(): void {}
      }
    `);
    const result = compileTypeScriptComponentsToUiIr({
      configFilePath: join(directory, 'tsconfig.json'),
      nativeElements: ['StLabel'],
    });
    expect(result.success).toBe(true);
    expect(result.components).toHaveLength(2);
    expect(result.components[0]?.nodes[0]).toMatchObject({ kind: 'element', component: 'StLabel' });
    expect(result.components[1]?.nodes[0]).toMatchObject({ kind: 'element', component: 'GefButton' });
    expect(result.components[1]?.diagnostics).toEqual([]);
  });

  it('loads external templates relative to their declaring source file', async () => {
    const directory = await createProject(`
      const Component = (_options: object): ClassDecorator => () => {};
      @Component({ selector: 'GefExternal', templateUrl: './external.gtpl' })
      class External {}
    `);
    await writeFile(join(directory, 'src', 'external.gtpl'), '<StLabel>External</StLabel>');
    const result = compileTypeScriptComponentsToUiIr({
      configFilePath: join(directory, 'tsconfig.json'),
      nativeElements: ['StLabel'],
    });
    expect(result.success).toBe(true);
    expect(result.components[0]?.nodes[0]).toMatchObject({ kind: 'element', component: 'StLabel' });
  });

  it('reports a clear error when an external template file is missing', async () => {
    const directory = await createProject(`
      const Component = (_options: object): ClassDecorator => () => {};
      @Component({ selector: 'GefMissing', templateUrl: './missing.gtpl' }) class Missing {}
    `);
    expect(() => compileTypeScriptComponentsToUiIr({ configFilePath: join(directory, 'tsconfig.json') }))
      .toThrow(/Cannot read template for component "GefMissing"/);
  });

  it('rejects duplicate selectors', async () => {
    const directory = await createProject(`
      const Component = (_options: object): ClassDecorator => () => {};
      @Component({ selector: 'GefDuplicate', template: '<Unknown />' }) class First {}
      @Component({ selector: 'GefDuplicate', template: 'Second' }) class Second {}
    `);
    expect(() => compileTypeScriptComponentsToUiIr({ configFilePath: join(directory, 'tsconfig.json') }))
      .toThrow(/Duplicate component selector/);
  });

  it('returns discovery diagnostics without partial IR', async () => {
    const directory = await createProject(`
      const selector = 'GefDynamic';
      const Component = (_options: object): ClassDecorator => () => {};
      @Component({ selector, template: 'Hello' }) class Dynamic {}
    `);
    const result = compileTypeScriptComponentsToUiIr({ configFilePath: join(directory, 'tsconfig.json') });
    expect(result.success).toBe(false);
    expect(result.components).toEqual([]);
    expect(result.discoveryDiagnostics).toHaveLength(1);
    expect(result.discoveryDiagnostics[0]?.messageText).toMatch(/static selector/);
  });
});
