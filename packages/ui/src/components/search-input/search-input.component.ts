import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefSearchInput {
  readonly #value = signal('');
  readonly #placeholder = signal('');

  readonly valueChange = new EventEmitter<string>();

  get value(): string {
    return this.#value.get();
  }

  set value(value: string) {
    this.#value.set(value);
  }

  get placeholder(): string {
    return this.#placeholder.get();
  }

  set placeholder(value: string) {
    this.#placeholder.set(value);
  }
}

Input()(GefSearchInput.prototype, 'value');
Input()(GefSearchInput.prototype, 'placeholder');
Output()(GefSearchInput.prototype, 'valueChange');
Component({
  selector: 'GefSearchInput',
  template: '<GtkSearchEntry></GtkSearchEntry>',
})(GefSearchInput);
