import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist/extension');
const runtimeSource = resolve(root, 'dist/runtime/src');
const exampleSource = resolve(root, 'dist/examples/hello-world/extension.js');
const metadataSource = resolve(root, 'packages/examples/hello-world/metadata.json');
const templateSource = resolve(root, 'packages/examples/hello-world/template.gtpl');
const cliSource = resolve(root, 'dist/cli/src/index.js');
const generatedTemplate = resolve(root, 'dist/examples/hello-world/template.js');
const preferencesSource = resolve(root, 'dist/examples/preferences/prefs.js');
const preferencesTemplate = resolve(root, 'packages/examples/preferences/template.gtpl');
const generatedPreferencesTemplate = resolve(root, 'dist/examples/preferences/template.js');
const stylesheetSource = resolve(root, 'packages/examples/hello-world/stylesheet.scss');
const preferencesSource = resolve(root, 'dist/examples/preferences/prefs.js');
const preferencesTemplate = resolve(root, 'packages/examples/preferences/template.gtpl');
const generatedPreferencesTemplate = resolve(root, 'dist/examples/preferences/template.js');
const stylesheetSource = resolve(root, 'packages/examples/hello-world/stylesheet.scss');

const compilation = spawnSync(process.execPath, [cliSource, 'compile', templateSource, generatedTemplate], {
  cwd: root,
  stdio: 'inherit',
});
if (compilation.status !== 0) throw new Error('Unable to compile the hello-world GTPL template.');
const preferencesCompilation = spawnSync(process.execPath, [cliSource, 'compile', preferencesTemplate, generatedPreferencesTemplate], { cwd: root, stdio: 'inherit' });
if (preferencesCompilation.status !== 0) throw new Error('Unable to compile the preferences GTPL template.');
const preferencesCompilation = spawnSync(process.execPath, [cliSource, 'compile', preferencesTemplate, generatedPreferencesTemplate], { cwd: root, stdio: 'inherit' });
if (preferencesCompilation.status !== 0) throw new Error('Unable to compile the preferences GTPL template.');

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'lib'), { recursive: true });
const styles = spawnSync('npx', ['sass', '--no-source-map', stylesheetSource, resolve(output, 'stylesheet.css')], { cwd: root, stdio: 'inherit' });
if (styles.status !== 0) throw new Error('Unable to compile the hello-world stylesheet.');
const styles = spawnSync('npx', ['sass', '--no-source-map', stylesheetSource, resolve(output, 'stylesheet.css')], { cwd: root, stdio: 'inherit' });
if (styles.status !== 0) throw new Error('Unable to compile the hello-world stylesheet.');
await cp(runtimeSource, resolve(output, 'lib/runtime'), { recursive: true });

const extension = await readFile(exampleSource, 'utf8');
const runtimeImport = '../../runtime/src/index.js';
if (!extension.includes(runtimeImport)) {
  throw new Error('The compiled example runtime import did not match the expected source path.');
}
await writeFile(
  resolve(output, 'extension.js'),
  extension.replace(runtimeImport, './lib/runtime/index.js'),
  'utf8',
);
await cp(generatedTemplate, resolve(output, 'template.js'));
await cp(generatedPreferencesTemplate, resolve(output, 'preferences-template.js'));
const preferences = await readFile(preferencesSource, 'utf8');
const preferencesRuntimeImport = '../../runtime/src/index.js';
if (!preferences.includes(preferencesRuntimeImport)) throw new Error('The compiled preferences runtime import did not match the expected source path.');
await writeFile(resolve(output, 'prefs.js'), preferences.replace(preferencesRuntimeImport, './lib/runtime/index.js'), 'utf8');
await cp(generatedPreferencesTemplate, resolve(output, 'preferences-template.js'));
const preferences = await readFile(preferencesSource, 'utf8');
const preferencesRuntimeImport = '../../runtime/src/index.js';
if (!preferences.includes(preferencesRuntimeImport)) throw new Error('The compiled preferences runtime import did not match the expected source path.');
await writeFile(resolve(output, 'prefs.js'), preferences.replace(preferencesRuntimeImport, './lib/runtime/index.js'), 'utf8');
await cp(metadataSource, resolve(output, 'metadata.json'));
process.stdout.write(`Staged GNOME Shell extension: ${output}\n`);
