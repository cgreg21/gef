import { Component, Input } from '../../../../shared/src/components/metadata.js';

export class GefProgressBar {
  fraction = 0;
}

Input()(GefProgressBar.prototype, 'fraction');
Component({
  selector: 'GefProgressBar',
  template: '<StProgressBar></StProgressBar>',
})(GefProgressBar);
