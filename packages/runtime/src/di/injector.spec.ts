import { describe, expect, it, vi } from 'vitest';
import { InjectionToken, Injector } from './injector.js';

describe('Injector', () => {
  it('resolves values and caches factory instances', () => {
    const TOKEN = new InjectionToken<{ id: number }>('service');
    const factory = vi.fn(() => ({ id: 1 }));
    const injector = new Injector([{ provide: TOKEN, useFactory: factory }]);
    expect(injector.get(TOKEN)).toBe(injector.get(TOKEN));
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resolves explicit class dependencies', () => {
    class Config { readonly value = 'ready'; }
    class Service {
      constructor(readonly config: Config) {}
    }
    const injector = new Injector([
      { provide: Config, useClass: Config },
      { provide: Service, useClass: Service, deps: [Config] },
    ]);
    expect(injector.get(Service).config.value).toBe('ready');
  });

  it('supports child overrides without taking ownership of parent instances', () => {
    const TOKEN = new InjectionToken<string>('label');
    const parent = new Injector([{ provide: TOKEN, useValue: 'parent' }]);
    const child = parent.createChild([{ provide: TOKEN, useValue: 'child' }]);
    expect(child.get(TOKEN)).toBe('child');
    expect(parent.get(TOKEN)).toBe('parent');
    child.destroy();
    expect(parent.get(TOKEN)).toBe('parent');
  });

  it('reports missing providers and dependency cycles', () => {
    const Missing = new InjectionToken('missing');
    expect(() => new Injector().get(Missing)).toThrow('No provider');
    class First {}
    class Second {}
    const injector = new Injector([
      { provide: First, useClass: First, deps: [Second] },
      { provide: Second, useClass: Second, deps: [First] },
    ]);
    expect(() => injector.get(First)).toThrow('Circular dependency: First -> Second -> First');
  });

  it('cleans created services in reverse order and only once', () => {
    const first = new InjectionToken<object>('first');
    const second = new InjectionToken<object>('second');
    const order: string[] = [];
    const injector = new Injector([
      { provide: first, useValue: {}, dispose: () => order.push('first') },
      { provide: second, useValue: {}, dispose: () => order.push('second') },
    ]);
    injector.get(first);
    injector.get(second);
    injector.destroy();
    injector.destroy();
    expect(order).toEqual(['second', 'first']);
  });

  it('does not dispose instances owned by its parent', () => {
    const TOKEN = new InjectionToken<object>('shared');
    const dispose = vi.fn();
    const parent = new Injector([{ provide: TOKEN, useValue: {}, dispose }]);
    const child = parent.createChild();
    child.get(TOKEN);
    child.destroy();
    expect(dispose).not.toHaveBeenCalled();
    parent.destroy();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate providers and use after destruction', () => {
    const TOKEN = new InjectionToken<number>('number');
    expect(() => new Injector([
      { provide: TOKEN, useValue: 1 },
      { provide: TOKEN, useValue: 2 },
    ])).toThrow('Duplicate provider');
    const injector = new Injector([{ provide: TOKEN, useValue: 1 }]);
    injector.destroy();
    expect(() => injector.get(TOKEN)).toThrow('destroyed injector');
  });
});
