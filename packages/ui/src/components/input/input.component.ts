import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefInput {
  readonly #value = signal('');
  readonly #placeholder = signal('');
  readonly #disabled = signal(false);

  readonly valueChange = new EventEmitter<string>();

  get placeholder(): string {
    return this.#placeholder.get();
  }

  set placeholder(value: string) {
    this.#placeholder.set(value);
  }

  get disabled(): boolean {
    return this.#disabled.get();
  }

  set disabled(value: boolean) {
    this.#disabled.set(value);
  }

  get value(): string {
    return this.#value.get();
  }

  set value(value: string) {
    this.#value.set(value);
  }
}

Input()(GefInput.prototype, 'value');
Input()(GefInput.prototype, 'placeholder');
Input()(GefInput.prototype, 'disabled');
Output()(GefInput.prototype, 'valueChange');
Component({
  selector: 'GefInput',
  template: '<StEntry></StEntry>',
})(GefInput);
