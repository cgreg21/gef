import GLib from 'gi://GLib';
import St from 'gi://St';
import { createStRenderHost, ResourceScope, signal } from '../../dist/runtime/src/index.js';

export function runLifecycleSmokeTest() {
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

  const host = createStRenderHost(St);
  let clicked = 0;
  const button = host.element('StButton', { clicked: () => clicked += 1 }, undefined);
  button.emit('clicked');
  if (clicked !== 1) throw new Error('St host did not connect the button signal.');
  host.destroy(button);
  button.emit('clicked');
  if (clicked !== 1) throw new Error('St host retained a signal handler after actor destruction.');

  const value = signal('before');
  const label = host.text({ kind: 'binding', get: () => value.get() });
  value.set('during');
  if (label.get_text() !== 'during') throw new Error('St host did not update a bound label.');
  host.destroy(label);
  value.set('after');
  if (label.get_text() !== 'during') throw new Error('St host retained a reactive effect after actor destruction.');

  print('GNOME Shell 51 resource-scope and St host lifecycle cleanup fixtures passed.');
}
