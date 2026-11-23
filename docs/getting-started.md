# Getting started

This guide takes you from an empty directory to a locally built GNOME Shell 51
extension. GEF is alpha software: keep the generated code small, inspect the
output, and test on the GNOME Shell version you target.

## 1. Prerequisites

For compiler and CLI work:

- Node.js 22 or newer
- npm
- Git (recommended)

For running the extension and native integration tests:

- GNOME Shell 51 and GJS
- GTK4 and libadwaita for preferences
- `zip` and `unzip` for archive validation
- `dbus-run-session` and Xvfb for the Shell smoke harness

On a checkout of GEF, install dependencies and run its checks:

```sh
npm install
npm run check
npm run build
```

## 2. Create a starter extension

The first public npm release is not yet available. From a GEF source checkout, build and run the CLI locally:

```sh
npm install
npm run build
npm run gef -- new hello-world
cd hello-world
```

After the alpha package is published, the equivalent command is:

```sh
npx --yes --package gnome-extension-framework@next gef new hello-world
cd hello-world
npm install
```

The generator also writes `gef.json`, which records the project under `projects` and sets `projectType` to `extension`. It creates `metadata.json`, `extension.ts`, minimal GJS declarations, TypeScript configuration, package scripts and an EGO packaging script. The generated example adds a panel button in `enable()` and destroys it in `disable()`.

The generated project declares the framework dependency as `^0.1.0-alpha.2`. The generated UUID is a placeholder (`hello-world@example.com`). Replace it with a stable UUID you control before packaging. Update the extension name, description and supported Shell versions in `metadata.json` as appropriate. Do not claim compatibility with a Shell version you have not tested.

### Create a Node-GTK application

GEF can also scaffold a native Node.js desktop application using node-gtk 4:

```sh
gef new desktop-app --type application
cd desktop-app
npm install
gef build
npm start
gef package
```

This creates `gef.json` with `projectType: "application"`, a GTK4/libadwaita entry point using `gi:` imports, and Node-GTK launch and bundle scripts. Its `package.json` also configures the portable bundle name, reverse-DNS application ID, compiled entry point and GTK 4 target. Node-GTK 4 runs with `node --import node-gtk/register`; install the native GTK4 and libadwaita libraries required by your platform. `gef package` runs the generated `npm run package` script, which delegates to `node-gtk bundle`. The upstream portable bundler currently targets Linux.
## 3. Build and package

The starter project defines its own build and package scripts. Run:

```sh
npm run build
npm run package
```

The generated package script compiles TypeScript and delegates archive
creation to GNOME's `gnome-extensions pack` command. Review that script and
its output for your project; it is a deliberately small starting point, not a
general bundler for arbitrary dependencies.

For the GEF repository's own example, the equivalent project commands are:

```sh
npm run build
npm run package:example
```

The repository packaging pipeline stages the extension in `dist/extension/`
and creates a UUID-named EGO ZIP. It checks the archive and runs the staged
extension validator. On a host with GNOME Shell 51 and the required display
tools, run `npm run test:gnome` to install that exact archive in an isolated
user data directory and exercise two enable/disable cycles.

## 4. Add a GTPL template

GTPL is compiled ahead of time; it is not HTML and is never parsed by a
browser or by the installed extension. A minimal template can look like:

```html
<StBox>
  <StLabel>{{ title }}</StLabel>
</StBox>
```

Use the CLI to parse and validate it, then emit a JavaScript render module:

```sh
gef check src/view.gtpl
gef compile src/view.gtpl dist/view.js
```

The compile command also writes a linked Source Map v3 file. See the
[GTPL language reference](gtpl-language.md) for bindings, control flow,
expressions, scope rules and the current grammar.

## 5. Use the runtime

The runtime entry point is `gnome-extension-framework/runtime`. It exports
resource scopes, reactive primitives, dependency injection, render hosts,
component/directive/pipe registries, GSettings adapters and GJS lifecycle
helpers.

A resource scope gives activation resources one explicit owner:

```ts
import { ResourceScope } from 'gnome-extension-framework/runtime';

export default class ExampleExtension {
  private resources: ResourceScope | undefined;

  enable(): void {
    const resources = new ResourceScope();
    this.resources = resources;

    // Register each cleanup with resources.add(() => cleanup()).
    // If setup fails, dispose resources before rethrowing.
  }

  disable(): void {
    this.resources?.dispose();
    this.resources = undefined;
  }
}
```

This snippet illustrates ownership only. Use the exact resource APIs and
native St/GJS methods for the objects your extension creates. Always release
signals, GLib sources, actors, subscriptions and reactive effects. Keep Shell
imports out of preferences modules and GTK/libadwaita imports out of Shell
modules. See [architecture](architecture.md) and
[EGO compliance](ego-compliance.md).

## 6. Work with components

Generate a component pair:

```sh
gef generate component UserCard src/components
```

This writes a TypeScript component declaration and a matching `.gtpl`
template. The generated pair is a starting point: compile the template against
the component contract and register its render function with the appropriate
renderer. The [components guide](components.md) documents component inputs,
outputs, directives, host bindings/listeners and pipes.

## 7. Validate before sharing

Run the local project checks and inspect the staged extension:

```sh
gef doctor
gef ego-check dist/extension
```

`doctor` checks local tool availability. `ego-check` validates the staged
directory's metadata, entry points, JavaScript dependency boundaries, schema
references, CSS asset paths and development-only files. It also emits
advisories for some possible side effects and unused resources.

These checks are static safeguards, not a full security audit or a guarantee
of EGO approval. Test the extension in a real GNOME Shell 51 session, verify
that `disable()` releases every resource, and review the final ZIP contents.

## 8. Next steps

- Read the [CLI reference](cli-reference.md).
- Learn [GTPL syntax](gtpl-language.md).
- Review [components and directives](components.md).
- Understand [the runtime architecture](architecture.md).
- Follow the [EGO checklist](ego-compliance.md).
- Read the [npm release procedure](npm-release.md) before publishing.
