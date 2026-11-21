import { ResourceScope } from '../resources/resource-scope.js';

export interface GLibNamespace {
  readonly PRIORITY_DEFAULT: number;
  readonly PRIORITY_DEFAULT_IDLE: number;
  timeout_add(priority: number, interval: number, callback: () => boolean): number;
  idle_add(priority: number, callback: () => boolean): number;
  source_remove(sourceId: number): void;
}

export interface GObjectSignalSource {
  connect(signal: string, callback: (...args: unknown[]) => unknown): number;
  disconnect(handlerId: number): void;
}

export interface GjsScheduler {
  timeout(milliseconds: number, callback: () => void, scope?: ResourceScope): () => void;
  interval(milliseconds: number, callback: () => void, scope?: ResourceScope): () => void;
  idle(callback: () => void, scope?: ResourceScope): () => void;
}

/** Adapts GLib sources to cancellable callbacks with optional scope ownership. */
export function createGjsScheduler(GLib: GLibNamespace): GjsScheduler {
  const schedule = (
    source: (callback: () => boolean) => number,
    callback: () => void,
    repeat: boolean,
    scope?: ResourceScope,
  ): (() => void) => {
    let active = true;
    const sourceId = source(() => {
      if (!active) return false;
      if (!repeat) active = false;
      callback();
      return repeat && active;
    });
    const cancel = () => {
      if (!active) return;
      active = false;
      GLib.source_remove(sourceId);
    };
    scope?.add(cancel);
    return cancel;
  };

  return {
    timeout: (milliseconds, callback, scope) => schedule(
      (run) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, run),
      callback,
      false,
      scope,
    ),
    interval: (milliseconds, callback, scope) => schedule(
      (run) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, run),
      callback,
      true,
      scope,
    ),
    idle: (callback, scope) => schedule(
      (run) => GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, run),
      callback,
      false,
      scope,
    ),
  };
}

/** Connects a GObject signal and optionally registers its disconnection in a scope. */
export function connectGObjectSignal(
  source: GObjectSignalSource,
  signal: string,
  callback: (...args: unknown[]) => unknown,
  scope?: ResourceScope,
): () => void {
  const handlerId = source.connect(signal, callback);
  let connected = true;
  const disconnect = () => {
    if (!connected) return;
    connected = false;
    source.disconnect(handlerId);
  };
  scope?.add(disconnect);
  return disconnect;
}
