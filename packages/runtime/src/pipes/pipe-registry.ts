import { getPipeMetadata } from '../../../shared/src/components/metadata.js';
export interface RuntimePipe {
  transform(value: unknown, ...args: unknown[]): unknown;
}

interface PipeEntry {
  readonly pipe: RuntimePipe;
  readonly pure: boolean;
}

interface PipeCache {
  value: unknown;
  arguments: readonly unknown[];
  result: unknown;
}

/** Explicit registry for pure and impure template pipe transforms. */
export class PipeRegistry {
  readonly #pipes = new Map<string, PipeEntry>();
  #siteCaches = new WeakMap<object, Map<string | number, PipeCache>>();
  readonly #legacyCaches = new Map<string, PipeCache>();

  register(name: string, pipe: RuntimePipe, pure = true): this {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) throw new TypeError(`Invalid GEF pipe name "${name}".`);
    if (this.#pipes.has(name)) throw new TypeError(`Duplicate GEF pipe "${name}".`);
    this.#pipes.set(name, {
      pipe,
      pure,
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
    const entry = this.getEntry(name);
    if (!entry.pure) return entry.pipe.transform(value, ...args);
    const cached = this.#legacyCaches.get(name);
    if (cached && Object.is(cached.value, value) && sameArguments(cached.arguments, args)) return cached.result;
    const result = entry.pipe.transform(value, ...args);
    this.#legacyCaches.set(name, { value, arguments: [...args], result });
    return result;
  }

  transformAt(site: object, siteId: string | number, name: string, value: unknown, ...args: unknown[]): unknown {
    const entry = this.getEntry(name);
    if (!entry.pure) return entry.pipe.transform(value, ...args);
    let caches = this.#siteCaches.get(site);
    if (!caches) {
      caches = new Map();
      this.#siteCaches.set(site, caches);
    }
    const cached = caches.get(siteId);
    if (cached && Object.is(cached.value, value) && sameArguments(cached.arguments, args)) return cached.result;
    const result = entry.pipe.transform(value, ...args);
    caches.set(siteId, { value, arguments: [...args], result });
    return result;
  }

  private getEntry(name: string): PipeEntry {
    const entry = this.#pipes.get(name);
    if (!entry) throw new Error(`No GEF pipe registered as "${name}".`);
    return entry;
  }

  has(name: string): boolean {
    return this.#pipes.has(name);
  }

  clear(): void {
    this.#pipes.clear();
    this.#legacyCaches.clear();
    this.#siteCaches = new WeakMap();
  }
}

function sameArguments(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}
