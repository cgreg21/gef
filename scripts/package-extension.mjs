import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

process.stdout.write(`Staged GNOME Shell extension and GTK preferences: ${output}\n`);
