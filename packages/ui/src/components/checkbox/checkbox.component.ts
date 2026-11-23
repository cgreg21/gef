import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefCheckbox {
  readonly #checked = signal(false);

  readonly checkedChange = new EventEmitter<boolean>();

  get checked(): boolean {
    return this.#checked.get();
  }

  set checked(value: boolean) {
    this.#checked.set(value);
  }
}

Input()(GefCheckbox.prototype, 'checked');
Output()(GefCheckbox.prototype, 'checkedChange');
Component({
  selector: 'GefCheckbox',
  template: '<StCheckBox></StCheckBox>',
})(GefCheckbox);
