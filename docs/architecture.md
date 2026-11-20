# GEF architecture

## Product boundary

GEF is a framework and build toolchain for GNOME Shell extensions. The first supported platform is GNOME Shell 51. Compatibility with another Shell release must be demonstrated by platform-specific tests before it is advertised.

GEF has two distinct execution environments:

1. **Shell renderer**: GJS code creating GNOME Shell actors with St, Clutter, Gio, GLib, Meta, and Shell APIs.
2. **Preferences renderer**: GTK4/libadwaita code running in the preferences process.

The renderers may share component metadata, template syntax, diagnostics, and selected framework services. They must not share widget implementations or assume that St CSS and GTK CSS are interchangeable.

## Build-time pipeline

```text
TypeScript + .gtpl + .scss
          |
          v
   GEF compiler toolchain
    |        |         |
    v        v         v
 TS checks  GTPL AST  SCSS compiler
    |        |         |
    |        v         v
    |   template checks  St/GTK CSS validation
    |        |         |
    +--------+---------+
             |
             v
       JavaScript codegen
             |
             v
     GJS extension bundle
```

Templates are parsed and compiled at build time. There is no browser DOM, virtual DOM, Chromium dependency, or runtime HTML parser. Generated code creates native actors through the selected renderer.

## Proposed package boundaries

- `@gef/core`: extension lifecycle, resource ownership, errors, logging, and public contracts.
- `@gef/di`: dependency injection and provider resolution.
- `@gef/signals`: signals, computed values, effects, and scheduling.
- `@gef/compiler`: GTPL parsing, AST, validation, and code generation.
- `@gef/compiler-cli`: compiler integration and diagnostics.
- `@gef/platform-gnome-51`: isolated GNOME Shell 51 adapters and API declarations.
- `@gef/renderer-shell`: St/Clutter component renderer.
- `@gef/renderer-gtk`: GTK4/libadwaita preferences renderer.
- `@gef/styles`: Sass integration, CSS scoping, and target-specific validators.
- `@gef/cli`: project generation, build, test, validate, package, and doctor commands.

These are intended package boundaries, not a claim that all packages already exist.

## Runtime constraints

- TypeScript is compiled to JavaScript; GJS does not execute TypeScript.
- Node.js tools are build-time only and must never be required by the installed extension.
- Preserve GJS-native `gi://` and `resource:///` imports; do not bundle GNOME resource modules.
- Do not depend on browser globals or DOM APIs in the Shell runtime.
- Keep GNOME Shell private API usage behind the GNOME 51 platform adapter.
- Extension shutdown must be synchronous. Resource cleanup must be deterministic and idempotent.
- Every signal connection, timeout, source, actor, D-Bus subscription, and reactive effect must have an explicit owner and cleanup path.

## Styling

SCSS is a source language, not a promise of browser CSS compatibility. The Shell renderer emits St-compatible CSS; the preferences renderer emits GTK-compatible CSS. Each target needs its own validation rules. Component styles are scoped by generated class names by default because GNOME Shell does not provide browser Shadow DOM.

## Current implementation status

The initial repository milestone implements only a small GTPL parser and its syntax-level tests. It does not yet implement component metadata, expression type checking, renderers, Sass compilation, JavaScript code generation, or a runtime.
