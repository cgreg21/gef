import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefCheckbox {
  checked = false;
  readonly checkedChange = new EventEmitter<boolean>();
}

Input()(GefCheckbox.prototype, 'checked');
Output()(GefCheckbox.prototype, 'checkedChange');
Component({
  selector: 'GefCheckbox',
  template: '<StCheckBox></StCheckBox>',
})(GefCheckbox);
