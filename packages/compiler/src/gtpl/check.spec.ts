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
      'GTPL4002',
      'GTPL4102',
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

  it('lowers structural directives before semantic analysis', () => {
    const result = checkGtpl('<StLabel *for="let item of items; track item.id">{{item.name}}</StLabel>', {
      componentMembers: ['items'],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.nodes[0]).toMatchObject({
      kind: 'for-block',
      item: 'item',
      children: [{ kind: 'element', name: 'StLabel' }],
    });
  });

  it('reports invalid structural directive syntax', () => {
    const result = checkGtpl('<StLabel *for="let item in items" />');
    expect(result.diagnostics).toMatchObject([{ code: 'GTPL4203' }]);
  });

  it('validates elements nested in control-flow branches', () => {
    const result = checkGtpl('@if (ready) { <GefButton [unknown]="value" /> }', {
      componentMembers: ['ready', 'value'],
      components: [{ selector: 'GefButton', inputs: ['label'] }],
    });

    expect(result.diagnostics).toMatchObject([{ code: 'GTPL4102' }]);
  });
});
