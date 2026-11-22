import GLib from 'gi://GLib';
import St from 'gi://St';
import { ResourceScope } from '../../dist/extension/lib/runtime/index.js';

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

  }

  print('GNOME Shell 51 lifecycle cleanup fixture passed.');
}
