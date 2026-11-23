import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefInput {
  readonly #value = signal('');

  readonly valueChange = new EventEmitter<string>();

  get value(): string {
    return this.#value.get();
  }

  set value(value: string) {
    this.#value.set(value);
  }
}

Input()(GefInput.prototype, 'value');
Output()(GefInput.prototype, 'valueChange');
Component({
  selector: 'GefInput',
  template: '<StEntry></StEntry>',
})(GefInput);
