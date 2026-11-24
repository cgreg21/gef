import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import Gtk from 'gi:Gtk-4.0';
import { runCli } from '../../dist/cli/src/index.js';
import { createGtkRenderHost, Injector, mountDecoratedComponent } from '../../dist/runtime/src/index.js';

const root = await mkdtemp(join(tmpdir(), 'gef-generated-app-'));
const project = join(root, 'generated-app');
const repository = process.cwd();

try {
  assert.equal(await runCli(['new', 'generated-app', project, '--type', 'application']), 0);

  await mkdir(join(project, 'node_modules'), { recursive: true });
  await symlink(repository, join(project, 'node_modules', 'gnome-extension-framework'), 'junction');

  const template = join(project, 'src/app/app.component.gtpl');
  const compiled = join(project, 'src/app/app.component.view.js');
  assert.equal(await runCli(['compile', template, compiled]), 0);

  const typecheck = spawnSync(process.execPath, [
    resolve(repository, 'node_modules/typescript/bin/tsc'),
    '-p',
    'tsconfig.json',
  ], { cwd: project, encoding: 'utf8' });
  assert.equal(typecheck.status, 0, typecheck.stdout + typecheck.stderr);

  Gtk.init();
  const [{ default: AppComponent }, { default: renderApp }] = await Promise.all([
    import(pathToFileURL(join(project, 'dist/app/app.component.js')).href),
    import(pathToFileURL(join(project, 'dist/app/app.component.view.js')).href),
  ]);
  const injector = new Injector();
  const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
  const component = mountDecoratedComponent(AppComponent, renderApp, injector, host);

  try {
    assert.equal(component.view.node.get_label(), 'Hello from GEF and node-gtk!');
    assert.equal(component.instance.title, 'GeneratedApp');
  } finally {
    component.destroy();
    injector.destroy();
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write('Generated application Node-GTK runtime smoke test passed.\\n');
