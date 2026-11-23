import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefInput {
  value = '';
  readonly valueChange = new EventEmitter<string>();
}

Input()(GefInput.prototype, 'value');
Output()(GefInput.prototype, 'valueChange');
Component({
  selector: 'GefInput',
  template: '<StEntry></StEntry>',
})(GefInput);
