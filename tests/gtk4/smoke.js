import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import {
  createGtkRenderHost,
  mountGtplTemplate,
  signal,
} from '../../dist/runtime/src/index.js';

Gtk.init();
Adw.init();

const state = signal('GEF GTK4 smoke test');
const host = createGtkRenderHost(Gtk, { adw: Adw, orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
const render = (_context, runtime) => runtime.element('AdwPreferencesPage', {}, runtime.element(
  'AdwPreferencesGroup',
  { title: 'GEF runtime' },
  runtime.element('GtkLabel', { label: runtime.bind(() => state.get()) }, undefined),
));
const view = mountGtplTemplate({}, render, host);
const group = view.node.get_first_child();
const label = group.get_first_child();
if (label.get_label() !== 'GEF GTK4 smoke test') {
  throw new Error('GTK4 host did not create the expected native label.');
}
state.set('GEF reactive GTK4 update');
if (label.get_label() !== 'GEF reactive GTK4 update') {
  throw new Error('GTK4 reactive property binding did not update.');
}
view.dispose();
print('GEF GTK4/libadwaita runtime smoke tests passed.');
