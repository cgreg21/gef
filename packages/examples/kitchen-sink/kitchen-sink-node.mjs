import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Gtk from 'gi:Gtk-4.0';
import GLib from 'gi:GLib-2.0';
import {
  createGtkRenderHost,
  mountGtplTemplate,
} from '../../../dist/runtime/src/index.js';
import overview from '../../../dist/examples/kitchen-sink/demos/overview.js';
import actions from '../../../dist/examples/kitchen-sink/demos/actions.js';
import forms from '../../../dist/examples/kitchen-sink/demos/forms.js';
import preferences from '../../../dist/examples/kitchen-sink/demos/preferences.js';
import layouts from '../../../dist/examples/kitchen-sink/demos/layouts.js';

Gtk.init();

const demos = [
  { id: 'overview', title: 'Overview', source: './demos/overview.gtpl', render: overview },
  { id: 'actions', title: 'Actions', source: './demos/actions.gtpl', render: actions },
  { id: 'forms', title: 'Forms', source: './demos/forms.gtpl', render: forms },
  { id: 'preferences', title: 'Preferences', source: './demos/preferences.gtpl', render: preferences },
  { id: 'layouts', title: 'Layouts', source: './demos/layouts.gtpl', render: layouts },
];

const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const views = new Map(demos.map((demo) => [
  demo.id,
  mountGtplTemplate({}, demo.render, host),
]));
const loop = GLib.MainLoop.new(null, false);
const window = new Gtk.Window({
  title: 'GEF Kitchen Sink',
  defaultWidth: 1180,
  defaultHeight: 820,
});

const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 });
const title = new Gtk.Label({ label: 'GEF Kitchen Sink', xalign: 0, hexpand: true });
const sourceButton = new Gtk.Button({ label: 'View source' });
header.append(title);
header.append(sourceButton);
root.append(header);

const body = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 });
const navigation = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 });
navigation.setSizeRequest(210, -1);
const stack = new Gtk.Stack();
stack.setHexpand(true);
stack.setVexpand(true);
stack.setTransitionType(Gtk.StackTransitionType.CROSSFADE);
for (const demo of demos) stack.addNamed(views.get(demo.id).node, demo.id);
body.append(navigation);
body.append(stack);
root.append(body);
window.setChild(root);

let selectedDemo = demos[0];
function selectDemo(demo) {
  selectedDemo = demo;
  stack.setVisibleChildName(demo.id);
  title.setLabel(demo.title);
}
for (const demo of demos) {
  const button = new Gtk.Button({ label: demo.title });
  button.setHexpand(true);
  button.on('clicked', () => selectDemo(demo));
  navigation.append(button);
}

sourceButton.on('clicked', () => {
  const source = readFileSync(fileURLToPath(new URL(selectedDemo.source, import.meta.url)), 'utf8');
  const sourceWindow = new Gtk.Window({
    title: `GTPL source — ${selectedDemo.title}`,
    transientFor: window,
    modal: true,
    defaultWidth: 760,
    defaultHeight: 620,
  });
  const scroll = new Gtk.ScrolledWindow();
  const code = new Gtk.Label({
    label: source,
    xalign: 0,
    yalign: 0,
    selectable: true,
    wrap: false,
    marginTop: 16,
    marginBottom: 16,
    marginStart: 16,
    marginEnd: 16,
  });
  scroll.setChild(code);
  sourceWindow.setChild(scroll);
  sourceWindow.present();
});

selectDemo(selectedDemo);
window.on('close-request', () => {
  for (const view of views.values()) view.dispose();
  loop.quit();
  return false;
});
window.present();
loop.run();
