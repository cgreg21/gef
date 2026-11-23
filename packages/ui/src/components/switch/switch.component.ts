import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefSwitch {
  readonly #active = signal(false);
  readonly activeChange = new EventEmitter<boolean>();

  get active(): boolean {
    return this.#active.get();
  }

  set active(value: boolean) {
    this.#active.set(value);
  }
}

Input()(GefSwitch.prototype, 'active');
Output()(GefSwitch.prototype, 'activeChange');
Component({
  selector: 'GefSwitch',
  template: '<StSwitch></StSwitch>',
})(GefSwitch);
