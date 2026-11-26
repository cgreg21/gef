import { relative, resolve } from 'node:path';

interface GenerationIO {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  fileExists?(path: string): Promise<boolean>;
  stdout(message: string): void;
}

interface GenerationOptions {
  title: string;
  target: string;
  dryRun: boolean;
  force: boolean;
  directories?: readonly string[];
}

export async function executeGenerationPlan(
  io: GenerationIO,
  directory: string,
  files: Readonly<Record<string, string>>,
  options: GenerationOptions,
): Promise<void> {
  const entries = Object.entries(files);
  const paths = entries.map(([path]) => resolve(directory, path));
  if (paths.some((path) => {
    const relativePath = relative(directory, path);
    return relativePath.startsWith('..') || resolve(directory, relativePath) !== path;
  })) {
    throw new Error('Generated file path escapes the target directory.');
  }

  const existing = io.fileExists
    ? await Promise.all(paths.map((path) => io.fileExists!(path)))
    : paths.map(() => false);
  if (!options.force && existing.some(Boolean)) {
    throw new Error(`A generated file already exists; use --force to overwrite ${options.target}.`);
  }

  if (options.dryRun) {
    io.stdout(`${options.title}:\n${paths.map((path, index) => `  ${existing[index] ? 'overwrite' : 'create'} ${path}`).join('\n')}`);
    return;
  }

  await io.mkdir(directory);
  for (const folder of options.directories ?? []) {
    await io.mkdir(resolve(directory, folder));
  }
  for (const [index, [, source]] of entries.entries()) {
    await io.writeFile(paths[index]!, source);
  }
}
