/**
 * Minimal synchronous event emitter.
 *
 * Subscriptions are explicitly disposable so owners can release listeners
 * during deterministic GJS resource cleanup.
 */
export class EventEmitter<T> {
  readonly #listeners = new Set<(value: T) => void>();

  emit(value: T): void {
    for (const listener of [...this.#listeners]) {
      listener(value);
    }
  }

  subscribe(listener: (value: T) => void): { unsubscribe(): void } {
    this.#listeners.add(listener);
    let active = true;

    return {
      unsubscribe: () => {
        if (!active) return;
        active = false;
        this.#listeners.delete(listener);
      },
    };
  }

  clear(): void {
    this.#listeners.clear();
  }
}
