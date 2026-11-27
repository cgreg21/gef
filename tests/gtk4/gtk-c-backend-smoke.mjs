import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileGtplToUiIr, emitGtkC } from '../../dist/compiler/src/index.js';

const ir = compileGtplToUiIr(`
  <GtkBox orientation="vertical" spacing="8" marginTop="12" halign="center">
    <GtkLabel label="GEF native C smoke test" marginStart="4" />
    <GtkButton label="Compile" visible="true" (clicked)="this.save()" />
    <GtkEntry text="Ada" placeholderText="Name" editable="false" />
    <GtkCheckButton label="Enabled" active="true" />
  </GtkBox>
`);
assert.equal(ir.success, true, 'The GTK template must compile to UI IR.');

const generated = emitGtkC(ir.nodes, { callbacks: { save: 'gef_on_save' } });
assert.equal(generated.success, true, generated.diagnostics.join('\n'));

const directory = await mkdtemp(join(tmpdir(), 'gef-gtk-c-'));
try {
  const sourcePath = join(directory, 'main.c');
  const callbackPath = join(directory, 'callbacks.c');
  const binaryPath = join(directory, 'gef-generated');
  await writeFile(sourcePath, generated.source, 'utf8');
  await writeFile(callbackPath, [
    '#include <gtk/gtk.h>',
    'void gef_on_save(GtkButton *button, gpointer user_data) {',
    '  (void) button;',
    '  (void) user_data;',
    '}',
    '',
  ].join('\\n'), 'utf8');

  const pkgConfig = spawnSync('pkg-config', ['--cflags', '--libs', 'gtk4'], { encoding: 'utf8' });
  if (pkgConfig.error || pkgConfig.status !== 0) {
    throw new Error(pkgConfig.error?.message ?? pkgConfig.stderr ?? 'pkg-config could not resolve GTK4.');
  }

  const flags = pkgConfig.stdout.trim().split(/\s+/).filter(Boolean);
  const compilation = spawnSync(process.env.CC || 'cc', [
    '-std=gnu11', sourcePath, callbackPath, '-o', binaryPath, ...flags,
  ], { encoding: 'utf8' });
  if (compilation.error || compilation.status !== 0) {
    throw new Error(compilation.error?.message ?? compilation.stderr ?? 'The generated GTK4 C source did not compile.');
  }

  const binary = await readFile(binaryPath);
  const symbols = spawnSync('nm', ['-g', binaryPath], { encoding: 'utf8' });
  if (symbols.error || symbols.status !== 0) {
    throw new Error(symbols.error?.message ?? symbols.stderr ?? 'Could not inspect linked GTK4 executable symbols.');
  }
  assert.match(symbols.stdout, /\\bT gef_on_save\\b/, 'The native callback implementation must be linked into the executable.');
  assert.deepEqual([...binary.subarray(0, 4)], [0x7f, 0x45, 0x4c, 0x46], 'The output must be an ELF executable.');
  process.stdout.write('GTK4 C backend linked a native button callback into a valid ELF executable.\n');
} finally {
  await rm(directory, { recursive: true, force: true });
}
