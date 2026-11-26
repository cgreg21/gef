import { resolve } from 'node:path';
import { executeGenerationPlan } from '../generation/plan.js';
import type { CliIO } from '../index.js';

export async function runGenerate(
  inputArg: string | undefined,
  outputArg: string | undefined,
  args: readonly string[],
  io: Pick<CliIO, 'mkdir' | 'writeFile' | 'fileExists' | 'stdout' | 'stderr'>,
): Promise<number> {
    const type = inputArg;
    const name = outputArg;
    const suffix = type === 'directive' ? 'Directive' : type === 'service' ? 'Service' : type === 'pipe' ? 'Pipe' : '';
    const supported = type === 'component' || Boolean(suffix);
    const baseName = suffix && name?.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
    if (!supported || !name || !baseName || !/^[A-Z][A-Za-z0-9]*$/.test(baseName)) {
      io.stderr('Usage: gef generate <component|directive|service|pipe> <PascalCaseName> [directory]');
      return 2;
    }
    const className = type === 'component' ? name : baseName + suffix;
    const fileName = baseName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    let directoryArg: string | undefined;
    let dryRun = false;
    let force = false;
    for (const argument of args.slice(3)) {
      if (argument === '--dry-run') {
        if (dryRun) { io.stderr('Duplicate option: --dry-run'); return 2; }
        dryRun = true;
      } else if (argument === '--force') {
        if (force) { io.stderr('Duplicate option: --force'); return 2; }
        force = true;
      } else if (argument.startsWith('-') || directoryArg !== undefined) {
        io.stderr(`Unexpected argument: ${argument}`);
        return 2;
      } else {
        directoryArg = argument;
      }
    }
    const directory = resolve(directoryArg ?? '.');
    const files: Readonly<Record<string, string>> = type === 'component' ? {
      [`${fileName}.ts`]: `import { Component, Input } from 'gnome-extension-framework/runtime';

@Component({ selector: '${fileName}', templateUrl: './${fileName}.gtpl' })
export class ${className} {
  @Input() title = '${className}';
}
`,
      [`${fileName}.gtpl`]: `<StBox>
  <StLabel>{{ title }}</StLabel>
</StBox>
`,
    } : type === 'directive' ? {
      [`${fileName}.directive.ts`]: `import { Directive } from 'gnome-extension-framework/runtime';

@Directive({ selector: '[app${baseName}]' })
export class ${className} {}
`,
    } : type === 'service' ? {
      [`${fileName}.service.ts`]: `export class ${className} {}
`,
    } : {
      [`${fileName}.pipe.ts`]: `import { Pipe } from 'gnome-extension-framework/runtime';

@Pipe({ name: '${baseName[0]!.toLowerCase() + baseName.slice(1)}' })
export class ${className} {
  transform(value: unknown): string {
    return String(value);
  }
}
`,
    };
    try {
      await executeGenerationPlan(io, directory, files, {
        title: `Generation plan for ${type} ${className}`,
        target: 'generated files',
        dryRun,
        force,
      });
    } catch (error) {
      io.stderr(`Unable to generate ${type}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
    io.stdout(`Generated ${type} ${className} in ${directory}`);
    return 0;
}
