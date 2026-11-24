import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Gtk from 'gi:Gtk-4.0';
import GLib from 'gi:GLib-2.0';
import {
  createGtkRenderHost,
  mountGtplTemplate,
  type GtkActor,
  type GtplRenderFunction,
  type GtplRenderView,
} from '../../runtime/src/index.js';
import overview from './demos/overview.js';
import actions from './demos/actions.js';
import forms from './demos/forms.js';
import preferences from './demos/preferences.js';
import layouts from './demos/layouts.js';
import { createKitchenSinkComponents } from './components.js';

interface Demo {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly render: GtplRenderFunction<Record<string, never>, GtkActor>;
}

Gtk.init();

const demos: readonly Demo[] = [
  { id: 'overview', title: 'Overview', source: 'overview.gtpl', render: overview },
  { id: 'actions', title: 'Actions', source: 'actions.gtpl', render: actions },
  { id: 'forms', title: 'Forms', source: 'forms.gtpl', render: forms },
  { id: 'preferences', title: 'Preferences', source: 'preferences.gtpl', render: preferences },
  { id: 'layouts', title: 'Layouts', source: 'layouts.gtpl', render: layouts },
];

const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const components = createKitchenSinkComponents();
const views = new Map<string, GtplRenderView<GtkActor>>();
for (const demo of demos) {
  views.set(demo.id, mountGtplTemplate(
    {}, demo.render, host, undefined, undefined, undefined, components,
  ));
}

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

for (const demo of demos) {
  const view = views.get(demo.id);
  if (!view) throw new Error(`Missing mounted demo: ${demo.id}`);
  stack.addNamed(view.node, demo.id);
}

body.append(navigation);
body.append(stack);
root.append(body);
window.setChild(root);

const firstDemo = demos[0];
if (!firstDemo) throw new Error('Kitchen Sink requires at least one demo.');

let selectedDemo = firstDemo;

function selectDemo(demo: Demo): void {
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
  const sourcePath = resolve(
    process.cwd(),
    'packages/examples/kitchen-sink/demos',
    selectedDemo.source,
  );
  const source = readFileSync(sourcePath, 'utf8');
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

selectDemo(firstDemo);
window.on('close-request', () => {
  for (const view of views.values()) view.dispose();
  loop.quit();
  return false;
});

window.present();
loop.run();
