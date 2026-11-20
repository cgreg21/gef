# GEF architecture

GEF is a build-time TypeScript and template framework for GNOME Shell extensions. GNOME Shell 51 is the first supported target.

## Execution environments
- Shell renderer: GJS with St, Clutter, Gio, GLib, Meta and Shell APIs.
- Preferences renderer: GTK4/libadwaita in the preferences process.

The two renderers may share template syntax and metadata, but not widget implementations or CSS assumptions.

## Repository organization

Keep framework code in domain-specific subdirectories. Within `packages/compiler/src`, GTPL responsibilities are separated into `gtpl/ast/`, `gtpl/expression/`, `gtpl/parser/`, `gtpl/analysis/`, `gtpl/lowering/`, `gtpl/codegen/` and `gtpl/validation/`. Public component declarations live in `components/`. Runtime code is split into `resources/`, `rendering/`, `renderers/`, `reactivity/` and `di/`. Keep package entry points focused on exports; do not accumulate domain implementations at `src/` root.

## Compiler

TypeScript, .gtpl and SCSS are processed at build time. Templates are not parsed in the installed extension. There is no browser DOM, Chromium, or runtime HTML parser.

The current compiler provides GTPL parsing, structural-directive lowering for `*if`, `*for`, `*gefIf` and `*gefFor`, two-way binding lowering, expression ASTs including assignment expressions, JavaScript expression-source emission, initial template source generation, source diagnostics, lexical scope checks and component input/output contract validation. `checkGtpl` parses and lowers templates before semantic and component-contract validation. Generated functions target the renderer-independent runtime and are covered by compiler/runtime integration tests. Supported constructs include static attributes, reactive property bindings, event callbacks, interpolation, `@if`, `@for`, `@switch` and `@let`. The AST remains dependency-neutral. The declaration API includes `@Component`, `@Directive`, `@Pipe`, `@Input`, `@Output`, `@HostBinding` and `@HostListener`; these decorators produce immutable metadata.

## Runtime foundation

The `ResourceScope` owns cleanup callbacks and disposes them once in reverse registration order. The renderer-independent `createGtplRenderRuntime` implements generated element, text, fragment, conditional, loop and switch calls through a platform host. `mountGtplTemplate` creates a disposable view and owns destruction of its root. The GNOME Shell host maps common St selectors to injected St constructors, applies GObject properties, connects signal handlers and destroys actors. The GTK4/libadwaita host uses native GTK container APIs, CSS classes, widget properties and signal handlers. Both hosts support reactive text/property bindings, conditional and switch updates, and keyed loop reconciliation with deterministic effect cleanup. The runtime provides synchronous `signal`, `computed` and `effect` primitives plus a hierarchical `Injector` with explicit providers, child scopes and reverse-order disposal. `mountComponent` creates component instances in child injectors and owns view, component and injector teardown in that order. The initial TypeScript build emits separate compiler, runtime and CLI ESM modules. The `gef` CLI validates GTPL and emits render-function modules; it does not bundle GJS or GNOME resources. Both renderer adapters remain initial implementations: live GNOME Shell 51/GTK4 integration tests, broader widget coverage, preferences examples and production error handling are still needed.

## KISS and package boundaries

Keep the compiler in one package until a concrete need justifies splitting it. Add abstractions only when they remove real duplication or simplify a real use case. Keep the Core small and explicit. The public component declaration API may be expressive; decorators compile into plain metadata and do not require runtime reflection. Dependency injection uses explicit provider dependency lists rather than reflection.

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
