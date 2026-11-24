import assert from 'node:assert/strict';
import Gtk from 'gi:Gtk-4.0';
import { createGtkRenderHost, mountGtplTemplate } from '../../dist/runtime/src/index.js';
import renderKitchenSink from '../../dist/examples/kitchen-sink/template.js';

Gtk.init();

const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const view = mountGtplTemplate({}, renderKitchenSink, host);

assert.ok(view.node, 'Kitchen Sink template should mount a GTK widget tree.');
assert.ok(view.node instanceof Gtk.Box, 'Kitchen Sink root should be a Gtk.Box.');

view.dispose();
process.stdout.write('Node-GTK Kitchen Sink widget smoke test passed.\n');
