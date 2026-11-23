import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input } from '../../../../shared/src/components/metadata.js';

export class GefLabel {
  readonly #text = signal('');

  get text(): string {
    return this.#text.get();
  }

  set text(value: string) {
    this.#text.set(value);
  }
}

Input()(GefLabel.prototype, 'text');
Component({
  selector: 'GefLabel',
  template: '<StLabel></StLabel>',
})(GefLabel);
