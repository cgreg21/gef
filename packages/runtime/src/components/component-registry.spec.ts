import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from './component-registry.js';

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

  it('supports attribute selectors and rejects duplicates', () => {
    const registry = new ComponentRegistry<object>()
      .register('[gefCard]', { create: () => ({}), render: () => ({}) });
    expect(registry.match('StBox', { gefCard: true })).toBeDefined();
    expect(registry.match('StBox', {})).toBeUndefined();
    expect(() => registry.register('[gefCard]', { create: () => ({}), render: () => ({}) })).toThrow(/Duplicate/);
  });
});
