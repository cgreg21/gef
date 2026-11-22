import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {
  bindGSettingsBoolean,
  createGtkRenderHost,
  mountGtplTemplate,
  ResourceScope,
  loadGtkStylesheet,
  signal,
} from '../../dist/runtime/src/index.js';
import renderTwoWay from '../../dist/two-way.js';
import renderPreferences from '../../dist/examples/preferences/template.js';

Gtk.init();
Adw.init();

const [cssFd, cssPath] = GLib.file_open_tmp('gef-gtk-smoke-XXXXXX.css');
GLib.close(cssFd);
GLib.file_set_contents(cssPath, '.gef-smoke { color: red; }');
const styleScope = new ResourceScope();
const unloadStylesheet = loadGtkStylesheet(
  Gtk,
  Gdk.Display.get_default(),
  cssPath,
  Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
  styleScope,
);
styleScope.dispose();
styleScope.dispose();
unloadStylesheet();
Gio.File.new_for_path(cssPath).delete(null);

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

for (let cycle = 1; cycle <= 3; cycle += 1) {
  const preferencesScope = new ResourceScope();
  const cycleEnabled = bindGSettingsBoolean(settings, 'enabled', preferencesScope);
  const preferencesContext = Object.defineProperty({}, 'enabled', {
    enumerable: true,
    get: () => cycleEnabled.get(),
    set: (value) => cycleEnabled.set(Boolean(value)),
  });
  const preferencesHost = createGtkRenderHost(Gtk, {
    adw: Adw,
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
  });
  const preferencesView = mountGtplTemplate(preferencesContext, renderPreferences, preferencesHost);
  const preferencesWindow = new Adw.PreferencesWindow();
  preferencesWindow.add(preferencesView.node);
  let disposed = false;
  const disposeView = () => {
    if (disposed) return;
    disposed = true;
    preferencesView.dispose();
    preferencesScope.dispose();
  };
  const closeHandler = preferencesWindow.connect('close-request', () => {
    disposeView();
    return false;
  });

  preferencesWindow.present();
  if (!preferencesWindow.get_visible()) {
    throw new Error(`The libadwaita preferences window did not open in cycle ${cycle}.`);
  }
  const preferenceSwitch = findSwitch(preferencesView.node);
  if (!preferenceSwitch) {
    throw new Error('The compiled preferences template did not create its GTK switch.');
  }

  settings.set_boolean('enabled', false);
  if (preferenceSwitch.active) {
    throw new Error('GSettings did not update the compiled preferences template.');
  }
  preferenceSwitch.set_active(true);
  if (!settings.get_boolean('enabled')) {
    throw new Error('The compiled preferences template did not persist the switch change.');
  }

  preferencesWindow.close();
  preferencesWindow.disconnect(closeHandler);
  if (!disposed || preferencesView.node.get_parent() !== null) {
    throw new Error(`Closing preferences did not dispose and detach the view in cycle ${cycle}.`);
  }

  settings.set_boolean('enabled', false);
  preferenceSwitch.set_active(true);
  if (settings.get_boolean('enabled')) {
    throw new Error(`A destroyed preferences view still changed GSettings in cycle ${cycle}.`);
  }
  preferencesScope.dispose();
  preferencesWindow.destroy();
}

print('GEF GTK4/libadwaita and GSettings runtime smoke tests passed.');
