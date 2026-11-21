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
import renderPreferences from '../../dist/examples/preferences/template.js';

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
const switchRow = host.element('AdwSwitchRow', {
  title: 'Enable GEF',
  active: { kind: 'binding', get: () => enabled.get() },
  activeChange: (value) => enabled.set(value),
}, undefined);
const group = host.element('AdwPreferencesGroup', {}, switchRow);
const preferences = host.element('AdwPreferencesPage', {}, group);

settings.set_boolean('enabled', false);
if (enabled.get() !== false || switchRow.active) {
  throw new Error('GSettings changes did not update the preferences switch.');
}
switchRow.set_active(true);
if (!settings.get_boolean('enabled')) {
  throw new Error('Preferences switch changes did not persist to GSettings.');
}
host.destroy(preferences);

const preferencesContext = Object.defineProperty({}, 'enabled', {
  enumerable: true,
  get: () => enabled.get(),
  set: (value) => enabled.set(Boolean(value)),
});
const preferencesHost = createGtkRenderHost(Gtk, { adw: Adw, orientation: Gtk.Orientation.VERTICAL, spacing: 12 });
const preferencesView = mountGtplTemplate(preferencesContext, renderPreferences, preferencesHost);
function findSwitch(widget) {
  if (widget instanceof Gtk.Switch) return widget;
  for (let child = widget.get_first_child?.(); child; child = child.get_next_sibling?.()) {
    const match = findSwitch(child);
    if (match) return match;
  }
  return undefined;
}
const preferenceSwitch = findSwitch(preferencesView.node);
if (!preferenceSwitch) throw new Error('The compiled preferences template did not create its GTK switch.');
settings.set_boolean('enabled', false);
if (preferenceSwitch.active) throw new Error('GSettings did not update the compiled preferences template.');
preferenceSwitch.set_active(true);
if (!settings.get_boolean('enabled')) throw new Error('The compiled preferences template did not persist the switch change.');
preferencesView.dispose();
enabled.dispose();

print('GEF GTK4/libadwaita and GSettings runtime smoke tests passed.');
