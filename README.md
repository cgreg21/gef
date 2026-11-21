# GNOME Extension Framework (GEF)

GEF is a TypeScript and GTPL framework for native GNOME Shell 51 extensions.
It targets GJS and GNOME's St/Clutter APIs for the Shell process, and GTK4 /
libadwaita for the preferences process. It does not use a browser DOM. A separate smoke test exercises real St actors on a virtual X11 display when GNOME Shell 51 is installed.

## Requirements

- Node.js 22+ for compiler, CLI and build tooling
- GNOME Shell 51 and GJS for the extension runtime
- GTK4 and libadwaita for preferences UI
- Sass (installed with the development dependencies) for SCSS compilation

## Development

```sh
npm install
npm run check
npm run build
npm run package:example
# On a host with GNOME Shell 51, GJS, dbus-run-session and Xvfb:
npm run test:gnome
```

The staged GNOME Shell 51 example is written to `dist/extension/`.
`npm run dev:watch` rebuilds and restages it when source files change.

## CLI

```sh
node dist/cli/src/index.js check src/view.gtpl
node dist/cli/src/index.js compile src/view.gtpl dist/view.js
node dist/cli/src/index.js styles src/theme.scss dist/theme.css
node dist/cli/src/index.js new my-extension
node dist/cli/src/index.js generate component UserCard src/components
node dist/cli/src/index.js test
node dist/cli/src/index.js package
node dist/cli/src/index.js doctor
```

## Packages

- `gnome-extension-framework`: compiler declarations and GTPL tooling
- `gnome-extension-framework/runtime`: renderer-independent runtime, DI,
  reactivity, GJS lifecycle helpers, St and GTK render hosts
- `gef`: project and build CLI

The runtime package has no Node.js imports. Node and Sass are build-time tools.

## Current scope

Implemented foundations include the GTPL parser and structural lowering,
expression and template code generation, component contract validation,
selector-matched runtime directives and components, component input/output lifecycles and DI, reactive
signals, pure pipe caching, resource scopes, St and GTK host adapters, GLib
source and GObject signal cleanup, an initial CSS compatibility checker, and
a basic extension staging pipeline.

This is an active framework under development, not yet a production-complete
replacement for GNOME's native extension APIs. See [the architecture](docs/architecture.md)
and [the roadmap](docs/roadmap.md) for the remaining work.
