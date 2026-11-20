# GEF architecture

GEF is a build-time TypeScript and template framework for GNOME Shell extensions. GNOME Shell 51 is the first supported target.

## Execution environments
- Shell renderer: GJS with St, Clutter, Gio, GLib, Meta and Shell APIs.
- Preferences renderer: GTK4/libadwaita in the preferences process.

The two renderers may share template syntax and metadata, but not widget implementations or CSS assumptions.

## Repository organization

Keep framework code in domain-specific subdirectories. Within `packages/compiler/src`, GTPL responsibilities are separated into `gtpl/ast/`, `gtpl/expression/`, `gtpl/parser/`, `gtpl/analysis/` and `gtpl/validation/`. Public component declarations live in `components/`. Keep package entry points focused on exports; do not accumulate domain implementations at `src/` root. Apply the same rule to future runtime domains such as lifecycle, dependency injection, reactivity, resources and renderers.

## Compiler
TypeScript, .gtpl and SCSS are processed at build time. Templates are not parsed in the installed extension. There is no browser DOM, Chromium, or runtime HTML parser.

The current compiler provides GTPL parsing, expression ASTs, source diagnostics, lexical scope checks and component input/output binding validation. The AST is the dependency-neutral model: parsers create it, while analysis and validation consume it without importing parser implementation modules. The declaration API includes `@Component`, `@Directive`, `@Pipe`, `@Input`, `@Output`, `@HostBinding` and `@HostListener`; these decorators produce immutable metadata. Rendering, expression execution, pipe lowering and native host event wiring are not yet implemented.

## KISS and package boundaries
Keep the compiler in one package until a concrete need justifies splitting it. Add abstractions only when they remove real duplication or simplify a real use case. Keep the Core small and explicit. The public component declaration API may be expressive; decorators compile into plain metadata and do not require runtime reflection or a dependency-injection container.

## Runtime constraints
- TypeScript compiles to JavaScript; GJS does not execute TypeScript.
- Node.js tools are build-time only.
- Preserve gi:// and resource:/// imports as GJS-native imports.
- Do not use browser globals or DOM APIs in the Shell runtime.
- Keep GNOME Shell private APIs behind the GNOME 51 platform boundary.
- Extension shutdown is synchronous; resource cleanup must be deterministic and idempotent.
- Every signal, timeout, actor, D-Bus subscription and reactive effect needs an explicit cleanup owner.

## Styling
SCSS is a source language, not a promise of browser CSS compatibility. Validate St CSS and GTK CSS separately.