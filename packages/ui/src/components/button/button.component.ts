import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefButton {
  label = '';
  disabled = false;
  readonly clicked = new EventEmitter<void>();
}

Input()(GefButton.prototype, 'label');
Input()(GefButton.prototype, 'disabled');
Output()(GefButton.prototype, 'clicked');
Component({
  selector: 'GefButton',
  template: '<StButton></StButton>',
})(GefButton);
