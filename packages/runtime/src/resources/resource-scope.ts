/**
 * Owns cleanup callbacks for resources created by one runtime object.
 *
 * Cleanup runs once, in reverse registration order. Disposing continues after
 * an individual cleanup fails, then rethrows the first error.
 */
export class ResourceScope {
  readonly #cleanups: Array<() => void> = [];
  #disposed = false;

  get disposed(): boolean {
    return this.#disposed;
  }

  add(cleanup: () => void): void {
    if (this.#disposed) {
      cleanup();
      return;
    }

    this.#cleanups.push(cleanup);
  }

  dispose(): void {
    if (this.#disposed) return;

    this.#disposed = true;
    let firstError: unknown;
    let hasError = false;

    for (let index = this.#cleanups.length - 1; index >= 0; index -= 1) {
      try {
        this.#cleanups[index]?.();
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
      }
    }

    this.#cleanups.length = 0;
    if (hasError) throw firstError;
  }
}
