import { ResourceScope } from '../resources/resource-scope.js';
import { Signal, effect } from '../reactivity/signal.js';

export interface GSettingsSource {
  connect(signal: string, callback: (...args: unknown[]) => void): number;
  disconnect(handlerId: number): void;
}

export interface GSettingsBooleanSource extends GSettingsSource {
  get_boolean(key: string): boolean;
  set_boolean(key: string, value: boolean): void;
}

export interface GSettingsIntSource extends GSettingsSource {
  get_int(key: string): number;
  set_int(key: string, value: number): void;
}

export interface GSettingsStringSource extends GSettingsSource {
  get_string(key: string): string;
  set_string(key: string, value: string): void;
}

export interface GSettingsStrvSource extends GSettingsSource {
  get_strv(key: string): string[];
  set_strv(key: string, value: string[]): void;
}

/** Bridges any GSettings value type to a writable reactive signal. */
export function bindGSettingsValue<T>(
  settings: GSettingsSource,
  key: string,
  read: (key: string) => T,
  write: (key: string, value: T) => void,
  scope?: ResourceScope,
  equals: (left: T, right: T) => boolean = Object.is,
): Signal<T> & { dispose(): void } {
  if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new TypeError(`Invalid GSettings key "${key}".`);
  const value = new Signal(read(key));
  const handlerId = settings.connect(`changed::${key}`, () => value.set(read(key)));
  let active = true;
  const disconnect = () => {
    if (!active) return;
    active = false;
    settings.disconnect(handlerId);
  };
  const stopEffect = effect(() => {
    const next = value.get();
    if (!equals(read(key), next)) write(key, next);
  });
  const dispose = () => { stopEffect(); disconnect(); };
  scope?.add(dispose);
  Object.defineProperty(value, 'dispose', { value: dispose, enumerable: false });
  return value as Signal<T> & { dispose(): void };
}

export function bindGSettingsBoolean(settings: GSettingsBooleanSource, key: string, scope?: ResourceScope) {
  return bindGSettingsValue(settings, key, (name) => settings.get_boolean(name), (name, value) => settings.set_boolean(name, value), scope);
}

export function bindGSettingsInt(settings: GSettingsIntSource, key: string, scope?: ResourceScope) {
  return bindGSettingsValue(settings, key, (name) => settings.get_int(name), (name, value) => settings.set_int(name, value), scope);
}

export function bindGSettingsString(settings: GSettingsStringSource, key: string, scope?: ResourceScope) {
  return bindGSettingsValue(settings, key, (name) => settings.get_string(name), (name, value) => settings.set_string(name, value), scope);
}

export function bindGSettingsStrv(settings: GSettingsStrvSource, key: string, scope?: ResourceScope) {
  const equalStrings = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);
  return bindGSettingsValue(settings, key, (name) => settings.get_strv(name), (name, value) => settings.set_strv(name, value), scope, equalStrings);
}
