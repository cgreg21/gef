# GEF architecture

GEF is a build-time TypeScript and template framework for GNOME Shell extensions. GNOME Shell 51 is the first supported target.

## Execution environments
- Shell renderer: GJS with St, Clutter, Gio, GLib, Meta and Shell APIs.
- Preferences renderer: GTK4/libadwaita in the preferences process.

The two renderers may share template syntax and metadata, but not widget implementations or CSS assumptions.

## Repository organization

Keep framework code in domain-specific subdirectories. Within `packages/compiler/src`, GTPL responsibilities are separated into `gtpl/ast/`, `gtpl/expression/`, `gtpl/parser/`, `gtpl/analysis/` and `gtpl/validation/`. Public component declarations live in `components/`. Runtime code belongs in `packages/runtime/src/` and is split by responsibility, beginning with `resources/`. Keep package entry points focused on exports; do not accumulate domain implementations at `src/` root. Apply the same rule to future lifecycle, dependency injection, reactivity and renderer domains.

## Compiler

TypeScript, .gtpl and SCSS are processed at build time. Templates are not parsed in the installed extension. There is no browser DOM, Chromium, or runtime HTML parser.

The current compiler provides GTPL parsing, structural-directive lowering for `*if`, `*for`, `*gefIf` and `*gefFor`, expression ASTs, JavaScript expression-source emission, an initial `emitGtplTemplate` source generator, source diagnostics, lexical scope checks and component input/output binding validation. The public `checkGtpl` API parses and lowers templates before semantic and component-contract validation. The template generator emits calls against an injected runtime contract; it does not provide that runtime or execute generated code. Static attributes, property bindings, event callbacks, interpolation, `@if`, `@for`, `@switch` and `@let` are supported in this first pass. Two-way bindings and other structural directives remain unsupported and are diagnosed rather than silently miscompiled. The AST is the dependency-neutral model: parsers create it, while analysis and validation consume it without importing parser implementation modules. The declaration API includes `@Component`, `@Directive`, `@Pipe`, `@Input`, `@Output`, `@HostBinding` and `@HostListener`; these decorators produce immutable metadata. Rendering, expression execution, pipe lowering and native host event wiring are not yet implemented.

## Runtime foundation

The `ResourceScope` owns cleanup callbacks and disposes them once in reverse registration order. The renderer-independent `createGtplRenderRuntime` implements generated element, text, fragment, conditional, loop and switch calls through a platform host. `mountGtplTemplate` creates a disposable view and owns destruction of its root. The initial GNOME Shell host maps common St selectors to injected St constructors, applies GObject properties, connects signal handlers and destroys actors. It currently performs initial static rendering; keyed repeat reconciliation and reactive template updates are not connected yet. The runtime also provides synchronous `signal`, `computed` and `effect` primitives, but generated templates do not yet subscribe to them.

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
