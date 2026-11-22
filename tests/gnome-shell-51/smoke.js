import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import {
  Component,
  PipeRegistry,
  ResourceScope,
  createStRenderHost,
  getComponentMetadata,
  signal,
} from '../../dist/extension/lib/runtime/index.js';

Clutter.init(null);

for (let cycle = 0; cycle < 2; cycle += 1) {
  const scope = new ResourceScope();
  const actor = new St.Button({ label: `Lifecycle cycle ${cycle}` });
  let destroySignalCalls = 0;
  let timerCalls = 0;

  scope.add(() => actor.destroy());
  const signalId = actor.connect('destroy', () => destroySignalCalls += 1);
  scope.add(() => actor.disconnect(signalId));
  const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
    timerCalls += 1;
    return GLib.SOURCE_REMOVE;
  });
  scope.add(() => GLib.source_remove(timerId));

  scope.dispose();
  scope.dispose();

  const loop = GLib.MainLoop.new(null, false);
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
    loop.quit();
    return GLib.SOURCE_REMOVE;
  });
  loop.run();

  if (destroySignalCalls !== 0 || timerCalls !== 0 || !scope.disposed) {
    throw new Error(`GNOME lifecycle cleanup failed in cycle ${cycle}.`);
  }
}

const state = signal(1);
state.set(2);
if (state.get() !== 2) throw new Error('GJS runtime signal smoke test failed.');

const pipes = new PipeRegistry().register('upper', {
  transform: (value) => String(value).toUpperCase(),
});
if (pipes.transform('upper', 'gef') !== 'GEF') throw new Error('GJS pipe registry smoke test failed.');

class SmokeComponent {}
Component({ selector: 'GefSmoke', template: '<StLabel />' })(SmokeComponent);
if (getComponentMetadata(SmokeComponent)?.selector !== 'GefSmoke') {
  throw new Error('Runtime-safe component metadata smoke test failed.');
}

const host = createStRenderHost(St);
const label = host.element('StLabel', { text: 'GEF GNOME Shell 51 smoke test' }, undefined);
if (label.get_text() !== 'GEF GNOME Shell 51 smoke test') {
  throw new Error('St.Label did not preserve its text property.');
}
host.destroy(label);

for (const [selector, constructorName] of [
  ['StEntry', 'Entry'],
  ['StScrollView', 'ScrollView'],
  ['StFrame', 'Frame'],
  ['StSwitch', 'Switch'],
  ['StSlider', 'Slider'],
  ['StSpinner', 'Spinner'],
  ['StProgressBar', 'ProgressBar'],
  ['StCheckBox', 'CheckBox'],
  ['StComboBox', 'ComboBox'],
]) {
  if (St[constructorName]) host.destroy(host.element(selector, {}, undefined));
}

print('GEF runtime, GNOME Shell 51 St actor and lifecycle cleanup smoke tests passed.');
