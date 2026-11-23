import assert from 'node:assert/strict';
import Gtk from 'gi:Gtk-4.0';
import { createGtplRenderRuntime, createGtkRenderHost, mountGtplTemplate, signal } from '../../dist/runtime/src/index.js';
import renderSmoke from '../../dist/node-gtk-view.js';

Gtk.init();

const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const compiledView = mountGtplTemplate({}, renderSmoke, host);
assert.equal(compiledView.node.label, 'Hello from compiled GTPL and Node-GTK!');
compiledView.dispose();

const runtime = createGtplRenderRuntime(host);
const title = signal('before');
const iconName = signal('document-save-symbolic');
const label = host.element('GtkLabel', {
  label: runtime.bind(() => title.get()),
  'use-underline': true,
}, undefined);
const icon = host.element('GtkImage', {
  'icon-name': runtime.bind(() => iconName.get()),
}, undefined);
const button = host.element('GtkButton', {
  clicked: () => { clicks += 1; },
}, label);
const toggle = host.element('GtkSwitch', {
  active: false,
  activeChange: (value) => { active = value; },
}, undefined);
const root = host.fragment([button, toggle, icon]);
let clicks = 0;
let active;

assert.equal(label.label, 'before');
assert.equal(label.useUnderline, true);
assert.equal(icon.iconName, 'document-save-symbolic');
button.emit('clicked');
toggle.active = true;
title.set('after');
iconName.set('document-open-symbolic');
assert.equal(clicks, 1);
assert.equal(active, true);
assert.equal(label.label, 'after');
assert.equal(icon.iconName, 'document-open-symbolic');

host.destroy(root);
button.emit('clicked');
title.set('ignored');
iconName.set('ignored');
assert.equal(clicks, 1);
assert.equal(label.label, 'after');
assert.equal(icon.iconName, 'document-open-symbolic');

process.stdout.write('Node-GTK renderer smoke test passed.\n');
