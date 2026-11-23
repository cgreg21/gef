import { Component, Input } from '../../../../shared/src/components/metadata.js';

export class GefIcon {
  iconName = '';
}

Input()(GefIcon.prototype, 'iconName');
Component({
  selector: 'GefIcon',
  template: '<StIcon></StIcon>',
})(GefIcon);
