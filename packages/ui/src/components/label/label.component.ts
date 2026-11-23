import { Component, Input } from '../../../../shared/src/components/metadata.js';

export class GefLabel {
  text = '';
}

Input()(GefLabel.prototype, 'text');
Component({
  selector: 'GefLabel',
  template: '<StLabel></StLabel>',
})(GefLabel);
