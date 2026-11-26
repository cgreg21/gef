import GLib from 'gi://GLib';
import { ResourceScope, signal } from '../../dist/runtime/src/index.js';

export function runLifecycleSmokeTest() {
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const scope = new ResourceScope();
    const handlers = new Map();
    let nextSignalId = 0;
    const actor = {
      connect(_name, callback) {
        const id = ++nextSignalId;
        handlers.set(id, callback);
        return id;
      },
      disconnect(id) {
        handlers.delete(id);
      },
      destroy() {
        for (const callback of handlers.values()) callback();
      },
    };
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

  const value = signal('before');
  let rendered = value.get();
  const scope = new ResourceScope();
  scope.add(value.subscribe(next => rendered = next));
  value.set('during');
  if (rendered !== 'during') throw new Error('GJS lifecycle fixture did not observe a signal update.');
  scope.dispose();
  value.set('after');
  if (rendered !== 'during') throw new Error('GJS lifecycle fixture retained a signal subscription after disposal.');

  print('GJS resource-scope and reactive lifecycle cleanup fixtures passed.');
}
