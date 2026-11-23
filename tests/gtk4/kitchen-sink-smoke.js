import Gtk from 'gi://Gtk';
import {
  createGtkRenderHost,
  mountGtplTemplate,
} from '../../dist/runtime/src/index.js';
import renderKitchenSink from '../../dist/examples/kitchen-sink/template.js';

Gtk.init();

const host = createGtkRenderHost(Gtk);
const view = mountGtplTemplate({}, renderKitchenSink, host);

function containsWidget(root, Constructor) {
  if (root instanceof Constructor) return true;
  for (let child = root.get_first_child?.(); child; child = child.get_next_sibling?.()) {
    if (containsWidget(child, Constructor)) return true;
  }
  return false;
}

const expectedWidgets = [
  ['button', Gtk.Button],
  ['text entry', Gtk.Entry],
  ['search entry', Gtk.SearchEntry],
  ['password entry', Gtk.PasswordEntry],
  ['checkbox', Gtk.CheckButton],
  ['switch', Gtk.Switch],
  ['spin button', Gtk.SpinButton],
  ['progress bar', Gtk.ProgressBar],
  ['grid', Gtk.Grid],
  ['header bar', Gtk.HeaderBar],
];

try {
  for (const [name, Constructor] of expectedWidgets) {
    if (!containsWidget(view.node, Constructor)) {
      throw new Error(`Kitchen Sink did not render a native GTK ${name}.`);
    }
  }
  print('GEF Kitchen Sink GTK4 template smoke test passed.');
} finally {
  view.dispose();
}
