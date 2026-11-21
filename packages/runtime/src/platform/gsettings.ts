import { ResourceScope } from '../resources/resource-scope.js';
import { Signal, effect } from '../reactivity/signal.js';

export interface GSettingsBooleanSource {
  get_boolean(key: string): boolean;
  set_boolean(key: string, value: boolean): void;
  connect(signal: string, callback: (...args: unknown[]) => void): number;
  disconnect(handlerId: number): void;
}

/** Bridges one GSettings boolean key to a writable reactive signal. */
export function bindGSettingsBoolean(settings: GSettingsBooleanSource, key: string, scope?: ResourceScope): Signal<boolean> {
  if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new TypeError(`Invalid GSettings key "${key}".`);
  const value = new Signal(settings.get_boolean(key));
  const handlerId = settings.connect(`changed::${key}`, () => value.set(settings.get_boolean(key)));
  let active = true;
  const disconnect = () => {
    if (!active) return;
    active = false;
    settings.disconnect(handlerId);
  };
  const stopEffect = effect(() => {
    const next = value.get();
    if (settings.get_boolean(key) !== next) settings.set_boolean(key, next);
  });
  const dispose = () => { stopEffect(); disconnect(); };
  scope?.add(dispose);
  Object.defineProperty(value, 'dispose', { value: dispose, enumerable: false });
  return value;
}
