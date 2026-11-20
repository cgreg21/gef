import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist/extension');
const runtimeSource = resolve(root, 'dist/runtime/src');
const exampleSource = resolve(root, 'dist/examples/hello-world/extension.js');
const metadataSource = resolve(root, 'packages/examples/hello-world/metadata.json');

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
await cp(metadataSource, resolve(output, 'metadata.json'));
process.stdout.write(`Staged GNOME Shell extension: ${output}\n`);
