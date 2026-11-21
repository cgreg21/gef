import { describe, expect, it, vi } from 'vitest';
import { Injector } from '../di/injector.js';
import { signal } from '../reactivity/signal.js';
import { mountDirective } from './directive-ref.js';
import { DirectiveRegistry } from './directive-registry.js';

describe('mountDirective', () => {
  it('matches element, attribute and class selectors', () => {
    const registry = new DirectiveRegistry<object>()
      .register('StButton', { create: () => ({}) })
      .register('[disabled]', { create: () => ({}) })
      .register('.primary', { create: () => ({}) });
    expect(registry.match('StButton', { disabled: true, class: 'primary' })).toHaveLength(3);
    expect(registry.match('StLabel', {})).toHaveLength(0);
  });
  it('registers decorated directive metadata contracts', () => {
    const registry = new DirectiveRegistry<object>();
    registry.registerMetadata({
      selector: '[gefTooltip]',
      inputBindings: [{ publicName: 'text', member: 'text' }],
      hostBindings: [{ member: 'label', property: 'accessible-name' }],
      hostListeners: [{ member: 'activate', event: 'clicked', args: ['$event'] }],
    }, { create: () => ({ text: '', label: '', activate: () => {} }) });
    expect(registry.match('StButton', { gefTooltip: true })).toHaveLength(1);
  });

  it('applies inputs and host bindings, then disposes subscriptions', () => {
    const value = signal('ready');
    const setProperty = vi.fn();
    const listen = vi.fn(() => vi.fn());
    const host = { setProperty, listen };
    const injector = new Injector();
    const ref = mountDirective({
      create: () => ({ value }),
      hostBindings: [{ member: 'value', property: 'accessible-name' }],
    }, injector, host, {});
    expect(setProperty).toHaveBeenLastCalledWith({}, 'accessible-name', 'ready');
    value.set('updated');
    expect(setProperty).toHaveBeenLastCalledWith({}, 'accessible-name', 'updated');
    ref.destroy();
    value.set('ignored');
    expect(setProperty).toHaveBeenCalledTimes(2);
  });

  it('maps host event arguments and cleans up the listener', () => {
    const callback = vi.fn();
    const remove = vi.fn();
    let handler: ((...args: unknown[]) => unknown) | undefined;
    const host = {
      setProperty: vi.fn(),
      listen: vi.fn((_node, _event, listener) => { handler = listener; return remove; }),
    };
    const ref = mountDirective({
      create: () => ({ onClick: callback }),
      hostListeners: [{ member: 'onClick', event: 'clicked', args: ['$event', '$event.target'] }],
    }, new Injector(), host, {});
    const event = { target: 'button' };
    handler?.(event);
    expect(callback).toHaveBeenCalledWith(event, 'button');
    ref.destroy();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('applies declared inputs before host behavior', () => {
    const setProperty = vi.fn();
    const ref = mountDirective({
      create: () => ({ active: false }),
      inputs: [{ publicName: 'active', member: 'active' }],
      hostBindings: [{ member: 'active', property: 'active' }],
    }, new Injector(), { setProperty, listen: () => () => {} }, {}, { active: true });
    expect(setProperty).toHaveBeenCalledWith({}, 'active', true);
    ref.destroy();
  });
});
