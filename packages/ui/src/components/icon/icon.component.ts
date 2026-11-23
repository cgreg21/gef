import { signal } from '../../../../runtime/src/reactivity/signal.js';
import { Component, Input } from '../../../../shared/src/components/metadata.js';

export class GefIcon {
  readonly #iconName = signal('');

  get iconName(): string {
    return this.#iconName.get();
  }

  set iconName(value: string) {
    this.#iconName.set(value);
  }
}

Input()(GefIcon.prototype, 'iconName');
Component({
  selector: 'GefIcon',
  template: '<StIcon></StIcon>',
})(GefIcon);
