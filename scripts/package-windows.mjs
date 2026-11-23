import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const bundle = manifest.bundle;
if (process.platform !== 'win32') throw new Error('Windows packages must be built on a native Windows host.');
if (!bundle?.name || !bundle?.id || !bundle?.entry) throw new Error('package.json bundle.name, bundle.id and bundle.entry are required.');

const architecture = process.arch;
if (!['x64', 'arm64'].includes(architecture)) throw new Error(`Unsupported Windows architecture: ${architecture}`);
const binding = resolve(root, 'node_modules/node-gtk/lib/binding', `node-v${process.versions.modules}-win32-${architecture}`);
await access(resolve(binding, 'node_gtk.node'));
await access(resolve(binding, 'girepository-1.0'));

const output = resolve(root, 'dist');
const name = `${bundle.name}-windows-${architecture}`;
const stage = resolve(output, name);
const app = resolve(stage, 'app');
const runtime = resolve(stage, 'runtime');
const executable = resolve(stage, `${bundle.name}.exe`);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status ?? 'unknown'}.`);
}

await rm(stage, { recursive: true, force: true });
await rm(resolve(output, `${name}.zip`), { force: true });
await mkdir(app, { recursive: true });
await mkdir(runtime, { recursive: true });
await mkdir(resolve(app, 'dist'), { recursive: true });

for (const entry of await readdir(output, { withFileTypes: true })) {
  if (entry.name === name || /\.(?:zip|dmg|appimage|tar\.gz|exe)$/i.test(entry.name) || entry.name.endsWith('.app')) continue;
  await cp(resolve(output, entry.name), resolve(app, 'dist', entry.name), { recursive: true, dereference: true });
}
await cp(resolve(root, 'node_modules'), resolve(app, 'node_modules'), { recursive: true, dereference: true });
try {
  await cp(resolve(root, 'assets'), resolve(app, 'assets'), { recursive: true, dereference: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await cp(resolve(root, 'package.json'), resolve(app, 'package.json'));
await cp(process.execPath, resolve(runtime, 'node.exe'));

const launcherProject = resolve(fileURLToPath(new URL('.', import.meta.url)), 'windows-launcher');
const launcherBuild = await mkdtemp(resolve(tmpdir(), 'gef-windows-launcher-'));
try {
  const launcherSource = (await readFile(resolve(launcherProject, 'Program.cs'), 'utf8'))
    .replace('"__ENTRY__"', JSON.stringify(bundle.entry.replaceAll('\\\\', '/')));
  await writeFile(resolve(launcherBuild, 'Program.cs'), launcherSource);
  await cp(resolve(launcherProject, 'Launcher.csproj'), resolve(launcherBuild, 'Launcher.csproj'));

  const runtimeIdentifier = architecture === 'arm64' ? 'win-arm64' : 'win-x64';
  run('dotnet', [
    'publish',
    resolve(launcherBuild, 'Launcher.csproj'),
    '--configuration', 'Release',
    '--runtime', runtimeIdentifier,
    '--self-contained', 'true',
    `-p:AssemblyName=${bundle.name}`,
    '-p:PublishSingleFile=true',
    '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:DebugType=None',
    '-p:DebugSymbols=false',
    '--output', stage,
  ]);
} finally {
  await rm(launcherBuild, { recursive: true, force: true });
}
await access(executable);

const archive = resolve(output, `${name}.zip`);
run('tar.exe', ['-a', '-c', '-f', archive, '-C', output, name]);
await access(archive);
process.stdout.write(`Created Windows executable: ${executable}\nCreated Windows package: ${archive}\n`);
