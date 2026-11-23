import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefSlider {
  readonly #value = signal(0);

  readonly valueChange = new EventEmitter<number>();

  get value(): number {
    return this.#value.get();
  }

  set value(value: number) {
    if (!Number.isFinite(value)) throw new Error('GefSlider value must be a finite number.');
    this.#value.set(Math.min(1, Math.max(0, value)));
  }
}

Input()(GefSlider.prototype, 'value');
Output()(GefSlider.prototype, 'valueChange');
Component({
  selector: 'GefSlider',
  template: '<GtkScale></GtkScale>',
})(GefSlider);
