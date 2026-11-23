import assert from 'node:assert/strict';
import Gtk from 'gi:Gtk-4.0';
import { createGtplRenderRuntime, createGtkRenderHost, signal } from '../../dist/runtime/src/index.js';

Gtk.init();

const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const runtime = createGtplRenderRuntime(host);
const title = signal('before');
const label = host.element('GtkLabel', {
  label: runtime.bind(() => title.get()),
  'use-underline': true,
}, undefined);
const button = host.element('GtkButton', {
  clicked: () => { clicks += 1; },
}, label);
const toggle = host.element('GtkSwitch', {
  active: false,
  activeChange: (value) => { active = value; },
}, undefined);
const root = host.fragment([button, toggle]);
let clicks = 0;
let active;

assert.equal(label.label, 'before');
assert.equal(label.useUnderline, true);
button.emit('clicked');
toggle.active = true;
title.set('after');
assert.equal(clicks, 1);
assert.equal(active, true);
assert.equal(label.label, 'after');

host.destroy(root);
button.emit('clicked');
title.set('ignored');
assert.equal(clicks, 1);
assert.equal(label.label, 'after');

process.stdout.write('Node-GTK renderer smoke test passed.\\n');
