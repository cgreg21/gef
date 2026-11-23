import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input } from '../../../../shared/src/components/metadata.js';

export class GefProgressBar {
  readonly #fraction = signal(0);

  get fraction(): number {
    return this.#fraction.get();
  }

  set fraction(value: number) {
    this.#fraction.set(value);
  }
}

Input()(GefProgressBar.prototype, 'fraction');
Component({
  selector: 'GefProgressBar',
  template: '<StProgressBar></StProgressBar>',
})(GefProgressBar);
