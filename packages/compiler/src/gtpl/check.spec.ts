import { describe, expect, it } from 'vitest';
import { checkGtpl } from './check.js';

describe('checkGtpl', () => {
  it('combines parser, semantic and component diagnostics', () => {
    const result = checkGtpl('<GefButton [missing]="unknown" /> {{ value + }}', {
      componentMembers: ['value'],
      components: [{ selector: 'GefButton', inputs: ['label'] }],
    });

    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'GTPL2004',
      'GTPL4102',
      'GTPL4002',
    ]);
  });

  it('accepts declared component members and valid component contracts', () => {
    const result = checkGtpl('<GefButton [label]="title" (clicked)="activate()" />', {
      componentMembers: ['title', 'activate'],
      components: [{ selector: 'GefButton', inputs: ['label'], outputs: ['clicked'] }],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.nodes).toHaveLength(1);
  });

  it('allows native elements by default and can validate selectors strictly', () => {
    expect(checkGtpl('<StBox />').diagnostics).toEqual([]);
    expect(checkGtpl('<UnknownWidget />', { strictComponents: true }).diagnostics)
      .toMatchObject([{ code: 'GTPL4101' }]);
  });

  it('validates elements nested in control-flow branches', () => {
    const result = checkGtpl('@if (ready) { <GefButton [unknown]="value" /> }', {
      componentMembers: ['ready', 'value'],
      components: [{ selector: 'GefButton', inputs: ['label'] }],
    });

    expect(result.diagnostics).toMatchObject([{ code: 'GTPL4102' }]);
  });
});
