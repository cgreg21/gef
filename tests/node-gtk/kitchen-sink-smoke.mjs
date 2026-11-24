import assert from 'node:assert/strict';
import Gtk from 'gi:Gtk-4.0';
import {
  createGtkRenderHost,
  mountGtplTemplate,
} from '../../dist/runtime/src/index.js';
import overview from '../../dist/examples/kitchen-sink/demos/overview.js';
import actions from '../../dist/examples/kitchen-sink/demos/actions.js';
import forms from '../../dist/examples/kitchen-sink/demos/forms.js';
import preferences from '../../dist/examples/kitchen-sink/demos/preferences.js';
import layouts from '../../dist/examples/kitchen-sink/demos/layouts.js';

Gtk.init();
const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const demos = [overview, actions, forms, preferences, layouts];
const views = demos.map((render) => mountGtplTemplate({}, render, host));
assert.equal(views.length, 5);
for (const view of views) {
  assert.ok(view.node instanceof Gtk.Widget, 'Each demo must mount a native GTK widget tree.');
  view.dispose();
}
process.stdout.write('All five Node-GTK Kitchen Sink demo screens mounted successfully.\n');
