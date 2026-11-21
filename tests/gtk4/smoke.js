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
const view = mountGtplTemplate({}, (_context, runtime) => runtime.element(
  'GtkBox',
  {},
  runtime.element('GtkLabel', { label: runtime.bind(() => state.get()) }, undefined),
), host);
const label = view.node.get_first_child();
if (label.get_label() !== 'GEF GTK4 smoke test') {
  throw new Error('GTK4 host did not create the expected native label.');
}
state.set('GEF reactive GTK4 update');
if (label.get_label() !== 'GEF reactive GTK4 update') {
  throw new Error('GTK4 reactive property binding did not update.');
}
view.dispose();

const preferencesPage = host.element('AdwPreferencesPage', {}, undefined);
if (!preferencesPage) throw new Error('libadwaita preferences page was not created.');
host.destroy(preferencesPage);

print('GEF GTK4/libadwaita runtime smoke tests passed.');
