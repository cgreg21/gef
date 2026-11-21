import { getPipeMetadata } from '../../../shared/src/components/metadata.js';
export interface RuntimePipe {
  transform(value: unknown, ...args: unknown[]): unknown;
}

interface PipeEntry {
  readonly pipe: RuntimePipe;
  readonly pure: boolean;
  hasCachedValue: boolean;
  lastValue: unknown;
  lastArguments: readonly unknown[];
  lastResult: unknown;
}

/** Explicit registry for pure and impure template pipe transforms. */
export class PipeRegistry {
  readonly #pipes = new Map<string, PipeEntry>();

  register(name: string, pipe: RuntimePipe, pure = true): this {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) throw new TypeError(`Invalid GEF pipe name "${name}".`);
    if (this.#pipes.has(name)) throw new TypeError(`Duplicate GEF pipe "${name}".`);
    this.#pipes.set(name, {
      pipe,
      pure,
      hasCachedValue: false,
      lastValue: undefined,
      lastArguments: [],
      lastResult: undefined,
    });
    return this;
  }

  registerType(type: Function, create: () => RuntimePipe): this {
    const metadata = getPipeMetadata(type);
    if (!metadata) throw new TypeError('Cannot register a pipe without @Pipe metadata.');
    return this.registerMetadata(metadata, create());
  }

  registerMetadata(metadata: { readonly name: string; readonly pure: boolean }, pipe: RuntimePipe): this {
    return this.register(metadata.name, pipe, metadata.pure);
  }

  transform(name: string, value: unknown, ...args: unknown[]): unknown {
    const entry = this.#pipes.get(name);
    if (!entry) throw new Error(`No GEF pipe registered as "${name}".`);
    if (entry.pure && entry.hasCachedValue
      && Object.is(entry.lastValue, value)
      && sameArguments(entry.lastArguments, args)) {
      return entry.lastResult;
    }

    const result = entry.pipe.transform(value, ...args);
    if (entry.pure) {
      entry.hasCachedValue = true;
      entry.lastValue = value;
      entry.lastArguments = [...args];
      entry.lastResult = result;
    }
    return result;
  }

  has(name: string): boolean {
    return this.#pipes.has(name);
  }

  clear(): void {
    this.#pipes.clear();
  }
}

function sameArguments(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}
