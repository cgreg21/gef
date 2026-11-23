import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefButton {
  readonly #label = signal('');
  readonly #disabled = signal(false);

  readonly clicked = new EventEmitter<void>();

  get label(): string {
    return this.#label.get();
  }

  set label(value: string) {
    this.#label.set(value);
  }

  get disabled(): boolean {
    return this.#disabled.get();
  }

  set disabled(value: boolean) {
    this.#disabled.set(value);
  }
}

Input()(GefButton.prototype, 'label');
Input()(GefButton.prototype, 'disabled');
Output()(GefButton.prototype, 'clicked');
Component({
  selector: 'GefButton',
  template: '<StButton></StButton>',
})(GefButton);
