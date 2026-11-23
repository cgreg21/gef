import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefSelect {
  readonly #options = signal<string[]>([]);
  readonly #value = signal('');

  readonly selectedChange = new EventEmitter<string>();

  get options(): string[] {
    return this.#options.get();
  }

  set options(value: string[]) {
    this.#options.set([...value]);
  }

  get value(): string {
    return this.#value.get();
  }

  set value(value: string) {
    this.#value.set(value);
  }
}

Input()(GefSelect.prototype, 'options');
Input()(GefSelect.prototype, 'value');
Output()(GefSelect.prototype, 'selectedChange');
Component({
  selector: 'GefSelect',
  template: '<GtkDropDown></GtkDropDown>',
})(GefSelect);
