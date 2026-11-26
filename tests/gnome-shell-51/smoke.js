import {
  Component,
  PipeRegistry,
  getComponentMetadata,
  signal,
} from '../../dist/runtime/src/index.js';
import { runLifecycleSmokeTest } from './lifecycle.js';

runLifecycleSmokeTest();

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

print('GEF runtime metadata, signals and pipe registry smoke tests passed.');
