import assert from 'node:assert/strict';
import Gtk from 'gi:Gtk-4.0';
import {
  createGtkRenderHost,
  mountGtplTemplate,
  Router,
} from '../../dist/runtime/src/index.js';
import overview from '../../dist/examples/kitchen-sink/demos/overview.js';
import actions from '../../dist/examples/kitchen-sink/demos/actions.js';
import forms from '../../dist/examples/kitchen-sink/demos/forms.js';
import preferences from '../../dist/examples/kitchen-sink/demos/preferences.js';
import layouts from '../../dist/examples/kitchen-sink/demos/layouts.js';
import { createKitchenSinkComponents } from '../../dist/examples/kitchen-sink/components.js';

Gtk.init();
const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const demos = [overview, actions, forms, preferences, layouts];
const demoIds = ['overview', 'actions', 'forms', 'preferences', 'layouts'];
const components = createKitchenSinkComponents();
const views = demos.map((render) => mountGtplTemplate(
  {}, render, host, undefined, undefined, undefined, components,
));
assert.equal(views.length, 5);
const router = new Router(demoIds.map((id, index) => ({
  path: `/${id}`,
  render: () => views[index].node,
})), '/overview');
assert.equal(router.currentRoute?.config.path, '/overview');
assert.equal(router.navigate('/forms'), true);
assert.equal(router.currentRoute?.config.path, '/forms');
assert.equal(router.back(), true);
assert.equal(router.currentRoute?.config.path, '/overview');
for (const view of views) {
  assert.ok(view.node, 'Each demo must mount a native GTK widget tree.');
  view.dispose();
}
process.stdout.write('All five Node-GTK Kitchen Sink demo screens mounted successfully.\n');
