import { Component, Input, Output } from '../../../../shared/src/components/metadata.js';
import { EventEmitter } from '../../../../shared/src/events/event-emitter.js';

export class GefSwitch {
  active = false;
  readonly activeChange = new EventEmitter<boolean>();
}

Input()(GefSwitch.prototype, 'active');
Output()(GefSwitch.prototype, 'activeChange');
Component({
  selector: 'GefSwitch',
  template: '<StSwitch></StSwitch>',
})(GefSwitch);
