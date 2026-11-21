import { describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../resources/resource-scope.js';
import { bindGSettingsBoolean, bindGSettingsInt, bindGSettingsString, bindGSettingsStrv } from './gsettings.js';

function createSettings(initial: boolean) {
  let value = initial;
  let callback: (() => void) | undefined;
  return {
    get_boolean: vi.fn(() => value),
    set_boolean: vi.fn((_key: string, next: boolean) => { value = next; callback?.(); }),
    connect: vi.fn((_signal: string, listener: () => void) => { callback = listener; return 9; }),
    disconnect: vi.fn(() => { callback = undefined; }),
    change(next: boolean) { value = next; callback?.(); },
  };
}

describe('GSettings reactive binding', () => {
  it('reflects external changes and persists signal writes', () => {
    const settings = createSettings(false);
    const value = bindGSettingsBoolean(settings, 'enabled');
    expect(value.get()).toBe(false);
    settings.change(true);
    expect(value.get()).toBe(true);
    value.set(false);
    expect(settings.set_boolean).toHaveBeenCalledWith('enabled', false);
    value.dispose();
  });
  it('disconnects and stops writing when its scope is disposed', () => {
    const settings = createSettings(false);
    const scope = new ResourceScope();
    const value = bindGSettingsBoolean(settings, 'enabled', scope);
    scope.dispose();
    value.set(true);
    expect(settings.disconnect).toHaveBeenCalledWith(9);
    expect(settings.set_boolean).not.toHaveBeenCalled();
  });

  it('supports integer, string and string-array settings', () => {
    const values = new Map<string, number | string | string[]>([
      ['count', 3], ['title', 'GEF'], ['items', ['one']],
    ]);
    const callbacks = new Map<string, () => void>();
    const settings = {
      connect: vi.fn((signal: string, callback: () => void) => {
        callbacks.set(signal, callback);
        return callbacks.size;
      }),
      disconnect: vi.fn(),
      get_int: (key: string) => values.get(key) as number,
      set_int: (key: string, value: number) => { values.set(key, value); callbacks.get(`changed::${key}`)?.(); },
      get_string: (key: string) => values.get(key) as string,
      set_string: (key: string, value: string) => { values.set(key, value); callbacks.get(`changed::${key}`)?.(); },
      get_strv: (key: string) => values.get(key) as string[],
      set_strv: (key: string, value: string[]) => { values.set(key, value); callbacks.get(`changed::${key}`)?.(); },
    };
    const count = bindGSettingsInt(settings, 'count');
    const title = bindGSettingsString(settings, 'title');
    const items = bindGSettingsStrv(settings, 'items');
    count.set(4);
    title.set('Framework');
    items.set(['one', 'two']);
    expect(values.get('count')).toBe(4);
    expect(values.get('title')).toBe('Framework');
    expect(values.get('items')).toEqual(['one', 'two']);
    count.dispose();
    title.dispose();
    items.dispose();
  });

  it('compares string-array settings by value when reads return new arrays', () => {
    let stored = ['one'];
    let changed: (() => void) | undefined;
    const set = vi.fn((_key: string, next: string[]) => {
      stored = [...next];
      changed?.();
    });
    const settings = {
      connect: vi.fn((_signal: string, callback: () => void) => { changed = callback; return 1; }),
      disconnect: vi.fn(),
      get_strv: vi.fn(() => [...stored]),
      set_strv: set,
    };
    const value = bindGSettingsStrv(settings, 'items');

    stored = ['external'];
    changed?.();
    expect(value.get()).toEqual(['external']);
    expect(set).not.toHaveBeenCalled();

    value.set(['local']);
    expect(stored).toEqual(['local']);
    expect(set).toHaveBeenCalledTimes(1);
    value.dispose();
  });

  it('rejects invalid key names', () => {
    expect(() => bindGSettingsBoolean(createSettings(false), 'Not A Key')).toThrow(/Invalid GSettings key/);
  });
});
