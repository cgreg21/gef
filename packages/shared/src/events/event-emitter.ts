/**
 * Minimal synchronous event emitter shared by compiler declarations and runtime outputs.
 * Listener snapshots make subscription changes during emit deterministic.
 */
export class EventEmitter<T> {
  readonly #listeners = new Set<(value: T) => void>();

  emit(value: T): void {
    let firstError: unknown;
    let hasError = false;
    for (const listener of [...this.#listeners]) {
      try {
        listener(value);
      } catch (error) {
        if (!hasError) { firstError = error; hasError = true; }
      }
    }
    if (hasError) throw firstError;
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
