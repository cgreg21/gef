import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist/extension');
const cli = resolve(root, 'dist/cli/src/index.js');
const runtime = resolve(root, 'dist/runtime/src');
const shared = resolve(root, 'dist/shared/src');

const shellTemplate = resolve(root, 'packages/examples/hello-world/template.gtpl');
const preferencesTemplate = resolve(root, 'packages/examples/preferences/template.gtpl');
const shellGenerated = resolve(root, 'dist/examples/hello-world/template.js');
const preferencesGenerated = resolve(root, 'dist/examples/preferences/template.js');
const shellStyles = resolve(root, 'packages/examples/hello-world/stylesheet.scss');
const metadata = resolve(root, 'packages/examples/hello-world/metadata.json');
const schemas = resolve(root, 'packages/examples/hello-world/schemas');
const shellEntry = resolve(root, 'dist/examples/hello-world/extension.js');
const preferencesEntry = resolve(root, 'dist/examples/preferences/prefs.js');

function run(command, args, label) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(label);
}

run(process.execPath, [cli, 'compile', shellTemplate, shellGenerated], 'Unable to compile the Shell GTPL template.');
run(process.execPath, [cli, 'compile', preferencesTemplate, preferencesGenerated], 'Unable to compile the preferences GTPL template.');

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'lib'), { recursive: true });
run('npx', ['sass', '--no-source-map', shellStyles, resolve(output, 'stylesheet.css')], 'Unable to compile the Shell stylesheet.');

await cp(runtime, resolve(output, 'lib/runtime'), { recursive: true });
await cp(shared, resolve(output, 'shared/src'), { recursive: true });
await cp(shellGenerated, resolve(output, 'template.js'));
await cp(preferencesGenerated, resolve(output, 'preferences-template.js'));
await cp(metadata, resolve(output, 'metadata.json'));
await cp(schemas, resolve(output, 'schemas'), { recursive: true });
run('glib-compile-schemas', ['--strict', resolve(output, 'schemas')], 'Unable to compile the GSettings schema.');

const runtimeImport = '../../runtime/src/index.js';
const shell = await readFile(shellEntry, 'utf8');
if (!shell.includes(runtimeImport)) throw new Error('Unexpected Shell runtime import in compiled example.');
await writeFile(resolve(output, 'extension.js'), shell.replace(runtimeImport, './lib/runtime/index.js'), 'utf8');

let preferences = await readFile(preferencesEntry, 'utf8');
if (!preferences.includes(runtimeImport)) throw new Error('Unexpected preferences runtime import in compiled example.');
preferences = preferences.replace(runtimeImport, './lib/runtime/index.js');
if (!preferences.includes('./template.js')) throw new Error('Unexpected preferences template import in compiled example.');
preferences = preferences.replace('./template.js', './preferences-template.js');
await writeFile(resolve(output, 'prefs.js'), preferences, 'utf8');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

for (const file of await listFiles(output)) {
  if (!file.endsWith('.js')) continue;
  const source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)];
  if (file.includes('/lib/runtime/') && imports.some((match) => match[1] === 'typescript' || match[1]?.startsWith('node:'))) {
    throw new Error(`Node.js or TypeScript dependency found in GJS runtime module: ${file}`);
  }
  for (const match of imports) {
    const specifier = match[1] ?? '';
    if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier);
    try {
      await access(target);
    } catch {
      throw new Error(`Unresolved staged ESM import "${specifier}" in ${file}.`);
    }
  }
}

run(process.execPath, [cli, 'ego-check', output], 'EGO package validation failed.');

process.stdout.write(`Staged and verified GNOME Shell extension and GTK preferences: ${output}\n`);
