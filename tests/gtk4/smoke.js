import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {
  bindGSettingsBoolean,
  createGtkRenderHost,
  mountGtplTemplate,
  signal,
} from '../../dist/runtime/src/index.js';
import renderTwoWay from '../../dist/two-way.js';

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

for (const name of [
  'GtkCheckButton', 'GtkDropDown', 'GtkSpinButton', 'GtkProgressBar',
  'GtkSeparator', 'GtkListBox', 'GtkListBoxRow', 'GtkGrid', 'GtkStack',
  'GtkRevealer', 'GtkTextView', 'GtkPasswordEntry', 'GtkSearchEntry',
]) {
  host.destroy(host.element(name, {}, undefined));
}

const preferencesPage = host.element('AdwPreferencesPage', {}, undefined);
if (!preferencesPage) throw new Error('libadwaita preferences page was not created.');
host.destroy(preferencesPage);

const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
  'dist/extension/schemas',
  Gio.SettingsSchemaSource.get_default(),
  false,
);
const schema = schemaSource.lookup('org.gnome.shell.extensions.gef-hello-world', false);
if (!schema) throw new Error('Compiled GSettings schema was not staged.');
const settings = Gio.Settings.new_full(schema, null, null);
const enabled = bindGSettingsBoolean(settings, 'enabled');
settings.set_boolean('enabled', false);
if (enabled.get() !== false) throw new Error('GSettings changes did not update the reactive signal.');
enabled.set(true);
if (!settings.get_boolean('enabled')) throw new Error('Reactive signal writes did not persist to GSettings.');
enabled.dispose();

print('GEF GTK4/libadwaita and GSettings runtime smoke tests passed.');
