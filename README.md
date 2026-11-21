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
# Native GTK4/libadwaita smoke test (also runs in CI):
npm run test:gtk
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
node dist/cli/src/index.js ego-check dist/extension
```

Run `gef --help` to see each command and its description on separate lines; a CLI regression test checks that `doctor` and `ego-check` remain distinct entries. `gef generate component UserCard src/components` creates a decorated component with a working `@Input()` property and a GTPL interpolation that displays it. The `ego-check` command checks staged metadata, stable Shell versions, declared GSettings schema presence and ID, forbidden development files and basic Shell/preferences import boundaries. The package workflow runs this validator automatically after staging. It is a useful local guard, not a substitute for EGO review. The `new` command creates a working panel-indicator example, with minimal GJS type declarations, direct generated types and explicit `enable()`/`disable()` resource cleanup. Generated Node.js packaging code uses static imports and a straightforward synchronous pack command. Generated source includes the GNOME guidance notice for AI-assisted code; remove it only if you understand and can maintain the JavaScript before considering EGO publication. The `compile` command creates missing parent directories for its JavaScript output path, including nested relative paths. CSS compatibility errors include source excerpts and caret markers.

## npm and npx

After publication on npm, install GEF in an extension project with `npm install --save-dev gnome-extension-framework`, or run the CLI without a global installation:

```sh
npx --yes --package gnome-extension-framework gef --help
npx --yes --package gnome-extension-framework gef new my-extension
```

The published package exposes the `gef` executable and the compiler/runtime ESM entry points. Publishing is performed from a tagged release after CI and the package-content checks pass; no npm token is stored in the repository.

## Packages

- `gnome-extension-framework`: compiler declarations and GTPL tooling
- `gnome-extension-framework/runtime`: renderer-independent runtime, DI,
  reactivity, GJS lifecycle helpers, St and GTK render hosts, scoped native stylesheet providers
- `gef`: project and build CLI

The runtime package has no Node.js or TypeScript imports. Decorator metadata is shared with the compiler through a small runtime-safe module; Node, TypeScript and Sass are build-time tools.

## Current scope

Implemented foundations include the GTPL parser and structural lowering,
expression and template code generation, optional TypeScript expression type checking, component contract validation,
selector-matched runtime directives and components, component input/output lifecycles and DI (including reactive input teardown tests and GTK component reactive input binding, mounting and disposal coverage), reactive
signals, pure pipe caching, resource scopes, expanded St/GTK4/libadwaita widget hosts, GLib
source and GObject signal cleanup, reactive boolean/integer/string/string-array GSettings bindings,
source-context CLI diagnostics, native GTK4/libadwaita smoke tests, an initial CSS compatibility checker,
and a schema-aware extension staging pipeline.

GEF targets extensions.gnome.org (EGO) review requirements: generated JavaScript must remain readable and reviewable, extension lifecycle work must happen in `enable()` and be cleaned in `disable()`, preferences and Shell code must stay process-isolated, and packages must contain only required runtime files. See [EGO compliance](docs/ego-compliance.md) for the compiler and packaging requirements.

This is an active framework under development, not yet a production-complete
replacement for GNOME's native extension APIs. EGO approval cannot be guaranteed by tooling. See [the architecture](docs/architecture.md)
and [the roadmap](docs/roadmap.md) for the remaining work.
