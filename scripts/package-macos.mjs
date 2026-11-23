import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const bundle = manifest.bundle;
if (process.platform !== 'darwin') throw new Error('macOS packages must be built on a native macOS host.');
if (!bundle?.name || !bundle?.id || !bundle?.entry) throw new Error('package.json bundle.name, bundle.id and bundle.entry are required.');

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout.trim();
}

const output = resolve(root, 'dist');
const architecture = process.arch;
const base = `${bundle.name}-macos-${architecture}`;
const app = resolve(output, `${bundle.name}.app`);
const contents = resolve(app, 'Contents');
const macOS = resolve(contents, 'MacOS');
const resources = resolve(contents, 'Resources');
const appRoot = resolve(resources, 'app');
const frameworks = resolve(contents, 'Frameworks');
const runtimeLib = resolve(frameworks, 'lib');
const runtime = resolve(resources, 'runtime');
const shareRoot = resolve(runtime, 'share');
const typelibRoot = resolve(resources, 'girepository-1.0');
const dmg = resolve(output, `${base}.dmg`);

await rm(app, { recursive: true, force: true });
await rm(dmg, { force: true });
for (const path of [macOS, runtime, appRoot, runtimeLib, shareRoot, typelibRoot]) await mkdir(path, { recursive: true });

await mkdir(resolve(appRoot, 'dist'), { recursive: true });
for (const entry of await readdir(output, { withFileTypes: true })) {
  if (entry.name === `${bundle.name}.app` || /\\.(?:zip|dmg|appimage|tar\\.gz)$/i.test(entry.name) || entry.name.endsWith('.app')) continue;
  await cp(resolve(output, entry.name), resolve(appRoot, 'dist', entry.name), { recursive: true, dereference: true });
}
await cp(resolve(root, 'node_modules'), resolve(appRoot, 'node_modules'), { recursive: true, dereference: true });
await cp(resolve(root, 'package.json'), resolve(appRoot, 'package.json'));
await cp(process.execPath, resolve(runtime, 'node'));

const formulaOutput = run('brew', ['deps', '--installed', '--formula', 'gtk4', 'libadwaita', 'adwaita-icon-theme']);
const formulas = new Set(['gtk4', 'libadwaita', 'adwaita-icon-theme', ...formulaOutput.split(/\s+/).filter(Boolean)]);
for (const formula of formulas) {
  const prefix = run('brew', ['--prefix', formula]);
  for (const directory of ['lib']) {
    try { await access(resolve(prefix, directory)); }
    catch { continue; }
    for (const entry of await readdir(resolve(prefix, directory))) {
      await cp(resolve(prefix, directory, entry), resolve(runtimeLib, entry), { recursive: true, dereference: true, force: true });
    }
  }
  for (const directory of ['share/glib-2.0', 'share/icons', 'share/themes', 'share/gtk-4.0', 'etc/gtk-4.0']) {
    try { await access(resolve(prefix, directory)); }
    catch { continue; }
    await cp(resolve(prefix, directory), resolve(shareRoot, directory.replace(/^share\//, '').replace(/^etc\//, 'etc/')), { recursive: true, dereference: true, force: true });
  }
}
const typelibDir = run('pkg-config', ['--variable=typelibdir', 'gobject-introspection-1.0']);
await cp(typelibDir, typelibRoot, { recursive: true, dereference: true, force: true });
const dylibs = await readdir(runtimeLib, { recursive: true });
const copiedLibraryCount = dylibs.filter((path) => String(path).endsWith('.dylib')).length;
if (copiedLibraryCount === 0) throw new Error('No Homebrew GTK dylibs were copied; refusing to create a non-portable app.');
await access(resolve(runtimeLib, 'libgtk-4.1.dylib')).catch(() => {
  if (!dylibs.some((path) => String(path).includes('libgtk-4'))) throw new Error('GTK4 dylib is missing from the application bundle.');
});

const launcher = [
  '#!/bin/sh',
  'HERE="$(cd "$(dirname "$0")" && pwd)"',
  'CONTENTS="$(cd "$HERE/.." && pwd)"',
  'RES="$CONTENTS/Resources"',
  'export DYLD_LIBRARY_PATH="$CONTENTS/Frameworks/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"',
  'export DYLD_FALLBACK_LIBRARY_PATH="$CONTENTS/Frameworks/lib${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"',
  'export GI_TYPELIB_PATH="$RES/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"',
  'export XDG_DATA_DIRS="$RES/runtime/share${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}"',
  'export GSETTINGS_SCHEMA_DIR="$RES/runtime/share/glib-2.0/schemas"',
  'cd "$RES/app"',
  `exec "$RES/runtime/node" --import node-gtk/register "${bundle.entry}" "$@"`,
  '',
].join('\n');
await writeFile(resolve(macOS, bundle.name), launcher, { mode: 0o755 });

const icon = bundle.icon ? resolve(root, bundle.icon) : undefined;
if (icon && extname(icon).toLowerCase() === '.icns') await cp(icon, resolve(resources, 'AppIcon.icns'));
const plist = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
  '<plist version="1.0"><dict>',
  `<key>CFBundleName</key><string>${bundle.name}</string>`,
  `<key>CFBundleDisplayName</key><string>${bundle.name}</string>`,
  `<key>CFBundleIdentifier</key><string>${bundle.id}</string>`,
  `<key>CFBundleVersion</key><string>${manifest.version}</string>`,
  '<key>CFBundlePackageType</key><string>APPL</string>',
  `<key>CFBundleExecutable</key><string>${bundle.name}</string>`,
  ...(icon && extname(icon).toLowerCase() === '.icns' ? ['<key>CFBundleIconFile</key><string>AppIcon</string>'] : []),
  '</dict></plist>',
  '',
].join('');
await writeFile(resolve(contents, 'Info.plist'), plist);
run('codesign', ['--force', '--deep', '--sign', '-', app]);
run('hdiutil', ['create', '-volname', bundle.name, '-srcfolder', app, '-ov', '-format', 'UDZO', dmg]);
await access(dmg);
process.stdout.write(`Created macOS package: ${dmg} (unsigned for public distribution; ad-hoc signed)\n`);
