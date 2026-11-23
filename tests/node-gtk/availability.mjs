import assert from 'node:assert/strict';
import Gtk from 'gi:Gtk-4.0';

const requiredWidgets = [
  'Window',
  'Box',
  'Grid',
  'HeaderBar',
  'Label',
  'Button',
  'Entry',
  'SearchEntry',
  'PasswordEntry',
  'CheckButton',
  'Switch',
  'SpinButton',
  'ProgressBar',
  'Separator',
];

for (const name of requiredWidgets) {
  assert.equal(typeof Gtk[name], 'function', `GTK4 widget Gtk.${name} is unavailable.`);
}

process.stdout.write('Node-GTK GTK4 bindings are available.\n');
