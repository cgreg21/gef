# GNOME Extension Framework (GEF)

> **Alpha software:** GEF is under active development. APIs, generated output and CLI behavior may change between alpha releases. It targets GNOME Shell 51; do not treat local validation as a guarantee of extensions.gnome.org approval.

GEF is a TypeScript and GTPL framework for native GNOME Shell 51 extensions.
It targets GJS and GNOME's St/Clutter APIs for the Shell process, and GTK4 /
libadwaita for the preferences process. It does not use a browser DOM. The GNOME Shell 51 smoke test exercises resource-scope cleanup, St host signal/effect teardown and GLib timer cancellation, then installs the generated EGO ZIP and runs two real extension enable/disable cycles on a virtual X11 display.

## Requirements

- Node.js 22+ for compiler, CLI and build tooling
- GNOME Shell 51 and GJS for the extension runtime
- GTK4 and libadwaita for preferences UI
- Sass (installed with the development dependencies) for SCSS compilation
- `zip` and `unzip` for creating and validating the EGO archive

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

The GTK4 smoke test opens and closes a real `Adw.PreferencesWindow` three times using a shared widget lookup helper, mounts the compiled preferences page on each cycle, checks its GSettings-backed switch, verifies view detachment and confirms a destroyed switch can no longer change settings. Renderer unit tests also destroy nested GTK widget trees and verify that child signal handlers and reactive bindings are stopped recursively. GTK teardown releases descendant resources without redundantly detaching children from a container that is itself being disposed. It also loads a real CSS file through a native `Gtk.CssProvider` and verifies resource-scope cleanup without duplicate removal. The GJS lifecycle fixture also checks that St host signal handlers and reactive effects stop when their actors are destroyed. The generated extension's Shell-reported enable/disable cycles are tested separately; this does not introspect every Shell-owned resource. The staged GNOME Shell 51 example is written to `dist/extension/` and packaged as `dist/<uuid>.shell-extension.zip`. The ZIP is rooted at the extension files (not a containing directory), integrity-checked, and scanned for required and development-only paths. On a GNOME Shell 51 host, `npm run test:gnome` installs that exact ZIP into an isolated user data directory, checks the Shell-reported state after enabling and disabling it twice, and removes the temporary installation afterward.
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

Run `gef --help` to see each command and its description on separate lines; a CLI regression test checks that `doctor` and `ego-check` remain distinct entries. `gef generate component UserCard src/components` creates a decorated component with a working `@Input()` property and a GTPL interpolation that displays it. The `ego-check` command checks staged metadata and UUID syntax, requires the root `extension.js` entry point, validates unique stable Shell versions and positive integer metadata versions when supplied, checks declared GSettings schema presence, dotted ID syntax and exact schema-element ID matching, warns about GNOME resource and signal side effects in constructors, rejects development files and orphan JavaScript modules using normalized relative paths, validates local CSS `url()` asset references, and warns about potentially unused CSS, image, font, resource and schema files without failing when dynamic references cannot be proven, and checks Shell/preferences API boundaries across each entry point's local JavaScript dependency graph and requires the Shell entry class to implement `enable()` and `disable()`. The package workflow runs this validator automatically after staging. It is a useful local guard, not a substitute for EGO review. The `new` command creates a working panel-indicator example, with minimal GJS type declarations, direct generated types and explicit `enable()`/`disable()` resource cleanup. The example owns its stylesheet, settings bindings and mounted view in one reverse-order resource scope; a failed partial activation rolls back resources immediately. Generated Node.js packaging code uses static imports and a straightforward synchronous pack command. Generated source includes the GNOME guidance notice for AI-assisted code; remove it only if you understand and can maintain the JavaScript before considering EGO publication. The `compile` command creates missing parent directories for its JavaScript output path, including nested relative paths, and writes a linked Source Map v3 file. The compiler API and component compilation results also expose GTPL node mappings, including nested elements and text nodes; expression mappings are emitted for interpolations and expression-bound attributes; control-flow expressions are also mapped; each nested expression AST node is mapped to its own GTPL source position. CSS compatibility errors include source excerpts and caret markers. CLI diagnostics split LF, CRLF and standalone CR line endings consistently with GTPL source positions.

## npm and npx

For the alpha channel, install GEF in an extension project with `npm install --save-dev gnome-extension-framework@next`, or run the CLI without a global installation:

```sh
npx --yes --package gnome-extension-framework@next gef --help
npx --yes --package gnome-extension-framework@next gef new my-extension
```

The published package exposes the `gef` executable and the compiler/runtime ESM entry points. CI verifies the published manifest and required tarball files, installs the generated package into a clean temporary project, checks compiler/runtime ESM imports and invokes the CLI through `npx`. Alpha releases are published to the npm `next` dist-tag so they do not replace the stable `latest` channel. Stable releases use `latest`. Publishing is performed from a GitHub Release after these checks pass, using npm trusted publishing (OIDC) with a current npm CLI; the release tag must match the package version. The first npm publication must bootstrap the package manually before its trusted publisher can be configured. The current source is prepared as `0.1.0-alpha.1`; it is not public on npm until that bootstrap and release workflow are completed. No npm token is stored in the repository. See [npm release setup](docs/npm-release.md).

## Packages

- `gnome-extension-framework`: compiler declarations and GTPL tooling
- `gnome-extension-framework/runtime`: renderer-independent runtime, DI,
  reactivity, GJS lifecycle helpers, St and GTK render hosts, scoped native stylesheet providers
- `gef`: project and build CLI

The runtime package has no Node.js or TypeScript imports. Decorator metadata is shared with the compiler through a small runtime-safe module; Node, TypeScript and Sass are build-time tools.

## Current scope

Implemented foundations include the GTPL parser and structural lowering,
expression and template code generation with preserved meaningful text whitespace and an initial source-map API for top-level GTPL nodes, optional TypeScript expression type checking, component contract validation,
selector-matched runtime directives and components, component input/output
lifecycles and DI (including reactive input teardown tests and GTK component
reactive input binding, mounting and disposal coverage), repeat-item failure cleanup,
initial-render rollback tracking released immediately after mount, reactive signals,
pure pipe caching, resource scopes, expanded St/GTK4/libadwaita widget hosts, GLib
source and GObject signal cleanup, reactive boolean/integer/string/string-array GSettings bindings,
identifier-level GTPL diagnostics with LF/CRLF/CR source positions and regression coverage, source-context CLI diagnostics, native GTK4/libadwaita smoke tests, a CSS compatibility checker that ignores comments and quoted strings while validating declarations,
and a schema-aware extension staging pipeline.

GEF targets extensions.gnome.org (EGO) review requirements: generated JavaScript must remain readable and reviewable, extension lifecycle work must happen in `enable()` and be cleaned in `disable()`, preferences and Shell code must stay process-isolated, and packages must contain only required runtime files. See [EGO compliance](docs/ego-compliance.md) for the compiler and packaging requirements.

This is an active framework under development, not yet a production-complete
replacement for GNOME's native extension APIs. EGO approval cannot be guaranteed by tooling. See [the architecture](docs/architecture.md)
and [the roadmap](docs/roadmap.md) for the remaining work.
