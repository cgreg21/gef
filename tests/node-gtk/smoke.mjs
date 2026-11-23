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
const root = host.fragment([button, toggle, icon, progress, dropdown, gefSwitch]);
let clicks = 0;
let active;

assert.equal(label.label, 'before');
assert.equal(label.useUnderline, true);
assert.equal(icon.iconName, 'document-save-symbolic');
assert.equal(progress.fraction, 0.25);
assert.equal(dropdown.model.get_n_items(), 3);
assert.equal(dropdown.selected, 1);
dropdown.selected = 2;
assert.equal(selectedEvent, 'Blue');
assert.equal(selectedValue.get(), 'Blue');
selectOptions.set(['Blue', 'Green']);
assert.equal(dropdown.model.get_n_items(), 2);
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

process.stdout.write('Node-GTK renderer smoke test passed.\n');
