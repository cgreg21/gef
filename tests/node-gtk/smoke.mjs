import assert from 'node:assert/strict';
import Gtk from 'gi:Gtk-4.0';
import { createGtplRenderRuntime, createGtkRenderHost, Injector, mountGtplTemplate, signal } from '../../dist/runtime/src/index.js';
import { createGtkUiRegistry } from '../../dist/ui/src/index.js';
import renderSmoke from '../../dist/node-gtk-view.js';

Gtk.init();

const host = createGtkRenderHost(Gtk, { api: 'node-gtk' });
const compiledView = mountGtplTemplate({}, renderSmoke, host);
assert.equal(compiledView.node.label, 'Hello from compiled GTPL and Node-GTK!');
compiledView.dispose();

const runtime = createGtplRenderRuntime(host);
const title = signal('before');
const iconName = signal('document-save-symbolic');
const fraction = signal(0.25);
const selectOptions = signal(['Red', 'Green', 'Blue']);
const selectedValue = signal('Green');
const areaValue = signal('first line\nsecond line');
const passwordValue = signal('secret');
let passwordEvent = '';
let areaEvent = '';
let selectedEvent = '';
const label = host.element('GtkLabel', {
  label: runtime.bind(() => title.get()),
  'use-underline': true,
}, undefined);
const icon = host.element('GtkImage', {
  'icon-name': runtime.bind(() => iconName.get()),
}, undefined);
const dropdown = host.element('GtkDropDown', {
  options: runtime.bind(() => selectOptions.get()),
  value: runtime.bind(() => selectedValue.get()),
  valueChange: (value) => { selectedEvent = value; selectedValue.set(value); },
}, undefined);
const progress = host.element('GtkProgressBar', {
  fraction: runtime.bind(() => fraction.get()),
}, undefined);
const passwordEntry = host.element('GtkPasswordEntry', {
  'show-peek-icon': true,
  text: runtime.bind(() => passwordValue.get()),
  textChange: (value) => { passwordEvent = value; passwordValue.set(value); },
}, undefined);
const textArea = host.element('GtkTextView', {
  text: runtime.bind(() => areaValue.get()),
  textChange: (value) => { areaEvent = value; areaValue.set(value); },
}, undefined);
let clicks = 0;
let active;
const button = host.element('GtkButton', {
  clicked: () => { clicks += 1; },
}, label);
const toggle = host.element('GtkSwitch', {
  active: false,
  activeChange: (value) => { active = value; },
}, undefined);
const componentRuntime = createGtplRenderRuntime(host, undefined, undefined, new Injector(), createGtkUiRegistry());
const switchState = signal(false);
const gefSwitch = componentRuntime.element('GefSwitch', {
  active: componentRuntime.bind(() => switchState.get()),
  activeChange: (value) => switchState.set(value),
}, undefined);
const root = host.fragment([button, toggle, icon, progress, dropdown, gefSwitch, textArea, passwordEntry]);

assert.equal(label.label, 'before');
assert.equal(label.useUnderline, true);
assert.equal(icon.iconName, 'document-save-symbolic');
assert.equal(progress.fraction, 0.25);
assert.equal(textArea.buffer.text, 'first line\nsecond line');
assert.equal(passwordEntry.text, 'secret');
passwordEntry.setText('typed secret');
assert.equal(passwordEvent, 'typed secret');
assert.equal(passwordValue.get(), 'typed secret');
passwordValue.set('updated secret');
assert.equal(passwordEntry.text, 'updated secret');
textArea.buffer.setText('edited\nby Node-GTK', -1);
assert.equal(areaEvent, 'edited\nby Node-GTK');
assert.equal(areaValue.get(), 'edited\nby Node-GTK');
areaValue.set('external update');
assert.equal(textArea.buffer.text, 'external update');
assert.equal(dropdown.model.getItem(2).getString(), 'Blue');
assert.equal(dropdown.model.getItem(3), null);
assert.equal(dropdown.selected, 1);
dropdown.selected = 2;
assert.equal(selectedEvent, 'Blue');
assert.equal(selectedValue.get(), 'Blue');
selectOptions.set(['Blue', 'Green']);
assert.equal(dropdown.model.getItem(1).getString(), 'Green');
assert.equal(dropdown.model.getItem(2), null);
assert.equal(dropdown.selected, 0);
assert.equal(gefSwitch.active, false);
switchState.set(true);
assert.equal(gefSwitch.active, true);
button.emit('clicked');
toggle.active = true;
title.set('after');
iconName.set('document-open-symbolic');
fraction.set(0.75);
assert.equal(clicks, 1);
assert.equal(active, true);
assert.equal(label.label, 'after');
assert.equal(icon.iconName, 'document-open-symbolic');
assert.equal(progress.fraction, 0.75);
gefSwitch.active = false;
assert.equal(switchState.get(), false);

host.destroy(root);
button.emit('clicked');
title.set('ignored');
iconName.set('ignored');
switchState.set(false);
assert.equal(gefSwitch.active, false);
gefSwitch.active = true;
assert.equal(switchState.get(), false);
assert.equal(clicks, 1);
assert.equal(label.label, 'after');
assert.equal(icon.iconName, 'document-open-symbolic');
assert.equal(progress.fraction, 0.75);
assert.equal(textArea.buffer.text, 'external update');

process.stdout.write('Node-GTK renderer smoke test passed.\n');
