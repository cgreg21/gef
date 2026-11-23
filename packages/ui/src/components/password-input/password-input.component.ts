import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefPasswordInput {
  readonly #value = signal('');

  readonly valueChange = new EventEmitter<string>();

  readonly #showPeekIcon = signal(true);

  get showPeekIcon(): boolean {
    return this.#showPeekIcon.get();
  }

  set showPeekIcon(value: boolean) {
    this.#showPeekIcon.set(value);
  }

  get value(): string {
    return this.#value.get();
  }

  set value(value: string) {
    this.#value.set(value);
  }
}

Input()(GefPasswordInput.prototype, 'value');
Input()(GefPasswordInput.prototype, 'showPeekIcon');
Output()(GefPasswordInput.prototype, 'valueChange');
Component({
  selector: 'GefPasswordInput',
  template: '<GtkPasswordEntry></GtkPasswordEntry>',
})(GefPasswordInput);
