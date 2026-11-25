import { describe, expect, it, vi } from 'vitest';
import { createApplicationRouter, Router, renderRouterOutlet, routerLink } from './router.js';
import { createGtplRenderRuntime, type GtplRenderHost } from '../rendering/gtpl-runtime.js';

type Node = { readonly kind: string; readonly value?: unknown; readonly children?: readonly Node[] };

function createHost(
  listeners: Array<(...args: unknown[]) => unknown> = [],
  cleanups: Array<() => void> = [],
  createdAttributes: Array<Readonly<Record<string, unknown>>> = [],
): GtplRenderHost<Node> {
  return {
    destroy: () => {},
    listen: (_node, _event, handler) => { listeners.push(handler); return () => { cleanups.push(() => {}); }; },
    onDestroy: (_node, callback) => { cleanups.push(callback); },
    element: (name, attributes, children) => { createdAttributes.push(attributes); return { kind: name, value: attributes, children: children ? [children] : [] }; },
    text: (value) => ({ kind: 'text', value }),
    fragment: (children) => ({ kind: 'fragment', children }),
    repeat: (state) => ({ kind: 'repeat', value: state.get() }),
    conditional: (condition, render, fallback) => condition.get() ? render(condition.get()) : fallback(),
    switch: () => ({ kind: 'switch' }),
  };
}

