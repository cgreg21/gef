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

const compilation = spawnSync(process.execPath, [cliSource, 'compile', templateSource, generatedTemplate], {
  cwd: root,
  stdio: 'inherit',
});
if (compilation.status !== 0) throw new Error('Unable to compile the hello-world GTPL template.');

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'lib'), { recursive: true });
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
await cp(metadataSource, resolve(output, 'metadata.json'));
process.stdout.write(`Staged GNOME Shell extension: ${output}\n`);
