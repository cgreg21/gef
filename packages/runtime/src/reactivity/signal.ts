type SignalListener<T> = (value: T, previous: T) => void;

interface ReactiveObserver {
  dependOn(signal: Signal<unknown>): void;
  run(): void;
}

let activeObserver: ReactiveObserver | undefined;

export interface ReadonlySignal<T> {
  get(): T;
  subscribe(listener: SignalListener<T>): () => void;
}

/** A synchronous observable value with dependency tracking for effects. */
export class Signal<T> implements ReadonlySignal<T> {
  #value: T;
  readonly #listeners = new Set<SignalListener<T>>();
  readonly #observers = new Set<ReactiveObserver>();

  constructor(value: T) {
    this.#value = value;
  }

  get(): T {
    activeObserver?.dependOn(this as Signal<unknown>);
    return this.#value;
  }

  set(value: T): void {
    if (Object.is(value, this.#value)) return;
    const previous = this.#value;
    this.#value = value;

    let firstError: unknown;
    let hasError = false;
    for (const listener of [...this.#listeners]) {
      try {
        listener(value, previous);
      } catch (error) {
        if (!hasError) { firstError = error; hasError = true; }
      }
    }
    for (const observer of [...this.#observers]) {
      try {
        observer.run();
      } catch (error) {
        if (!hasError) { firstError = error; hasError = true; }
      }
    }
    if (hasError) throw firstError;
  }

  update(updater: (value: T) => T): void {
    this.set(updater(this.#value));
  }

  subscribe(listener: SignalListener<T>): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** @internal Used by ReactiveEffect to manage dependency subscriptions. */
  addObserver(observer: ReactiveObserver): void {
    this.#observers.add(observer);
  }

  /** @internal Used by ReactiveEffect to manage dependency subscriptions. */
  removeObserver(observer: ReactiveObserver): void {
    this.#observers.delete(observer);
  }
}

class ReactiveEffect implements ReactiveObserver {
  readonly #dependencies = new Set<Signal<unknown>>();
  #running = false;
  #pending = false;
  #disposed = false;

  constructor(private readonly callback: () => void) {
    try {
      this.run();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  dependOn(signal: Signal<unknown>): void {
    if (this.#dependencies.has(signal)) return;
    this.#dependencies.add(signal);
    signal.addObserver(this);
  }

  run(): void {
    if (this.#disposed) return;
    if (this.#running) {
      this.#pending = true;
      return;
    }

    do {
      this.#pending = false;
      this.clearDependencies();
      const previousObserver = activeObserver;
      activeObserver = this;
      this.#running = true;
      try {
        this.callback();
      } finally {
        this.#running = false;
        activeObserver = previousObserver;
      }
    } while (this.#pending && !this.#disposed);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clearDependencies();
  }

  private clearDependencies(): void {
    for (const dependency of this.#dependencies) dependency.removeObserver(this);
    this.#dependencies.clear();
  }
}

/** Runs immediately, then again whenever a signal read by the callback changes. */
export function effect(callback: () => void): () => void {
  const observer = new ReactiveEffect(callback);
  return () => observer.dispose();
}

export class ComputedSignal<T> implements ReadonlySignal<T> {
  constructor(
    private readonly value: Signal<T>,
    private readonly stopEffect: () => void,
  ) {}

  get(): T {
    return this.value.get();
  }

  subscribe(listener: SignalListener<T>): () => void {
    return this.value.subscribe(listener);
  }

  dispose(): void {
    this.stopEffect();
  }
}

/** Creates a lazily observable value kept current by its dependencies. */
export function computed<T>(compute: () => T): ComputedSignal<T> {
  const value = new Signal(compute());
  const stopEffect = effect(() => value.set(compute()));
  return new ComputedSignal(value, stopEffect);
}

export function signal<T>(value: T): Signal<T> {
  return new Signal(value);
}
