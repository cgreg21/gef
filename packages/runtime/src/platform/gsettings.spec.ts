import { describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../resources/resource-scope.js';
import { bindGSettingsBoolean } from './gsettings.js';

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
  it('rejects invalid key names', () => {
    expect(() => bindGSettingsBoolean(createSettings(false), 'Not A Key')).toThrow(/Invalid GSettings key/);
  });
});
