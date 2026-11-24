# GEF architecture

GEF is a build-time TypeScript and template framework with two distinct execution targets: GNOME Shell extensions running in GJS and native desktop applications running in Node.js with node-gtk. GNOME Shell 51 is the initial supported extension target.

## Execution environments
- GNOME Shell extension: GJS with St, Clutter, Gio, GLib, Meta and Shell APIs.
- Extension preferences: a separate GJS process using GTK4/libadwaita.
- Desktop application: Node.js with node-gtk 4, GTK4 and libadwaita.

The compiler, GTPL syntax and component metadata can be shared. Native widgets, module loaders, process lifecycles and platform APIs cannot. See [Runtimes and compatibility](runtimes.md) for prerequisites and current limits.

The two renderers may share template syntax and metadata, but not widget implementations or CSS assumptions.

## Repository organization

Keep framework code in domain-specific subdirectories. Within `packages/compiler/src`, GTPL responsibilities are separated into `gtpl/ast/`, `gtpl/expression/`, `gtpl/parser/`, `gtpl/analysis/`, `gtpl/lowering/`, `gtpl/codegen/` and `gtpl/validation/`. Public component declarations live in `components/`. Shared primitives live in `packages/shared/`; runtime code is split into `resources/`, `rendering/`, `renderers/`, `reactivity/`, `di/` and `components/`. Keep package entry points focused on exports; do not accumulate domain implementations at `src/` root.

## Compiler

TypeScript, .gtpl and SCSS are processed at build time. Templates are not parsed in the installed extension. There is no browser DOM, Chromium, or runtime HTML parser.

The current compiler provides GTPL parsing, structural-directive lowering for `*if`, `*for`, `*gefIf` and `*gefFor`, two-way binding lowering, expression ASTs including assignment expressions, JavaScript expression-source emission, readable multi-line template generation with line/column-aware Source Map v3 mappings, source diagnostics, lexical scope checks, component input/output contract validation and optional TypeScript expression type checking using a supplied component context type, including literal-union exhaustiveness diagnostics for `@default never`. `checkGtpl` parses and lowers templates before semantic and component-contract validation. Generated functions target the renderer-independent runtime and are covered by compiler/runtime integration tests. Supported constructs include static attributes, reactive property bindings, event callbacks, interpolation, `@if`, `@for`, `@switch` and `@let`. The AST remains dependency-neutral. The declaration API includes `@Component`, `@Directive`, `@Pipe`, `@Input`, `@Output`, `@HostBinding` and `@HostListener`; the shared metadata module is available to both the compiler and GJS runtime, without importing TypeScript into the runtime. Runtime directive registries match element, attribute and class selectors and bind directive inputs and host behavior to native actor lifetimes.

## Runtime foundation

The `ResourceScope` owns cleanup callbacks and disposes them once in reverse registration order. The renderer-independent `createGtplRenderRuntime` implements generated element, text, fragment, conditional, loop and switch calls through a platform host. `mountGtplTemplate` creates a disposable view and owns destruction of its root. The GNOME Shell host maps common St selectors to injected St constructors, applies GObject properties, connects signal handlers and destroys actors. The GTK4/libadwaita host maps common GTK4 and libadwaita widgets through injected constructors and uses native container APIs, CSS classes, widget properties and signal handlers. GSettings adapters bridge boolean, integer, string and string-array keys to writable reactive signals, and both examples share a schema-backed setting. CI runs GTK4/libadwaita widget and GSettings smoke tests under Xvfb. Both hosts support reactive text/property bindings, conditional and switch updates, and keyed loop reconciliation with deterministic effect cleanup. The St and GTK hosts expose common native widget constructors through optional injected namespaces, with custom constructor maps for application-specific widgets. The runtime provides explicit GLib timeout/idle scheduling, GObject signal ownership, D-Bus subscriptions, Clutter transition cleanup, and scoped St/GTK stylesheet helpers alongside synchronous `signal`, `computed` and `effect` primitives plus a hierarchical `Injector` with explicit providers, child scopes and reverse-order disposal. `ComponentRegistry` matches component element and attribute selectors; nested components receive bound inputs, expose output emitters and own their child injector, view and component lifecycle. The initial TypeScript build emits separate compiler, runtime and CLI ESM modules. The `gef` CLI validates GTPL, emits render-function modules, scaffolds minimal GNOME Shell 51 projects and reports local prerequisites. The examples demonstrate a GNOME Shell 51 ESM extension, a GTK4/libadwaita preferences entry point and a Node-GTK desktop application; packaging compiles both GTPL templates and SCSS before staging the runtime modules, styles and metadata; this is not yet a general-purpose GJS bundler. Both renderer adapters remain initial implementations: the repository includes a GNOME Shell 51 virtual-display smoke harness and GTK preferences example, but a complete real-session integration suite, broader widget coverage and production error handling are still needed.

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
