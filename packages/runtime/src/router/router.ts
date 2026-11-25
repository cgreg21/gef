import type { GtplRenderRuntime, GtplBinding } from '../rendering/gtpl-runtime.js';
import { signal, type ReadonlySignal } from '../reactivity/signal.js';

export interface ActivatedRoute<Node> {
  readonly url: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly queryParams: Readonly<Record<string, string>>;
  readonly fragment?: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly config: Route<Node>;
}

export interface Route<Node> {
  readonly path: string;
  readonly render: (route: ActivatedRoute<Node>, runtime: GtplRenderRuntime<Node>) => Node;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface RouterState<Node> {
  readonly url: string;
  readonly route: ActivatedRoute<Node> | null;
}

export interface NavigationOptions {
  readonly replaceUrl?: boolean;
}

interface ParsedUrl {
  readonly url: string;
  readonly path: string;
  readonly segments: readonly string[];
  readonly queryParams: Readonly<Record<string, string>>;
  readonly fragment?: string;
}

interface RouteRecord<Node> {
  readonly config: Route<Node>;
  readonly segments: readonly string[];
  readonly score: number;
}

function normalizeRoutePath(path: string): string {
  return path.split('/').filter(Boolean).join('/');
}

function parseUrl(value: string): ParsedUrl {
  let parsed: URL;
  try {
    parsed = new URL(value, 'gef://router');
  } catch {
    throw new TypeError(`Invalid route URL "${value}".`);
  }
  if (parsed.protocol !== 'gef:' || parsed.host !== 'router') {
    throw new TypeError('Router navigation only accepts application-relative URLs.');
  }
  let segments: string[];
  try {
    segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    throw new TypeError(`Route URL "${value}" contains an invalid encoded path segment.`);
  }
  const queryParams = Object.freeze(Object.fromEntries(new URLSearchParams(parsed.search)));
  const fragment = parsed.hash ? decodeURIComponent(parsed.hash.slice(1)) : undefined;
  return {
    url: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    path: `/${segments.join('/')}`,
    segments,
    queryParams,
    ...(fragment === undefined ? {} : { fragment }),
  };
}

function matchRoute<Node>(
  record: RouteRecord<Node>,
  segments: readonly string[],
): Readonly<Record<string, string>> | undefined {
  const params: Record<string, string> = {};
  for (let index = 0; index < record.segments.length; index += 1) {
    const expected = record.segments[index]!;
    if (expected === '**') return Object.freeze(params);
    const actual = segments[index];
    if (actual === undefined) return undefined;
    if (expected.startsWith(':')) params[expected.slice(1)] = actual;
    else if (expected !== actual) return undefined;
  }
  return record.segments.length === segments.length ? Object.freeze(params) : undefined;
}

/** Small renderer-independent router with URL matching and an in-memory history. */
export class Router<Node = unknown> {
  readonly #routes: readonly RouteRecord<Node>[];
  readonly #state;
  readonly #history: string[];
  #historyIndex = 0;

  constructor(routes: readonly Route<Node>[], initialUrl = '/') {
    const names = new Set<string>();
    this.#routes = routes.map((config) => {
      if (typeof config.path !== 'string') throw new TypeError('A route path must be a string.');
      const path = normalizeRoutePath(config.path);
      if (names.has(path)) throw new TypeError(`Duplicate route path "${config.path}".`);
      names.add(path);
      const segments = path ? path.split('/') : [];
      if (segments.some((part) => part === '**') && (segments.at(-1) !== '**' || segments.filter((part) => part === '**').length > 1)) {
        throw new TypeError('A wildcard route ("**") must be the final path segment.');
      }
      const parameters = segments.filter((part) => part.startsWith(':')).map((part) => part.slice(1));
      if (parameters.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) || new Set(parameters).size !== parameters.length) {
        throw new TypeError(`Route "${config.path}" contains an invalid or duplicate parameter name.`);
      }
      const score = segments.reduce((total, part) => total + (part === '**' ? -1000 : part.startsWith(':') ? 1 : 10), segments.length);
      return { config, segments, score };
    }).sort((left, right) => right.score - left.score);

    const parsed = parseUrl(initialUrl);
    const route = this.resolve(parsed);
    this.#state = signal<RouterState<Node>>({ url: parsed.url, route });
    this.#history = [parsed.url];
  }

  get state(): ReadonlySignal<RouterState<Node>> {
    return this.#state;
  }

  get url(): string {
    return this.#state.get().url;
  }

  get currentRoute(): ActivatedRoute<Node> | null {
    return this.#state.get().route;
  }

  navigate(url: string, options: NavigationOptions = {}): boolean {
    const parsed = parseUrl(url);
    const route = this.resolve(parsed);
    if (!route) return false;

    if (options.replaceUrl) {
      this.#history[this.#historyIndex] = parsed.url;
    } else {
      this.#history.splice(this.#historyIndex + 1);
      this.#history.push(parsed.url);
      this.#historyIndex = this.#history.length - 1;
    }
    this.#state.set({ url: parsed.url, route });
    return true;
  }

  back(): boolean {
    if (this.#historyIndex === 0) return false;
    this.#historyIndex -= 1;
    this.activate(this.#history[this.#historyIndex]!);
    return true;
  }

  forward(): boolean {
    if (this.#historyIndex >= this.#history.length - 1) return false;
    this.#historyIndex += 1;
    this.activate(this.#history[this.#historyIndex]!);
    return true;
  }

  private activate(url: string): void {
    const parsed = parseUrl(url);
    this.#state.set({ url: parsed.url, route: this.resolve(parsed) });
  }

  private resolve(parsed: ParsedUrl): ActivatedRoute<Node> | null {
    for (const record of this.#routes) {
      const params = matchRoute(record, parsed.segments);
      if (!params) continue;
      return Object.freeze({
        url: parsed.url,
        path: parsed.path,
        params,
        queryParams: parsed.queryParams,
        ...(parsed.fragment === undefined ? {} : { fragment: parsed.fragment }),
        data: Object.freeze({ ...(record.config.data ?? {}) }),
        config: record.config,
      });
    }
    return null;
  }
}

/** Renders the active route and replaces its view when navigation changes. */
export function renderRouterOutlet<Node>(
  router: Router<Node>,
  runtime: GtplRenderRuntime<Node>,
  fallback: () => Node = () => runtime.fragment([]),
): Node {
  const route: GtplBinding<ActivatedRoute<Node> | null> = runtime.bind(() => router.currentRoute);
  return runtime.if(route, (current) => current.config.render(current, runtime), fallback);
}

/** Returns a URL and navigation callback suitable for a component or template handler. */
export function routerLink<Node>(router: Router<Node>, url: string): { readonly href: string; readonly navigate: () => boolean } {
  return Object.freeze({ href: url, navigate: () => router.navigate(url) });
}
