import { ResourceScope } from '../resources/resource-scope.js';

export type Constructor<T> = new (...args: any[]) => T;

export class InjectionToken<T> {
  constructor(readonly description: string) {}
}

export type Token<T = unknown> = Constructor<T> | InjectionToken<T>;

interface ProviderOptions<T> {
  readonly provide: Token<T>;
  readonly deps?: readonly Token[];
  readonly dispose?: (value: T) => void;
}

export type Provider<T = unknown> =
  | (ProviderOptions<T> & { readonly useValue: T })
  | (ProviderOptions<T> & { readonly useFactory: (...dependencies: unknown[]) => T })
  | (ProviderOptions<T> & { readonly useClass: Constructor<T> });

function tokenName(token: Token): string {
  return token instanceof InjectionToken ? token.description : token.name || 'anonymous class';
}

/**
 * Small hierarchical injector with explicit dependencies and deterministic cleanup.
 * No reflection or decorator metadata is required.
 */
export class Injector {
  readonly #providers = new Map<Token, Provider>();
  readonly #instances = new Map<Token, unknown>();
  readonly #resolving: Token[] = [];
  readonly #resources = new ResourceScope();
  #destroyed = false;

  constructor(
    providers: readonly Provider[] = [],
    readonly parent?: Injector,
  ) {
    for (const provider of providers) {
      if (this.#providers.has(provider.provide)) {
        throw new TypeError(`Duplicate provider for "${tokenName(provider.provide)}".`);
      }
      this.#providers.set(provider.provide, provider);
    }
  }

  get<T>(token: Token<T>): T {
    if (this.#destroyed) throw new Error('Cannot resolve a service from a destroyed injector.');
    if (this.#instances.has(token)) return this.#instances.get(token) as T;

    const provider = this.#providers.get(token);
    if (!provider) {
      if (this.parent) return this.parent.get(token);
      throw new Error(`No provider for "${tokenName(token)}".`);
    }

    const cycleStart = this.#resolving.indexOf(token);
    if (cycleStart !== -1) {
      const cycle = [...this.#resolving.slice(cycleStart), token].map(tokenName).join(' -> ');
      throw new Error(`Circular dependency: ${cycle}.`);
    }

    this.#resolving.push(token);
    try {
      const instance = this.create(provider);
      this.#instances.set(token, instance);
      if (provider.dispose) this.#resources.add(() => provider.dispose?.(instance));
      return instance as T;
    } finally {
      this.#resolving.pop();
    }
  }

  createChild(providers: readonly Provider[] = []): Injector {
    return new Injector(providers, this);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#resources.dispose();
    this.#instances.clear();
  }

  private create(provider: Provider): unknown {
    if ('useValue' in provider) return provider.useValue;
    const dependencies = (provider.deps ?? []).map((token) => this.get(token));
    if ('useFactory' in provider) return provider.useFactory(...dependencies);
    return new provider.useClass(...dependencies);
  }
}
