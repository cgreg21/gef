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

export interface GioDBusConnection {
  signal_subscribe(
    sender: string | null,
    interfaceName: string,
    member: string,
    objectPath: string | null,
    arg0: string | null,
    flags: number,
    callback: (...args: unknown[]) => void,
  ): number;
  signal_unsubscribe(subscriptionId: number): void;
}

export interface DBusSignalOptions {
  readonly sender?: string | null;
  readonly interfaceName: string;
  readonly member: string;
  readonly objectPath?: string | null;
  readonly arg0?: string | null;
  readonly flags?: number;
}

/** Subscribes to a D-Bus signal and optionally binds it to a resource scope. */
export function subscribeDBusSignal(
  connection: GioDBusConnection,
  options: DBusSignalOptions,
  callback: (...args: unknown[]) => void,
  scope?: ResourceScope,
): () => void {
  const subscriptionId = connection.signal_subscribe(
    options.sender ?? null,
    options.interfaceName,
    options.member,
    options.objectPath ?? null,
    options.arg0 ?? null,
    options.flags ?? 0,
    callback,
  );
  let active = true;
  const unsubscribe = () => {
    if (!active) return;
    active = false;
    connection.signal_unsubscribe(subscriptionId);
  };
  scope?.add(unsubscribe);
  return unsubscribe;
}

export interface ClutterAnimationActor {
  ease(options: Readonly<Record<string, unknown>>): void;
  remove_transition(name: string): void;
}

export interface ClutterAnimationOptions {
  readonly property: string;
  readonly value: unknown;
  readonly duration: number;
  readonly mode?: unknown;
  readonly onComplete?: () => void;
}

/** Starts a native Clutter actor transition and owns cancellation in a scope. */
export function animateClutterActor(
  actor: ClutterAnimationActor,
  options: ClutterAnimationOptions,
  scope?: ResourceScope,
): () => void {
  actor.ease({
    [options.property]: options.value,
    duration: Math.max(0, options.duration),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.onComplete ? { onComplete: options.onComplete } : {}),
  });
  let active = true;
  const cancel = () => {
    if (!active) return;
    active = false;
    actor.remove_transition(options.property);
  };
  scope?.add(cancel);
  return cancel;
}