describe('Router', () => {

  it('creates an application router from route configuration and a root view', () => {
    const root = { kind: 'root' };
    const router = createApplicationRouter({
      initialUrl: '/home',
      routes: [{ path: '/home' }, { path: '/custom', render: () => ({ kind: 'custom' }) }],
    }, () => root);

    const homeRoute = router.currentRoute;
    if (!homeRoute) throw new Error('Expected the initial route to match.');
    expect(homeRoute.config.path).toBe('/home');
    expect(homeRoute.config.render(homeRoute, createGtplRenderRuntime(createHost()))).toBe(root);
    expect(router.navigate('/custom')).toBe(true);
    const customRoute = router.currentRoute;
    if (!customRoute) throw new Error('Expected the custom route to match.');
    expect(customRoute.config.render(customRoute, createGtplRenderRuntime(createHost()))).toEqual({ kind: 'custom' });
  });

  it('matches static routes before parameter routes and exposes decoded params', () => {
    const router = new Router([
      { path: '/users/:id', render: () => ({ kind: 'user' }) },
      { path: '/users/new', render: () => ({ kind: 'new-user' }) },
    ], '/users/new');

    expect(router.currentRoute?.config.path).toBe('/users/new');
    expect(router.navigate('/users/a%20b')).toBe(true);
    expect(router.currentRoute?.params).toEqual({ id: 'a b' });
    expect(router.currentRoute?.path).toBe('/users/a b');
  });

  it('exposes query parameters, fragments and route data', () => {
    const router = new Router([
      { path: '/search', data: { title: 'Search' }, render: () => ({ kind: 'search' }) },
    ], '/search?q=gef&page=2#results');

    expect(router.currentRoute).toMatchObject({
      queryParams: { q: 'gef', page: '2' },
      fragment: 'results',
      data: { title: 'Search' },
    });
  });

  it('supports wildcard and empty routes', () => {
    const router = new Router([
      { path: '**', render: () => ({ kind: 'not-found' }) },
      { path: '', render: () => ({ kind: 'home' }) },
    ]);
    expect(router.currentRoute?.config.path).toBe('');
    router.navigate('/missing/path');
    expect(router.currentRoute?.config.path).toBe('**');
  });

  it('navigates back and forward and replaces the current history entry', () => {
    const router = new Router([
      { path: '/', render: () => ({ kind: 'home' }) },
      { path: '/one', render: () => ({ kind: 'one' }) },
      { path: '/two', render: () => ({ kind: 'two' }) },
      { path: '/replacement', render: () => ({ kind: 'replacement' }) },
    ]);

    expect(router.canGoBack).toBe(false);
    expect(router.canGoForward).toBe(false);
    expect(router.navigate('/one')).toBe(true);
    expect(router.canGoBack).toBe(true);
    expect(router.canGoForward).toBe(false);
    expect(router.navigate('/two')).toBe(true);
    expect(router.canGoForward).toBe(false);
    expect(router.back()).toBe(true);
    expect(router.canGoForward).toBe(true);
    expect(router.url).toBe('/one');
    expect(router.navigate('/replacement', { replaceUrl: true })).toBe(true);
    expect(router.canGoForward).toBe(true);
    expect(router.forward()).toBe(true);
    expect(router.canGoBack).toBe(true);
    expect(router.canGoForward).toBe(false);
    expect(router.url).toBe('/two');
    expect(router.back()).toBe(true);
    expect(router.url).toBe('/replacement');
    expect(router.back()).toBe(true);
    expect(router.url).toBe('/');
    expect(router.back()).toBe(false);
    expect(router.canGoBack).toBe(false);
    expect(router.canGoForward).toBe(true);
  });


  it('guards navigation and keeps history unchanged when a route is denied', () => {
    let allowed = false;
    const router = new Router([
      { path: '/', render: () => ({ kind: 'home' }) },
      { path: '/private', canActivate: () => allowed, render: () => ({ kind: 'private' }) },
      { path: '/public', render: () => ({ kind: 'public' }) },
    ]);

    expect(router.navigate('/private')).toBe(false);
    expect(router.url).toBe('/');
    expect(router.canGoBack).toBe(false);

    expect(router.navigate('/public')).toBe(true);
    expect(router.navigate('/private')).toBe(false);
    expect(router.url).toBe('/public');

    allowed = true;
    expect(router.navigate('/private')).toBe(true);
    allowed = false;
    expect(router.back()).toBe(true);
    expect(router.url).toBe('/public');
    expect(router.canGoForward).toBe(true);
    expect(router.forward()).toBe(false);
    expect(router.url).toBe('/public');
    expect(router.canGoForward).toBe(true);
  });


  it('blocks leaving a route and preserves navigation history', () => {
    let canLeave = false;
    const router = new Router([
      { path: '/', render: () => ({ kind: 'home' }) },
      {
        path: '/edit',
        canDeactivate: () => canLeave,
        render: () => ({ kind: 'edit' }),
      },
      { path: '/preview', render: () => ({ kind: 'preview' }) },
    ]);

    expect(router.navigate('/edit')).toBe(true);
    expect(router.navigate('/preview')).toBe(false);
    expect(router.url).toBe('/edit');
    expect(router.canGoBack).toBe(true);
    expect(router.canGoForward).toBe(false);

    canLeave = true;
    expect(router.navigate('/preview')).toBe(true);
    expect(router.navigate('/edit')).toBe(true);
    canLeave = false;
    expect(router.back()).toBe(false);
    expect(router.url).toBe('/edit');
    expect(router.canGoBack).toBe(true);
    expect(router.canGoForward).toBe(false);

    canLeave = true;
    expect(router.back()).toBe(true);
    expect(router.url).toBe('/preview');
    canLeave = false;
    expect(router.forward()).toBe(true);
    expect(router.url).toBe('/edit');
  });

  it('passes current and next activated routes to the deactivation guard', () => {
    const guard = vi.fn(() => true);
    const router = new Router([
      { path: '/one', render: () => ({ kind: 'one' }), canDeactivate: guard },
      { path: '/two', render: () => ({ kind: 'two' }) },
    ], '/one');

    expect(router.navigate('/two')).toBe(true);
    expect(guard).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/one' }),
      expect.objectContaining({ path: '/two' }),
    );
  });

  it('does not activate a guarded initial route when access is denied', () => {
    const router = new Router([
      { path: '/private', canActivate: () => false, render: () => ({ kind: 'private' }) },
    ], '/private');
    expect(router.currentRoute).toBeNull();
    expect(router.url).toBe('/private');
  });

  it('does not change the current route or history when a URL does not match', () => {
    const router = new Router([{ path: '/', render: () => ({ kind: 'home' }) }]);
    expect(router.navigate('/missing')).toBe(false);
    expect(router.url).toBe('/');
    expect(router.back()).toBe(false);
  });

  it('rejects duplicate paths, invalid parameters and misplaced wildcards', () => {
    const render = () => ({ kind: 'route' });
    expect(() => new Router([{ path: '/same', render }, { path: 'same/', render }])).toThrow(/Duplicate route/);
    expect(() => new Router([{ path: '/:bad-name', render }])).toThrow(/invalid or duplicate parameter/);
    expect(() => new Router([{ path: '/**/end', render }])).toThrow(/final path segment/);
  });

  it('rejects absolute URLs, protocol-relative URLs and malformed encoded URL parts', () => {
    const router = new Router([{ path: '**', render: () => ({ kind: 'fallback' }) }]);
    expect(() => router.navigate('https://example.com/')).toThrow(/application-relative/);
    expect(() => router.navigate('gef://router/about')).toThrow(/application-relative/);
    expect(() => router.navigate('//example.com/about')).toThrow(/application-relative/);
    expect(() => router.navigate('/bad%ZZ')).toThrow(/invalid encoded path segment/);
    expect(() => router.navigate('/about#bad%ZZ')).toThrow(/invalid encoded fragment/);
  });

  it('normalizes encoded static route segments and rejects encoded separators or dot segments', () => {
    const router = new Router([
      { path: '/files/my%20document', render: () => ({ kind: 'file' }) },
      { path: '/files/:name', render: () => ({ kind: 'dynamic' }) },
    ]);
    expect(router.navigate('/files/my%20document')).toBe(true);
    expect(router.currentRoute?.config.path).toBe('/files/my%20document');
    expect(router.navigate('/files/another%20file')).toBe(true);
    expect(router.currentRoute?.params.name).toBe('another file');

    const render = () => ({ kind: 'route' });
    expect(() => new Router([{ path: '/files/a%2Fb', render }])).toThrow(/invalid path segment/);
    expect(() => new Router([{ path: '/files/a%5Cb', render }])).toThrow(/invalid path segment/);
    expect(() => new Router([{ path: '/files/%2E%2E', render }])).toThrow(/invalid path segment/);
    expect(() => router.navigate('/files/../secret')).toThrow(/invalid path segment/);
    expect(() => router.navigate('/files/a%5Cb')).toThrow(/invalid path segment/);
    expect(() => router.navigate('/files/%2e%2e/secret')).toThrow(/invalid path segment/);
  });

  it('rejects malformed percent encoding in query parameters', () => {
    const router = new Router([{ path: '/search', render: () => ({ kind: 'search' }) }]);
    expect(() => router.navigate('/search?q=%ZZ')).toThrow(/invalid encoded query parameter/);
  });

  it('rejects query strings and fragments in route configuration paths', () => {
    const render = () => ({ kind: 'route' });
    expect(() => new Router([{ path: '/search?q=gef', render }])).toThrow(/cannot contain query parameters/);
    expect(() => new Router([{ path: '/search#results', render }])).toThrow(/cannot contain query parameters/);
  });

  it('renders the current route through the GTPL runtime outlet', () => {
    const router = new Router([
      { path: '/', render: () => ({ kind: 'home' }) },
      { path: '/users/:id', render: (route) => ({ kind: 'user', value: route.params.id }) },
    ]);
    const runtime = createGtplRenderRuntime(createHost());
    expect(renderRouterOutlet(router, runtime)).toEqual({ kind: 'home' });
    router.navigate('/users/42');
    expect(renderRouterOutlet(router, runtime)).toEqual({ kind: 'user', value: '42' });
  });


  it('navigates from GTPL routerLink and releases the native listener with its node', () => {
    const listeners: Array<(...args: unknown[]) => unknown> = [];
    const cleanups: Array<() => void> = [];
    const attributes: Array<Readonly<Record<string, unknown>>> = [];
    const host = createHost(listeners, cleanups, attributes);
    const router = new Router([
      { path: '/', render: () => ({ kind: 'home' }) },
      { path: '/about', render: () => ({ kind: 'about' }) },
      { path: '/users/:id', render: () => ({ kind: 'user' }) },
    ]);
    let target = '/about';
    const runtime = createGtplRenderRuntime(host);
    renderRouterOutlet(router, runtime);

    const button = runtime.element('StButton', {
      routerLink: runtime.bind(() => target),
      label: 'About',
    }, undefined);

    expect(button.kind).toBe('StButton');
    expect(attributes[0]).toEqual({ label: 'About' });
    expect(listeners).toHaveLength(1);
    expect(router.url).toBe('/');
    target = '/users/42';
    listeners[0]!();
    expect(router.url).toBe('/users/42');
    expect(cleanups).toHaveLength(1);
    cleanups[0]!();
  });


  it('rejects an invalid routerLink value before registering a native listener', () => {
    const listeners: Array<(...args: unknown[]) => unknown> = [];
    const destroyed: Node[] = [];
    const host = {
      ...createHost(listeners),
      destroy: (node: Node) => { destroyed.push(node); },
    };
    const router = new Router([{ path: '/', render: () => ({ kind: 'home' }) }]);
    const runtime = createGtplRenderRuntime(host);
    renderRouterOutlet(router, runtime);

    expect(() => runtime.element('StButton', { routerLink: 42 }, undefined))
      .toThrow(/URL string or null/);
    expect(listeners).toHaveLength(0);
    expect(destroyed).toHaveLength(1);
  });

  it('allows a null routerLink to disable navigation without requiring an outlet', () => {
    const host = createHost();
    const runtime = createGtplRenderRuntime(host);
    expect(runtime.element('StButton', { routerLink: null }, undefined).kind).toBe('StButton');

    const router = new Router([{ path: '/', render: () => ({ kind: 'home' }) }]);
    renderRouterOutlet(router, runtime);
    const listeners: Array<(...args: unknown[]) => unknown> = [];
    const linkHost = createHost(listeners);
    const linkedRuntime = createGtplRenderRuntime(linkHost);
    renderRouterOutlet(router, linkedRuntime);
    linkedRuntime.element('StButton', { routerLink: null }, undefined);
    expect(listeners).toHaveLength(0);
    expect(router.url).toBe('/');
  });

  it('creates simple navigable links', () => {
    const router = new Router([{ path: '/', render: () => ({ kind: 'home' }) }, { path: '/about', render: () => ({ kind: 'about' }) }]);
    const link = routerLink(router, '/about');
    expect(link.href).toBe('/about');
    expect(link.navigate()).toBe(true);
    expect(router.url).toBe('/about');
  });

  it('notifies subscribers when navigation changes the active route', () => {
    const router = new Router([{ path: '/', render: () => ({ kind: 'home' }) }, { path: '/about', render: () => ({ kind: 'about' }) }]);
    const listener = vi.fn();
    router.state.subscribe(listener);
    router.navigate('/about');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0].route?.config.path).toBe('/about');
  });
});
