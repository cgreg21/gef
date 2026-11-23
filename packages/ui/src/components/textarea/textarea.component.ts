import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefTextArea {
  readonly #value = signal('');

  readonly valueChange = new EventEmitter<string>();

  get value(): string {
    return this.#value.get();
  }

  set value(value: string) {
    this.#value.set(value);
  }
}

Input()(GefTextArea.prototype, 'value');
Output()(GefTextArea.prototype, 'valueChange');
Component({
  selector: 'GefTextArea',
  template: '<GtkScrolledWindow><GtkTextView></GtkTextView></GtkScrolledWindow>',
})(GefTextArea);
