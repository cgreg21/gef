import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverTypeScriptComponents } from './components.js';

const directories: string[] = [];

async function createProject(source: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'gef-component-discovery-'));
  directories.push(directory);
  await mkdir(join(directory, 'src'));
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      experimentalDecorators: true,
    },
    include: ['src/**/*.ts'],
  }));
  await writeFile(join(directory, 'src', 'components.ts'), source);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('discoverTypeScriptComponents', () => {
  it('discovers component templates, bindings and instance members without loading modules', async () => {
    const directory = await createProject(`
      const Component = (_options: object): ClassDecorator => () => {};
      const Input = (_name?: string): PropertyDecorator => () => {};
      const Output = (_name?: string): PropertyDecorator => () => {};
      @Component({ selector: 'GefEditor', template: '<StLabel>{{title}}</StLabel>' })
      class Editor {
        title = 'GEF';
        save(): void {}
        @Input('caption') label = '';
        @Output() readonly closed = false;
        static version = 1;
      }
      @Component({ selector: 'GefExternal', templateUrl: './external.gtpl' })
      class External {}
    `);
    const result = discoverTypeScriptComponents({ configFilePath: join(directory, 'tsconfig.json') });

    expect(result.success).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.components).toMatchObject([
      {
        className: 'Editor',
        selector: 'GefEditor',
        template: '<StLabel>{{title}}</StLabel>',
        inputs: ['caption'],
        outputs: ['closed'],
        componentMembers: ['title', 'save', 'label', 'closed'],
      },
      {
        className: 'External',
        selector: 'GefExternal',
        templateUrl: './external.gtpl',
      },
    ]);
  });

  it('reports dynamic component metadata instead of guessing', async () => {
    const directory = await createProject(`
      const selector = 'GefDynamic';
      const Component = (_options: object): ClassDecorator => () => {};
      @Component({ selector, template: '<StLabel />' })
      class Dynamic {}
    `);
    const result = discoverTypeScriptComponents({ configFilePath: join(directory, 'tsconfig.json') });

    expect(result.success).toBe(false);
    expect(result.components).toEqual([]);
    expect(result.diagnostics.map((item) => item.code)).toContain(99001);
  });

  it('returns a diagnostic when the tsconfig is missing', () => {
    const result = discoverTypeScriptComponents({ configFilePath: join(tmpdir(), 'gef-no-components-tsconfig.json') });

    expect(result.success).toBe(false);
    expect(result.components).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
  });
});
