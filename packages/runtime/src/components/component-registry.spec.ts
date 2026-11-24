import { Component, HostBinding, Input } from '../../../shared/src/components/metadata.js';
import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from './component-registry.js';
import { Injector } from '../di/injector.js';

describe('ComponentRegistry', () => {
  it('matches component element selectors and returns definitions', () => {
    const definition = {
      create: () => ({}),
      render: (_instance: object, runtime: { text(value: string): object }) => runtime.text('ok'),
    };
    const registry = new ComponentRegistry<object>().register('GefButton', definition);
    expect(registry.match('GefButton', {})).toBe(definition);
    expect(registry.match('StButton', {})).toBeUndefined();
  });

  it('registers a decorated component metadata contract', () => {
    const registry = new ComponentRegistry<object>();
    registry.registerMetadata({ selector: 'GefLabel', inputBindings: [{ publicName: 'text', member: 'label' }], outputBindings: [] }, {
      create: () => ({ label: '' }), render: (instance, runtime) => runtime.text(instance.label),
    });
    expect(registry.match('GefLabel', {})).toBeDefined();
  });

  it('registers a decorated component class directly', () => {
    @Component({ selector: 'GefDecoratedLabel', template: '<StLabel />' })
    class DecoratedLabel {
      @Input('title') label = '';
      @HostBinding('accessible-label') accessibleLabel = 'Decorated label';
    }
    const registry = new ComponentRegistry<object>().registerType(
      DecoratedLabel,
      (instance, runtime) => runtime.text(instance.label),
    );
    expect(registry.match('GefDecoratedLabel', {})).toBeDefined();
    expect(registry.match('GefDecoratedLabel', {} )?.inputs).toEqual([{ publicName: 'title', member: 'label' }]);
    expect(registry.match('GefDecoratedLabel', {} )?.hostBindings).toEqual([{ member: 'accessibleLabel', property: 'accessible-label' }]);
  });

  it('creates decorated component instances without a manual factory', () => {
    @Component({ selector: 'GefAutomatic', template: '<StLabel />' })
    class AutomaticComponent {}
    const definition = new ComponentRegistry<object>().registerType(
      AutomaticComponent,
      () => ({ kind: 'automatic' }),
    ).match('GefAutomatic', {});
    expect(definition?.create(new Injector())).toBeInstanceOf(AutomaticComponent);
  });

  it('supports attribute selectors and rejects duplicates', () => {
    const registry = new ComponentRegistry<object>()
      .register('[gefCard]', { create: () => ({}), render: () => ({}) });
    expect(registry.match('StBox', { gefCard: true })).toBeDefined();
    expect(registry.match('StBox', {})).toBeUndefined();
    expect(() => registry.register('[gefCard]', { create: () => ({}), render: () => ({}) })).toThrow(/Duplicate/);
  });
});
