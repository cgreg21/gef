import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
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
    assert.equal(component.view.node.label, 'Hello from GEF and node-gtk!');
    assert.equal(component.instance.title, 'GeneratedApp');
  } finally {
    component.destroy();
    injector.destroy();
  }

  const application = spawn(process.execPath, [
    '--import', 'node-gtk/register', 'dist/main.js',
  ], {
    cwd: project,
    env: { ...process.env, GTK_A11Y: 'none' },
    stdio: 'ignore',
  });
  const closed = new Promise((resolveClose) => {
    application.once('close', (code, signal) => resolveClose({ code, signal }));
  });
  const deadline = Date.now() + 15000;
  let windowId = '';

  try {
    while (Date.now() < deadline) {
      if (application.exitCode !== null || application.signalCode !== null) break;
      const search = spawnSync('xdotool', ['search', '--onlyvisible', '--name', 'generated-app'], {
        encoding: 'utf8',
      });
      windowId = search.status === 0 ? search.stdout.trim().split(/\s+/)[0] ?? '' : '';
      if (windowId) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }

    assert.ok(windowId, 'Generated application entry point did not present its GTK window.');
    application.kill('SIGTERM');
    const result = await Promise.race([
      closed,
      new Promise((resolveDelay) => setTimeout(() => resolveDelay(null), 5000)),
    ]);
    assert.ok(result, 'Generated application did not stop after the smoke test signal.');
    assert.equal(result.signal, 'SIGTERM');
  } finally {
    if (application.exitCode === null && application.signalCode === null) application.kill('SIGKILL');
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write('Generated application Node-GTK runtime smoke test passed.\n');
